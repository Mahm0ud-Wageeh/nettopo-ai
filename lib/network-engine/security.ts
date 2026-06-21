import type { Device } from "@/lib/network-engine/types";

export function securityNotes(devices: Device[]): string[] {
  const notes: string[] = [];
  const has = (t: string) => devices.some((d) => d.type === t);

  if (!has("FIREWALL")) notes.push("No firewall detected -- add one at the network edge.");
  if (has("SERVER")) notes.push("Place servers on a dedicated VLAN and restrict access with ACLs.");
  if (has("AP")) notes.push("Isolate the guest Wi-Fi VLAN from internal subnets.");
  notes.push("Disable unused switch ports and enable port security.");
  notes.push("Use SSH (not Telnet) and a dedicated management VLAN (99).");
  return notes;
}
