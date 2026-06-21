import type { NextRequest } from "next/server";
import { route } from "@/lib/api/handler";
import { parsePrompt } from "@/lib/ai";
import { parseInputSchema } from "@/lib/validators/schemas";

/**
 * POST /api/ai/parse
 * Turns a natural-language description into a structured intent.
 * Works with zero API keys thanks to the deterministic rule fallback.
 */
export function POST(req: NextRequest) {
  return route(async () => {
    const { text, lang } = parseInputSchema.parse(await req.json());
    const intent = await parsePrompt(text, lang);
    return { intent };
  });
}
