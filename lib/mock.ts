import type { GeneratedProject } from "@/lib/network-engine/types";

export const mockProjects = [
  { id: "demo-1", name: "Campus LAN", source: "PROMPT", updatedAt: "2026-06-20" },
  { id: "demo-2", name: "Branch Office", source: "MANUAL", updatedAt: "2026-06-18" },
];

export const mockGenerated: GeneratedProject = {
  devices: [
    { id: "R1", label: "R1", type: "ROUTER" },
    { id: "SW1", label: "SW1", type: "SWITCH" },
    { id: "SRV1", label: "SRV1", type: "SERVER" },
    { id: "PC1", label: "PC1", type: "PC" },
    { id: "PC2", label: "PC2", type: "PC" },
  ],
  connections: [
    { id: "e1", from: "R1", to: "SW1" },
    { id: "e2", from: "SW1", to: "SRV1" },
    { id: "e3", from: "SW1", to: "PC1" },
    { id: "e4", from: "SW1", to: "PC2" },
  ],
  network_plan: {
    ipPlan: {
      base: "192.168.0.0/24",
      subnets: [
        { name: "VLAN10-USERS", cidr: "192.168.10.0/24", mask: "255.255.255.0", range: "192.168.10.1 - .254" },
        { name: "VLAN20-SERVERS", cidr: "192.168.20.0/24", mask: "255.255.255.0", range: "192.168.20.1 - .254" },
      ],
    },
    vlanPlan: [
      { id: 10, name: "USERS", subnet: "192.168.10.0/24" },
      { id: 20, name: "SERVERS", subnet: "192.168.20.0/24" },
    ],
    routing: { protocol: "OSPF", routes: ["area 0: 192.168.10.0/24", "area 0: 192.168.20.0/24"] },
    notes: ["Place servers on a dedicated VLAN.", "Add an ACL between USERS and SERVERS."],
  },
};
