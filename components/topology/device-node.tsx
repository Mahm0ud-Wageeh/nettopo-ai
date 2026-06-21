"use client";
import { Handle, Position } from "reactflow";
import { Router, Network, Server, Monitor, Shield, Wifi } from "lucide-react";
import type { DeviceType } from "@/lib/network-engine/types";

const ICONS: Record<DeviceType, typeof Router> = {
  ROUTER: Router, SWITCH: Network, SERVER: Server, PC: Monitor, FIREWALL: Shield, AP: Wifi,
};
const COLORS: Record<DeviceType, string> = {
  ROUTER: "bg-blue-500", SWITCH: "bg-emerald-500", SERVER: "bg-violet-500",
  PC: "bg-slate-500", FIREWALL: "bg-red-500", AP: "bg-amber-500",
};

export function DeviceNode({ data }: { data: { label: string; type: DeviceType } }) {
  const Icon = ICONS[data.type];
  return (
    <div className="flex flex-col items-center gap-1">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className={`grid h-12 w-12 place-items-center rounded-xl text-white shadow ${COLORS[data.type]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-xs font-medium">{data.label}</span>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}
