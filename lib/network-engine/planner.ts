import type { NetworkPlan, Topology } from "@/lib/network-engine/types";
import { allocateSubnets } from "@/lib/network-engine/ip-planner";
import { planVlans } from "@/lib/network-engine/vlan-planner";
import { suggestRouting } from "@/lib/network-engine/routing";
import { securityNotes } from "@/lib/network-engine/security";

export function planNetwork(topology: Topology, base = "192.168.0.0"): NetworkPlan {
  const { devices } = topology;
  const useVlans = devices.some((d) => d.type === "PC") && devices.some((d) => d.type === "SERVER");

  const vlanPlan = useVlans ? planVlans(devices) : [];

  // IP plan: per-VLAN subnets, or a single subnet sized to total endpoints
  const ipPlan = vlanPlan.length
    ? { base: `${base}/16`, subnets: vlanPlan.map((v) => ({
        name: `${v.name} (VLAN ${v.id})`,
        cidr: v.subnet,
        mask: "",
        range: "",
      })) }
    : {
        base: `${base}/24`,
        subnets: allocateSubnets(base, [{ name: "LAN", hosts: Math.max(devices.length, 2) }]),
      };

  const routing = suggestRouting(devices, vlanPlan, undefined);
  const notes = securityNotes(devices);

  return { ipPlan, vlanPlan, routing, notes };
}
