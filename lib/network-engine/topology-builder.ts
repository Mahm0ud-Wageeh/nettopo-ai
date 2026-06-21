import type { BuiltTopology, Connection, Device, DeviceType, ParsedIntent, Topology } from "@/lib/network-engine/types";

const PREFIX: Record<DeviceType, string> = {
  ROUTER: "R", SWITCH: "SW", SERVER: "SRV", PC: "PC", FIREWALL: "FW", AP: "AP",
};

function isIntent(input: ParsedIntent | Topology): input is ParsedIntent {
  return "options" in input;
}

/** Expand {type,count} into concrete labeled devices (R1, R2, SW1...). */
function expandDevices(intent: ParsedIntent): Device[] {
  const out: Device[] = [];
  for (const d of intent.devices) {
    for (let i = 1; i <= d.count; i++) {
      const id = `${PREFIX[d.type]}${i}`;
      out.push({ id, label: id, type: d.type });
    }
  }
  return out;
}

/**
 * Heuristic hierarchical wiring:
 *   routers (meshed) -> firewall -> switches -> endpoints (PC/Server/AP)
 * If a layer is missing it is skipped, so the tree stays connected.
 */
function inferConnections(devices: Device[]): Connection[] {
  const byType = (t: DeviceType) => devices.filter((d) => d.type === t);
  const routers = byType("ROUTER");
  const firewalls = byType("FIREWALL");
  const switches = byType("SWITCH");
  const endpoints = [...byType("PC"), ...byType("SERVER"), ...byType("AP")];

  const edges: Connection[] = [];
  let n = 0;
  const link = (from?: string, to?: string) => {
    if (from && to && from !== to) edges.push({ id: `e${++n}`, from, to });
  };

  // 1) routers meshed together for redundancy
  for (let i = 0; i < routers.length - 1; i++) link(routers[i].id, routers[i + 1].id);

  // 2) firewall(s) hang off the first router
  firewalls.forEach((fw) => link(routers[0]?.id, fw.id));

  // 3) the "core" the switching layer connects to: firewall if present, else first router
  const core = firewalls[0]?.id ?? routers[0]?.id;

  // 4) every switch connects up to the core
  switches.forEach((sw) => link(core, sw.id));

  // 5) endpoints distributed across switches (round-robin); if no switch, attach to core
  const parents = switches.length ? switches.map((s) => s.id) : core ? [core] : [];
  endpoints.forEach((e, i) => link(parents.length ? parents[i % parents.length] : undefined, e.id));

  return edges;
}

/**
 * Tiered layout for React Flow positions. Each device type sits on its own
 * tier (top -> bottom), and crowded tiers (e.g. 25 PCs) WRAP onto multiple
 * sub-rows so nothing overflows horizontally. Every row is centered around
 * x=0 so the tree stays balanced.
 */
function layoutOf(devices: Device[]): Record<string, { x: number; y: number }> {
  const ORDER: DeviceType[] = ["ROUTER", "FIREWALL", "SWITCH", "SERVER", "AP", "PC"];
  const GAP_X = 180;
  const GAP_Y = 150;
  const MAX_PER_ROW = 10;

  const groups = ORDER.map((type) => ({
    type,
    ids: devices.filter((d) => d.type === type).map((d) => d.id),
  })).filter((g) => g.ids.length > 0);

  const layout: Record<string, { x: number; y: number }> = {};
  let y = 0;

  for (const group of groups) {
    const { ids } = group;
    const perRow = Math.min(ids.length, MAX_PER_ROW);
    const subRows = Math.ceil(ids.length / perRow);
    for (let r = 0; r < subRows; r++) {
      const rowIds = ids.slice(r * perRow, (r + 1) * perRow);
      const rowWidth = (rowIds.length - 1) * GAP_X;
      rowIds.forEach((id, i) => {
        layout[id] = { x: i * GAP_X - rowWidth / 2, y };
      });
      y += GAP_Y;
    }
  }

  return layout;
}

/** Keep only connections that reference real device ids. */
function validConnections(
  pairs: { from: string; to: string }[],
  devices: Device[],
): Connection[] {
  const ids = new Set(devices.map((d) => d.id));
  return pairs
    .filter((c) => ids.has(c.from) && ids.has(c.to) && c.from !== c.to)
    .map((c, i) => ({ id: `e${i + 1}`, from: c.from, to: c.to }));
}

export function buildTopology(input: ParsedIntent | Topology): BuiltTopology {
  const devices = isIntent(input) ? expandDevices(input) : input.devices;

  // Use explicit connections ONLY when they reference real devices; otherwise
  // fall back to inferred wiring. (AI often returns labels that don't match
  // our generated ids, which would render as zero edges.)
  let connections: Connection[];
  const explicit = isIntent(input) ? input.explicitConnections ?? [] : input.connections;
  const valid = validConnections(explicit, devices);
  connections = valid.length ? valid : inferConnections(devices);

  return { devices, connections, layout: layoutOf(devices) };
}