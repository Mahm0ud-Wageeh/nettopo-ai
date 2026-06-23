import { GoogleGenerativeAI } from "@google/generative-ai";

export interface AiProvider {
  name: string;
  available: () => boolean;
  parse: (text: string) => Promise<unknown>;
}

// Shared instruction: force strict JSON matching our intent shape.
export const SYSTEM_PROMPT = `You convert a network description (Arabic or English) into JSON.
Return ONLY valid JSON, no prose, in this exact shape:
{
 "devices":[{"type":"ROUTER|SWITCH|SERVER|PC|FIREWALL|AP|PRINTER|CAMERA|NVR|IP_PHONE","count":number}],
 "explicitConnections":[{"from":"label","to":"label"}],
 "options":{"vlan":boolean,"routingProtocol":"OSPF|EIGRP|RIP|BGP|STATIC|null"}
}
Type mapping hints (Arabic -> type):
- طابعة/طابعات -> PRINTER
- كاميرا/كاميرات/مراقبة -> CAMERA
- مسجل/NVR/DVR -> NVR
- تليفون/هاتف/voip -> IP_PHONE
- اكسس بوينت/واي فاي/wifi -> AP
- سيرفر/خادم -> SERVER
- جهاز/كمبيوتر/حاسوب -> PC
- راوتر/موجه -> ROUTER
- سويتش/مبدل -> SWITCH
- جدار حماية/فايروول -> FIREWALL
Infer counts from the text. If VLAN/segmentation/isolation is mentioned, set vlan true.`;

function stripToJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end >= 0 ? body.slice(start, end + 1) : body;
}

/**
 * Retry a transient-failing async call (HTTP 503, 429, 500) a couple of times
 * with short backoff before giving up. Keeps temporary "model is overloaded"
 * (503) spikes from dropping us straight to the rule-based fallback.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  baseDelayMs = 600,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const status = (err as { status?: number })?.status ?? 0;
      const transient = status === 503 || status === 429 || status === 500;
      if (!transient || attempt === retries) throw err;
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * (attempt + 1)),
      );
    }
  }
  throw lastErr;
}

/**
 * Factory for any OpenAI-compatible "chat completions" provider
 * (Groq, OpenRouter, Cerebras, Mistral...). They all speak the same shape:
 *   POST {baseUrl}/chat/completions  ->  { choices:[{ message:{ content } }] }
 * Transient 5xx/429 errors get .status attached so withRetry can retry them.
 */
function openAiCompatProvider(config: {
  name: string;
  envKey: string;
  baseUrl: string;
  model: string;
  extraHeaders?: Record<string, string>;
}): AiProvider {
  return {
    name: config.name,
    available: () => !!process.env[config.envKey],
    parse: async (text) => {
      const data = await withRetry(() =>
        fetch(`${config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env[config.envKey]}`,
            "Content-Type": "application/json",
            ...(config.extraHeaders ?? {}),
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: `DESCRIPTION:\n${text}` },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const err = new Error(`${config.name} ${r.status}`) as Error & {
              status?: number;
            };
            err.status = r.status;
            throw err;
          }
          return r.json();
        }),
      );
      const content = data?.choices?.[0]?.message?.content ?? "";
      return JSON.parse(stripToJson(content));
    },
  };
}

// 1) Google Gemini (free API key from aistudio.google.com)
export const geminiProvider: AiProvider = {
  name: "gemini",
  available: () => !!process.env.GEMINI_API_KEY,
  parse: async (text) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const res = await withRetry(() =>
      model.generateContent(`${SYSTEM_PROMPT}\n\nDESCRIPTION:\n${text}`),
    );
    return JSON.parse(stripToJson(res.response.text()));
  },
};

// 2) Hugging Face Inference API (free token)
export const huggingFaceProvider: AiProvider = {
  name: "huggingface",
  available: () => !!process.env.HUGGINGFACE_API_KEY,
  parse: async (text) => {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs: `${SYSTEM_PROMPT}\n\nDESCRIPTION:\n${text}\n\nJSON:`,
          parameters: { max_new_tokens: 512, return_full_text: false },
        }),
      },
    );
    if (!res.ok) throw new Error(`HF ${res.status}`);
    const data = await res.json();
    const generated = Array.isArray(data)
      ? (data[0]?.generated_text ?? "")
      : String(data);
    return JSON.parse(stripToJson(generated));
  },
};

// 3) Local Ollama (free, offline; e.g. llama3)
export const ollamaProvider: AiProvider = {
  name: "ollama",
  available: () => !!process.env.OLLAMA_BASE_URL,
  parse: async (text) => {
    const res = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3",
        prompt: `${SYSTEM_PROMPT}\n\nDESCRIPTION:\n${text}\n\nJSON:`,
        stream: false,
        format: "json",
      }),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data = await res.json();
    return JSON.parse(stripToJson(data.response ?? ""));
  },
};

// 4) Groq — very fast, generous free tier (console.groq.com)
export const groqProvider = openAiCompatProvider({
  name: "groq",
  envKey: "GROQ_API_KEY",
  baseUrl: "https://api.groq.com/openai/v1",
  model: "llama-3.3-70b-versatile",
});

// 5) Cerebras — ultra-fast inference, free tier (cloud.cerebras.ai)
export const cerebrasProvider = openAiCompatProvider({
  name: "cerebras",
  envKey: "CEREBRAS_API_KEY",
  baseUrl: "https://api.cerebras.ai/v1",
  model: "llama-3.3-70b",
});

// 6) OpenRouter — aggregator with many free models (openrouter.ai)
export const openRouterProvider = openAiCompatProvider({
  name: "openrouter",
  envKey: "OPENROUTER_API_KEY",
  baseUrl: "https://openrouter.ai/api/v1",
  model: "meta-llama/llama-3.3-70b-instruct:free",
  extraHeaders: { "X-Title": "NetTopo AI" },
});

// 7) Mistral — La Plateforme free tier (console.mistral.ai)
export const mistralProvider = openAiCompatProvider({
  name: "mistral",
  envKey: "MISTRAL_API_KEY",
  baseUrl: "https://api.mistral.ai/v1",
  model: "mistral-small-latest",
});

// 8) Z.ai (Zhipu GLM) — free GLM-4.5-Flash (z.ai). If the model name errors,
// switch model to "glm-4-flash".
export const zaiProvider = openAiCompatProvider({
  name: "zai",
  envKey: "Z_API_KEY",
  baseUrl: "https://api.z.ai/api/paas/v4",
  model: "glm-4.5-flash",
});