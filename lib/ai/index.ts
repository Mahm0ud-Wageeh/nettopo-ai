import type { DeviceType, ParsedIntent } from "@/lib/network-engine/types";
import { ruleParse } from "@/lib/network-engine/parser/rule-parser";
import { geminiProvider, huggingFaceProvider, ollamaProvider, type AiProvider } from "./providers";

const PROVIDERS: AiProvider[] = [geminiProvider, huggingFaceProvider, ollamaProvider];
const VALID_TYPES: DeviceType[] = ["ROUTER", "SWITCH", "SERVER", "PC", "FIREWALL", "AP"];

/** Coerce arbitrary LLM JSON into a safe ParsedIntent (drops junk). */
function normalizeIntent(raw: unknown): ParsedIntent {
  const obj = (raw ?? {}) as Record<string, any>;
  const devices = Array.isArray(obj.devices)
    ? obj.devices
        .filter((d: any) => VALID_TYPES.includes(d?.type))
        .map((d: any) => ({ type: d.type as DeviceType, count: Math.max(1, Math.min(500, Number(d.count) || 1)) }))
    : [];
  const options = {
    vlan: Boolean(obj.options?.vlan),
    routingProtocol: typeof obj.options?.routingProtocol === "string" ? obj.options.routingProtocol : undefined,
  };
  const explicitConnections = Array.isArray(obj.explicitConnections)
    ? obj.explicitConnections.filter((c: any) => c?.from && c?.to)
    : undefined;
  return { devices, explicitConnections, options };
}

/**
 * Parse a natural-language network description into a structured intent.
 * Tries each available AI provider in order; always falls back to the
 * deterministic rule parser so it works with no API keys.
 */
export async function parsePrompt(text: string, _lang: "ar" | "en" | "auto" = "auto"): Promise<ParsedIntent> {
  for (const provider of PROVIDERS) {
    if (!provider.available()) continue;
    try {
      const intent = normalizeIntent(await provider.parse(text));
      if (intent.devices.length > 0) return intent;
    } catch (err) {
      console.warn(`[ai] provider "${provider.name}" failed, trying next:`, err);
    }
  }
  return ruleParse(text);
}
