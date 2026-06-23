import type {
  BuiltTopology,
  Device,
  DeviceType,
  NetworkPlan,
} from "@/lib/network-engine/types";
import { intToIp, ipToInt, maskFromPrefix } from "@/lib/network-engine/ip-planner";

// Which VLAN each device role belongs to (matches vlan-planner VLAN_DEFS).
const TYPE_VLAN: Record<DeviceType, number> = {
  PC: 10,
  IP_PHONE: 10,
  SERVER: 20,
  NVR: 20,
  PRINTER: 30,
  CAMERA: 40,
  AP: 60,
  ROUTER: 99,
  SWITCH: 99,
  FIREWALL: 99,
};

// Endpoint roles that get an IP from a switch access port (not CLI-configured).
const ENDPOINT_TYPES: DeviceType[] = [
  "PC",
  "SERVER",
  "AP",
  "PRINTER",
  "CAMERA",
  "NVR",
  "IP_PHONE",
];

// Shared admin credentials used across generated configs (demo / lab values).
const ADMIN_USER = "admin";
const ADMIN_PASS = "Admin123";
const ENABLE_SECRET = "Cisco123";
const DOMAIN_NAME = "nettopo.local";

export interface IfaceAssignment {
  name: string;
  ip: string;
  mask: string;
  vlanId?: number;
}

export interface DeviceAddressing {
  deviceId: string;
  label: string;
  type: DeviceType;
  vlanId?: number;
  vlanName?: string;
  gateway?: string;
  interfaces: IfaceAssignment[];
}

export interface SubnetInfo {
  vlanId?: number;
  name: string;
  network: number;
  prefix: number;
  mask: string;
  gateway: string;
  cidr: string;
}

export interface Addressing {
  mode: "vlan" | "flat";
  subnets: SubnetInfo[];
  byDevice: Record<string, DeviceAddressing>;
}

function parseCidr(cidr: string): { network: number; prefix: number } {
  const parts = cidr.split("/");
  return { network: ipToInt(parts[0]), prefix: parseInt(parts[1], 10) };
}

function wildcardFromPrefix(prefix: number): string {
  const maskInt = ipToInt(maskFromPrefix(prefix));
  return intToIp((~maskInt) >>> 0);
}

function hostIfaceName(type: DeviceType): string {
  if (type === "SWITCH") return "Vlan99";
  return "FastEthernet0";
}

/**
 * Assigns a concrete IP address to every device based on the network plan.
 * - VLAN mode (router-on-a-stick): one subnet per VLAN, gateway = network + 1.
 * - Flat mode: a single LAN subnet for all devices.
 */
export function assignAddressing(topology: BuiltTopology, plan: NetworkPlan): Addressing {
  const devices = topology.devices;
  const mode: "vlan" | "flat" = plan.vlanPlan.length ? "vlan" : "flat";
  const subnets: SubnetInfo[] = [];

  if (mode === "vlan") {
    for (const v of plan.vlanPlan) {
      const cidr = parseCidr(v.subnet);
      subnets.push({
        vlanId: v.id,
        name: v.name,
        network: cidr.network,
        prefix: cidr.prefix,
        mask: maskFromPrefix(cidr.prefix),
        gateway: intToIp(cidr.network + 1),
        cidr: v.subnet,
      });
    }
  } else {
    const s = plan.ipPlan.subnets[0];
    const cidr = parseCidr(s.cidr);
    subnets.push({
      name: "LAN",
      network: cidr.network,
      prefix: cidr.prefix,
      mask: maskFromPrefix(cidr.prefix),
      gateway: intToIp(cidr.network + 1),
      cidr: s.cidr,
    });
  }

  const subnetFor = (d: Device): SubnetInfo => {
    if (mode === "flat") return subnets[0];
    const vlanId = TYPE_VLAN[d.type];
    return subnets.find((s) => s.vlanId === vlanId) ?? subnets[0];
  };

  // Host pointer per subnet; .1 is reserved for the gateway so hosts start at .2
  const cursor: Record<string, number> = {};
  for (const s of subnets) cursor[s.cidr] = s.network + 2;
  const nextHost = (s: SubnetInfo) => intToIp(cursor[s.cidr]++);

  const byDevice: Record<string, DeviceAddressing> = {};
  const gatewayRouterId = devices.find((d) => d.type === "ROUTER")?.id;

  for (const d of devices) {
    if (d.type === "ROUTER" && d.id === gatewayRouterId) {
      // The gateway router owns every subnet's gateway address.
      const interfaces: IfaceAssignment[] = subnets.map((s) => ({
        name: mode === "vlan" ? `GigabitEthernet0/0.${s.vlanId}` : "GigabitEthernet0/0",
        ip: s.gateway,
        mask: s.mask,
        vlanId: s.vlanId,
      }));
      byDevice[d.id] = {
        deviceId: d.id,
        label: d.label,
        type: d.type,
        interfaces,
      };
      continue;
    }

    const s = subnetFor(d);
    const ip = nextHost(s);
    byDevice[d.id] = {
      deviceId: d.id,
      label: d.label,
      type: d.type,
      vlanId: s.vlanId,
      vlanName: s.name,
      gateway: s.gateway,
      interfaces: [{ name: hostIfaceName(d.type), ip, mask: s.mask, vlanId: s.vlanId }],
    };
  }

  return { mode, subnets, byDevice };
}

