import type {
  BuiltTopology,
  CableType,
  Connection,
  Device,
  DeviceType,
  ParsedIntent,
  Topology,
} from "@/lib/network-engine/types";

const PREFIX: Record<DeviceType, string> = {
  ROUTER: "R",
  SWITCH: "SW",
  SERVER: "SRV",
  PC: "PC",
  FIREWALL: "FW",
  AP: "AP",
  PRINTER: "PRN",
  CAMERA: "CAM",
  NVR: "NVR",
  IP_PHONE: "PH",
};

// Endpoint roles hang off a switch just like a PC does.
const ENDPOINT_TYPES: DeviceType[] = [
  "PC",
  "SERVER",
  "AP",
  "PRINTER",
  "CAMERA",
  "NVR",
  "IP_PHONE",
];

function isIntent(input: ParsedIntent | Topology): input is ParsedIntent {
  return "options" in input;
}

/**
 * Pick the right cable for a link based on the two device roles.
 *  - Two routers (a WAN-style link) -> Serial
 *  - Same role on both ends (Switch<->Switch) -> Crossover
 *  - Different roles (PC<->Switch, Switch<->Router) -> Straight-through
 */
export function cableFor(a: DeviceType, b: DeviceType): CableType {
  if (a === "ROUTER" && b === "ROUTER") return "Serial";
  if (a === b) return "Crossover";
  return "Straight-through";
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
 *   routers (meshed) -> firewall -> switches -> endpoints
 * If a layer is missing it is skipped, so the tree stays connected.
 */
function inferConnections(devices: Device[]): { from: string; to: string }[] {
  const byType = (t: DeviceType) => devices.filter((d) => d.type === t);
  const routers = byType("ROUTER");
  const firewalls = byType("FIREWALL");
  const switches = byType("SWITCH");
  const endpoints = devices.filter((d) => ENDPOINT_TYPES.includes(d.type));

  const edges: { from: string; to: string }[] = [];
  const link = (from?: string, to?: string) => {
    if (from && to && from !== to) edges.push({ from, to });
  };

  // 1) routers meshed together for redundancy
  for (let i = 0; i < routers.length - 1; i++)
    link(routers[i].id, routers[i + 1].id);

  // 2) firewall(s) hang off the first router
  firewalls.forEach((fw) => link(routers[0]?.id, fw.id));

  // 3) the "core" the switching layer connects to: firewall if present, else first router
  const core = firewalls[0]?.id ?? routers[0]?.id;

  // 4) every switch connects up to the core
  switches.forEach((sw) => link(core, sw.id));

  // 5) endpoints distributed across switches (round-robin); if no switch, attach to core
  const parents = switches.length
    ? switches.map((s) => s.id)
    : core
      ? [core]
      : [];
  endpoints.forEach((e, i) =>
    link(parents.length ? parents[i % parents.length] : undefined, e.id),
  );

  return edges;
}

/**
 * Connection-aware "tidy tree" layout for React Flow positions.
 *
 * The old version dropped every device of a type onto one wide row and wired
 * endpoints to switches round-robin, so the links crossed all over each other.
 * Here we lay the topology out as a real tree instead: pick a root
 * (router -> firewall -> switch), walk the links with a BFS to find each
 * node's depth (tier) and children, then place leaves left-to-right and center
 * every parent directly above its own children. Links fan out cleanly downward
 * instead of tangling. The whole tree is centered on x = 0.
 */
function layoutOf(
  devices: Device[],
  pairs: { from: string; to: string }[],
): Record<string, { x: number; y: number }> {
  const GAP_X = 150; // horizontal slot per leaf node
  const GAP_Y = 170; // vertical distance between tiers

  if (devices.length === 0) return {};

  // Build an undirected adjacency map from the real links.
  const adj = new Map<string, string[]>();
  devices.forEach((d) => adj.set(d.id, []));
  for (const p of pairs) {
    if (adj.has(p.from) && adj.has(p.to)) {
      adj.get(p.from)!.push(p.to);
      adj.get(p.to)!.push(p.from);
    }
  }

  // Pick a sensible root: the network "top" if we have one.
  const firstOf = (t: DeviceType) => devices.find((d) => d.type === t)?.id;
  const rootId =
    firstOf("ROUTER") ??
    firstOf("FIREWALL") ??
    firstOf("SWITCH") ??
    devices[0].id;

  // BFS spanning tree -> depth (tier) + ordered children for every node.
  const depth = new Map<string, number>();
  const children = new Map<string, string[]>();
  devices.forEach((d) => children.set(d.id, []));
  const visited = new Set<string>([rootId]);
  depth.set(rootId, 0);
  const queue: string[] = [rootId];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const next of adj.get(cur) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        depth.set(next, (depth.get(cur) ?? 0) + 1);
        children.get(cur)!.push(next);
        queue.push(next);
      }
    }
  }

  // Place leaves left-to-right; center each parent over its children.
  const xOf = new Map<string, number>();
  let cursor = 0;
  const place = (id: string) => {
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      xOf.set(id, cursor * GAP_X);
      cursor += 1;
      return;
    }
    kids.forEach(place);
    const first = xOf.get(kids[0]) ?? 0;
    const last = xOf.get(kids[kids.length - 1]) ?? 0;
    xOf.set(id, (first + last) / 2);
  };
  place(rootId);

  // Devices the root can't reach (e.g. unconnected) sit on their own top row.
  devices
    .filter((d) => !visited.has(d.id))
    .forEach((d) => {
      xOf.set(d.id, cursor * GAP_X);
      depth.set(d.id, 0);
      cursor += 1;
    });

  // Center the whole drawing horizontally around x = 0.
  const xs = [...xOf.values()];
  const mid = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;

  const layout: Record<string, { x: number; y: number }> = {};
  for (const d of devices) {
    layout[d.id] = {
      x: (xOf.get(d.id) ?? 0) - mid,
      y: (depth.get(d.id) ?? 0) * GAP_Y,
    };
  }
  return layout;
}

/** Keep only connections that reference real device ids. */
function validConnections(
  pairs: { from: string; to: string }[],
  devices: Device[],
): { from: string; to: string }[] {
  const ids = new Set(devices.map((d) => d.id));
  return pairs.filter(
    (c) => ids.has(c.from) && ids.has(c.to) && c.from !== c.to,
  );
}

/** Attach an id + recommended cable type to each from/to pair. */
function toConnections(
  pairs: { from: string; to: string }[],
  devices: Device[],
): Connection[] {
  const typeOf = new Map(devices.map((d) => [d.id, d.type] as const));
  return pairs.map((c, i) => {
    const a = typeOf.get(c.from);
    const b = typeOf.get(c.to);
    const cableType = a && b ? cableFor(a, b) : "Straight-through";
    return { id: `e${i + 1}`, from: c.from, to: c.to, meta: { cableType } };
  });
}

export function buildTopology(input: ParsedIntent | Topology): BuiltTopology {
  const devices = isIntent(input) ? expandDevices(input) : input.devices;

  // Use explicit connections ONLY when they reference real devices; otherwise
  // fall back to inferred wiring. (AI often returns labels that don't match
  // our generated ids, which would render as zero edges.)
  const explicit = isIntent(input)
    ? (input.explicitConnections ?? [])
    : input.connections;
  const valid = validConnections(explicit, devices);
  const pairs = valid.length ? valid : inferConnections(devices);

  return {
    devices,
    connections: toConnections(pairs, devices),
    layout: layoutOf(devices, pairs),
  };
}