import type { Device, VlanEntry } from "@/lib/network-engine/types";

export function suggestRouting(
  devices: Device[],
  vlans: VlanEntry[],
  preferred?: string,
): { protocol: string; routes: string[] } {
  const routers = devices.filter((d) => d.type === "ROUTER").length;

  // Heuristic: 1 router -> static; many -> OSPF (scales best of the free options)
  const protocol = preferred ?? (routers <= 1 ? "STATIC" : "OSPF");

  const routes = vlans.map((v) =>
    protocol === "STATIC"
      ? `ip route ${v.subnet} via <gateway>`
      : `network ${v.subnet} area 0`,
  );
  return { protocol, routes };
}
