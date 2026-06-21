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
 "devices":[{"type":"ROUTER|SWITCH|SERVER|PC|FIREWALL|AP","count":number}],
 "explicitConnections":[{"from":"label","to":"label"}],
 "options":{"vlan":boolean,"routingProtocol":"OSPF|EIGRP|RIP|BGP|STATIC|null"}
}
Infer counts from the text. If VLAN/segmentation is mentioned, set vlan true.`;

function stripToJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end >= 0 ? body.slice(start, end + 1) : body;
}

// 1) Google Gemini (free API key from aistudio.google.com)
export const geminiProvider: AiProvider = {
  name: "gemini",
  available: () => !!process.env.GEMINI_API_KEY,
  parse: async (text) => {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
    const model = genAI.getGenerativeModel({
      model: "gemini-flash-latest",
      generationConfig: { responseMimeType: "application/json" },
    });
    const res = await model.generateContent(`${SYSTEM_PROMPT}\n\nDESCRIPTION:\n${text}`);
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
    const generated = Array.isArray(data) ? data[0]?.generated_text ?? "" : String(data);
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
