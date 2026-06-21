export type DeviceType = "ROUTER" | "SWITCH" | "SERVER" | "PC" | "FIREWALL" | "AP";

export interface Device {
  id: string;
  label: string;
  type: DeviceType;
  meta?: Record<string, unknown>;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  meta?: Record<string, unknown>;
}

export interface Subnet { name: string; cidr: string; mask: string; range: string; }
export interface VlanEntry { id: number; name: string; subnet: string; }

export interface NetworkPlan {
  ipPlan: { base: string; subnets: Subnet[] };
  vlanPlan: VlanEntry[];
  routing: { protocol: string; routes: string[] };
  notes?: string[];
}

export interface Topology { devices: Device[]; connections: Connection[]; }
export interface GeneratedProject extends Topology { network_plan: NetworkPlan; }

// --- AI engine intent types (Phase 5) ---
export interface IntentDevice { type: DeviceType; count: number; }

export interface ParsedIntent {
  devices: IntentDevice[];
  explicitConnections?: { from: string; to: string }[];
  options: { vlan: boolean; routingProtocol?: string };
}

export interface BuiltTopology extends Topology {
  layout?: Record<string, { x: number; y: number }>;
}