export interface DeviceConfig {
  deviceId: string;
  hostname: string;
  type: DeviceType;
  cli: string;
}

export interface HostRow {
  device: string;
  ip: string;
  mask: string;
  gateway: string;
  vlanId?: number;
}

export interface CiscoExport {
  configs: DeviceConfig[];
  hostTable: HostRow[];
  combined: string;
}

/** Hardening block shared by routers and switches (SSH, login, banner). */
function securityBlock(): string[] {
  return [
    "! --- Basic hardening + SSH remote management ---",
    `enable secret ${ENABLE_SECRET}`,
    "service password-encryption",
    `ip domain-name ${DOMAIN_NAME}`,
    "crypto key generate rsa modulus 1024",
    `username ${ADMIN_USER} privilege 15 secret ${ADMIN_PASS}`,
    "banner motd #NetTopo AI - Authorized access only#",
    "line vty 0 4",
    " login local",
    " transport input ssh",
    "exit",
    "!",
  ];
}

function routerConfig(
  dev: Device,
  addr: Addressing,
  plan: NetworkPlan,
  isGateway: boolean,
): string {
  const lines: string[] = [
    "enable",
    "configure terminal",
    `hostname ${dev.label}`,
    "no ip domain-lookup",
    "!",
    ...securityBlock(),
  ];

  if (isGateway) {
    if (addr.mode === "vlan") {
      lines.push("interface GigabitEthernet0/0", " no shutdown", "exit", "!");
      for (const s of addr.subnets) {
        lines.push(
          `interface GigabitEthernet0/0.${s.vlanId}`,
          ` encapsulation dot1Q ${s.vlanId}`,
          ` ip address ${s.gateway} ${s.mask}`,
          "exit",
          "!",
        );
      }

      // DHCP pool per VLAN so endpoints get an address automatically.
      lines.push("! --- DHCP pools (endpoints can use DHCP instead of static) ---");
      for (const s of addr.subnets) {
        if (s.vlanId === 99) continue; // management VLAN stays static
        lines.push(
          `ip dhcp excluded-address ${s.gateway} ${intToIp(s.network + 5)}`,
          `ip dhcp pool ${s.name}`,
          ` network ${intToIp(s.network)} ${s.mask}`,
          ` default-router ${s.gateway}`,
          " dns-server 8.8.8.8",
          "exit",
          "!",
        );
      }
    } else {
      const s = addr.subnets[0];
      lines.push(
        "interface GigabitEthernet0/0",
        ` ip address ${s.gateway} ${s.mask}`,
        " no shutdown",
        "exit",
        "!",
        `ip dhcp pool ${s.name}`,
        ` network ${intToIp(s.network)} ${s.mask}`,
        ` default-router ${s.gateway}`,
        " dns-server 8.8.8.8",
        "exit",
        "!",
      );
    }

    if (plan.routing.protocol === "OSPF") {
      lines.push("router ospf 1");
      for (const s of addr.subnets) {
        lines.push(` network ${intToIp(s.network)} ${wildcardFromPrefix(s.prefix)} area 0`);
      }
      lines.push("exit", "!");
    }
  } else {
    lines.push("! Additional router - connect a WAN link to the gateway router, then:");
    lines.push("! interface <wan-interface>", "!  ip address <wan-ip> <wan-mask>", "!  no shutdown", "!");
  }

  lines.push("end", "write memory");
  return lines.join("\n");
}

