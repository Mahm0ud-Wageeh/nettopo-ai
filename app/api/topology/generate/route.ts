import type { NextRequest } from "next/server";
import { route } from "@/lib/api/handler";
import { parsePrompt } from "@/lib/ai";
import { buildTopology, planNetwork } from "@/lib/network-engine";
import { parseInputSchema, topologySchema } from "@/lib/validators/schemas";

/**
 * POST /api/topology/generate
 * Accepts either:
 *  - { text, lang }            -> NL / OCR description (AI + rule fallback)
 *  - { devices, connections }  -> manual builder payload
 * Returns devices, connections, layout, and a full network plan.
 */
export function POST(req: NextRequest) {
  return route(async () => {
    const body = await req.json();

    let topology;
    if (typeof body?.text === "string") {
      const { text, lang } = parseInputSchema.parse(body);
      const intent = await parsePrompt(text, lang);
      topology = buildTopology(intent);
    } else {
      const parsed = topologySchema.parse(body);
      topology = buildTopology(parsed);
    }

    const network_plan = planNetwork(topology);
    return {
      devices: topology.devices,
      connections: topology.connections,
      layout: topology.layout,
      network_plan,
    };
  });
}
