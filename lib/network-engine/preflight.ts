import type { BuiltTopology, Device } from "@/lib/network-engine/types";
import type { Addressing } from "@/lib/network-engine/cisco";

export type NodeStatus = "online" | "degraded" | "offline";

export interface PreflightIssue {
  id: string;
  deviceId?: string;
  kind: "offline" | "degraded";
  title: string;
  detail: string;
  remove: string[];
  add: string[];
}

// Runs real, deterministic checks against the generated network and returns the
// issues found. Nothing here is faked -- every issue maps to something actually
// present (or missing) in the topology / addressing.
export function runPreflight(
  topology: BuiltTopology,
  addressing?: Addressing,
): PreflightIssue[] {
  const issues: PreflightIssue[] = [];

  const linked = new Set<string>();
  topology.connections.forEach((c) => {
    linked.add(c.from);
    linked.add(c.to);
  });
  const hasFirewall = topology.devices.some((d) => d.type === "FIREWALL");
  const multiDevice = topology.devices.length > 1;

  topology.devices.forEach((d) => {
    // 1) Unconnected device -> unreachable (offline).
    if (multiDevice && !linked.has(d.id)) {
      issues.push({
        id: `link-${d.id}`,
        deviceId: d.id,
        kind: "offline",
        title: `${d.label} is not connected`,
        detail: `${d.label} has no link in the topology, so it cannot be reached. Wire it to an access switch or uplink.`,
        remove: [],
        add: [
          `! ${d.label}: connect an interface to an access switch / uplink`,
        ],
      });
      return;
    }

    // 2) Edge device exposed with no firewall (degraded).
    if (!hasFirewall && (d.type === "ROUTER" || d.type === "SERVER")) {
      const tag = d.label.toUpperCase().replace(/[^A-Z0-9]/g, "-");
      issues.push({
        id: `fw-${d.id}`,
        deviceId: d.id,
        kind: "degraded",
        title: `${d.label} is exposed at the edge`,
        detail: `No firewall protects ${d.label}. Add an inbound ACL so only established / return traffic is allowed.`,
        remove: [],
        add: [
          `ip access-list extended PROTECT-${tag}`,
          " permit tcp any any established",
          " deny ip any any log",
        ],
      });
    }

    // 3) Server on a flat (non-VLAN) network (degraded).
    if (d.type === "SERVER" && addressing && addressing.mode !== "vlan") {
      issues.push({
        id: `vlan-${d.id}`,
        deviceId: d.id,
        kind: "degraded",
        title: `${d.label} is on a flat network`,
        detail: `${d.label} should live on a dedicated server VLAN, isolated from user traffic with ACLs.`,
        remove: ["! servers currently share the user subnet"],
        add: ["vlan 20", " name SERVERS"],
      });
    }
  });

  return issues;
}

export function statusFromIssues(
  devices: Device[],
  issues: PreflightIssue[],
): Record<string, NodeStatus> {
  const status: Record<string, NodeStatus> = {};
  devices.forEach((d) => {
    status[d.id] = "online";
  });
  issues.forEach((i) => {
    if (!i.deviceId) return;
    if (i.kind === "offline") status[i.deviceId] = "offline";
    else if (status[i.deviceId] !== "offline") status[i.deviceId] = "degraded";
  });
  return status;
}

export function countStatus(status: Record<string, NodeStatus>) {
  const counts = { online: 0, degraded: 0, offline: 0 };
  Object.values(status).forEach((s) => {
    counts[s] += 1;
  });
  return counts;
}

export function buildPatch(issues: PreflightIssue[]): {
  remove: string[];
  add: string[];
} {
  const remove: string[] = [];
  const add: string[] = [];
  issues.forEach((i) => {
    i.remove.forEach((l) => remove.push(l));
    i.add.forEach((l) => add.push(l));
  });
  return { remove, add };
}