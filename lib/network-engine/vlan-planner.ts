import type { Device, VlanEntry } from "@/lib/network-engine/types";
import { allocateSubnets, type SubnetRequirement } from "@/lib/network-engine/ip-planner";

// Role groups -> VLAN id/name. Servers, users, and management are separated.
const VLAN_DEFS = [
  { id: 10, name: "USERS", types: ["PC"] },
  { id: 20, name: "SERVERS", types: ["SERVER"] },
  { id: 30, name: "WIFI", types: ["AP"] },
  { id: 99, name: "MGMT", types: ["ROUTER", "SWITCH", "FIREWALL"] },
];

export function planVlans(devices: Device[], base = "10.0.0.0"): VlanEntry[] {
  const reqs: SubnetRequirement[] = [];
  const active = VLAN_DEFS.filter((v) => devices.some((d) => v.types.includes(d.type)));

  for (const v of active) {
    const count = devices.filter((d) => v.types.includes(d.type)).length;
    reqs.push({ name: `VLAN${v.id}-${v.name}`, hosts: Math.max(count, 2) });
  }

  const subnets = allocateSubnets(base, reqs);
  return active.map((v, i) => ({ id: v.id, name: v.name, subnet: subnets[i].cidr }));
}