function switchConfig(dev: Device, addr: Addressing, topology: BuiltTopology): string {
  const lines: string[] = [
    "enable",
    "configure terminal",
    `hostname ${dev.label}`,
    "no ip domain-lookup",
    "!",
    ...securityBlock(),
  ];

  if (addr.mode === "vlan") {
    for (const s of addr.subnets) {
      lines.push(`vlan ${s.vlanId}`, ` name ${s.name}`, "exit", "!");
    }

    // Endpoints physically attached to this switch -> access ports.
    const attached = topology.connections
      .map((c) => (c.from === dev.id ? c.to : c.to === dev.id ? c.from : null))
      .filter((id): id is string => Boolean(id))
      .map((id) => topology.devices.find((d) => d.id === id))
      .filter((d): d is Device => Boolean(d) && ENDPOINT_TYPES.includes(d!.type));

    let port = 1;
    for (const e of attached) {
      const vlanId = TYPE_VLAN[e.type];
      lines.push(
        `interface FastEthernet0/${port}`,
        " switchport mode access",
        ` switchport access vlan ${vlanId}`,
        " switchport port-security",
        " switchport port-security maximum 2",
        " switchport port-security violation restrict",
        " no shutdown",
        "exit",
        "!",
      );
      port++;
    }

    // Uplink trunk to the router carrying every VLAN.
    const vlanList = addr.subnets.map((s) => s.vlanId).filter(Boolean).join(",");
    lines.push(
      "interface GigabitEthernet0/1",
      " switchport mode trunk",
      vlanList ? ` switchport trunk allowed vlan ${vlanList}` : " ",
      " no shutdown",
      "exit",
      "!",
    );

    // Management SVI on VLAN 99.
    const mgmt = addr.byDevice[dev.id]?.interfaces[0];
    const mgmtSubnet = addr.subnets.find((s) => s.vlanId === 99);
    if (mgmt && mgmtSubnet) {
      lines.push(
        "interface Vlan99",
        ` ip address ${mgmt.ip} ${mgmtSubnet.mask}`,
        " no shutdown",
        "exit",
        `ip default-gateway ${mgmtSubnet.gateway}`,
        "!",
      );
    }
  } else {
    lines.push("! Flat network - all ports stay in the default VLAN 1.", "!");
  }

  lines.push("end", "write memory");
  return lines.join("\n");
}

/** Generates paste-ready Cisco IOS configs plus a host addressing table. */
export function generateCiscoConfigs(
  topology: BuiltTopology,
  plan: NetworkPlan,
  addressing?: Addressing,
): CiscoExport {
  const addr = addressing ?? assignAddressing(topology, plan);
  const configs: DeviceConfig[] = [];
  const gatewayRouterId = topology.devices.find((d) => d.type === "ROUTER")?.id;

  for (const dev of topology.devices) {
    if (dev.type === "ROUTER" || dev.type === "FIREWALL") {
      configs.push({
        deviceId: dev.id,
        hostname: dev.label,
        type: dev.type,
        cli: routerConfig(dev, addr, plan, dev.id === gatewayRouterId),
      });
    } else if (dev.type === "SWITCH") {
      configs.push({
        deviceId: dev.id,
        hostname: dev.label,
        type: dev.type,
        cli: switchConfig(dev, addr, topology),
      });
    }
  }

  // Endpoints are configured from their IP-config panel in Packet Tracer.
  const hostTable: HostRow[] = topology.devices
    .filter((d) => ENDPOINT_TYPES.includes(d.type))
    .map((d) => {
      const a = addr.byDevice[d.id];
      return {
        device: d.label,
        ip: a?.interfaces[0]?.ip ?? "",
        mask: a?.interfaces[0]?.mask ?? "",
        gateway: a?.gateway ?? "",
        vlanId: a?.vlanId,
      };
    });

  // Cable plan derived from the topology (what to plug where).
  const cableLines = topology.connections.map((c) => {
    const from = topology.devices.find((d) => d.id === c.from)?.label ?? c.from;
    const to = topology.devices.find((d) => d.id === c.to)?.label ?? c.to;
    const cable = (c.meta?.cableType as string) ?? "Straight-through";
    return `${from} <-> ${to}\t${cable}`;
  });

  const blocks = configs.map((c) => `! ===== ${c.hostname} (${c.type}) =====\n${c.cli}`);
  const hostLines = hostTable.map(
    (h) => `${h.device}\tIP: ${h.ip}\tMask: ${h.mask}\tGateway: ${h.gateway}` + (h.vlanId ? `\tVLAN: ${h.vlanId}` : ""),
  );
  const combined = [
    "! NetTopo AI - Cisco IOS configuration export",
    "! Paste each block into the matching device CLI (Packet Tracer / GNS3 / real IOS).",
    `! Default login -> user: ${ADMIN_USER}  pass: ${ADMIN_PASS}  enable: ${ENABLE_SECRET}`,
    "",
    "! ===== Cabling plan (what to plug where) =====",
    ...cableLines,
    "",
    ...blocks,
    "",
    "! ===== End devices (set these from each PC/Server/Printer IP Configuration) =====",
    ...hostLines,
    "",
  ].join("\n");

  return { configs, hostTable, combined };
}