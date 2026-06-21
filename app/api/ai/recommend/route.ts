import type { NextRequest } from "next/server";
import { route } from "@/lib/api/handler";
import { planVlans, suggestRouting, securityNotes } from "@/lib/network-engine";
import { topologySchema } from "@/lib/validators/schemas";

/**
 * POST /api/ai/recommend
 * Given a topology, returns VLAN, routing, and security recommendations.
 */
export function POST(req: NextRequest) {
  return route(async () => {
    const { devices } = topologySchema.parse(await req.json());
    const vlanPlan = planVlans(devices);
    const routing = suggestRouting(devices, vlanPlan);
    const notes = securityNotes(devices);
    return { vlanPlan, routing, notes };
  });
}
