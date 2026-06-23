import type { Subnet } from "@/lib/network-engine/types";

export function ipToInt(ip: string): number {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + (parseInt(oct, 10) & 255), 0) >>> 0;
}

export function intToIp(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}

export function maskFromPrefix(prefix: number): string {
  let mask = 0;
  for (let i = 0; i < prefix; i++) mask |= 1 << (31 - i);
  return intToIp(mask >>> 0);
}

/** Smallest prefix that fits `hosts` usable addresses (reserves network+broadcast). */
export function prefixForHosts(hosts: number): number {
  let prefix = 30; // /30 = 2 usable
  while (2 ** (32 - prefix) - 2 < hosts && prefix > 0) prefix--;
  return prefix;
}

export interface SubnetRequirement { name: string; hosts: number; }

/** VLSM: allocate largest blocks first, contiguous from baseIp. */
export function allocateSubnets(baseIp: string, requirements: SubnetRequirement[]): Subnet[] {
  let cursor = ipToInt(baseIp);
  const ordered = [...requirements].sort((a, b) => b.hosts - a.hosts);
  return ordered.map((req) => {
    const prefix = prefixForHosts(req.hosts);
    const size = 2 ** (32 - prefix);
    const network = cursor;
    cursor += size; // advance to next block
    return {
      name: req.name,
      cidr: `${intToIp(network)}/${prefix}`,
      mask: maskFromPrefix(prefix),
      range: `${intToIp(network + 1)} - ${intToIp(network + size - 2)}`,
    };
  });
}