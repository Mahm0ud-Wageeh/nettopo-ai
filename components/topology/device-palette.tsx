"use client";
import { Router, Network, Server, Monitor, Shield, Wifi } from "lucide-react";
import type { DeviceType } from "@/lib/network-engine/types";

const PALETTE: { type: DeviceType; label: string; icon: typeof Router }[] = [
  { type: "ROUTER", label: "Router", icon: Router },
  { type: "SWITCH", label: "Switch", icon: Network },
  { type: "SERVER", label: "Server", icon: Server },
  { type: "PC", label: "PC", icon: Monitor },
  { type: "FIREWALL", label: "Firewall", icon: Shield },
  { type: "AP", label: "Access Point", icon: Wifi },
];

export function DevicePalette({ onAdd }: { onAdd: (type: DeviceType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {PALETTE.map((p) => (
        <button
          key={p.type}
          onClick={() => onAdd(p.type)}
          className="flex items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted"
        >
          <p.icon className="h-4 w-4" /> {p.label}
        </button>
      ))}
    </div>
  );
}
