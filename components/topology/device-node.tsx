"use client";
import { Handle, Position } from "reactflow";
import {
  Router,
  Network,
  Server,
  Monitor,
  Shield,
  Wifi,
  Printer,
  Camera,
  Video,
  Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceType } from "@/lib/network-engine/types";

const ICONS: Record<DeviceType, typeof Router> = {
  ROUTER: Router,
  SWITCH: Network,
  SERVER: Server,
  PC: Monitor,
  FIREWALL: Shield,
  AP: Wifi,
  PRINTER: Printer,
  CAMERA: Camera,
  NVR: Video,
  IP_PHONE: Phone,
};
const COLORS: Record<DeviceType, string> = {
  ROUTER: "bg-blue-500",
  SWITCH: "bg-emerald-500",
  SERVER: "bg-violet-500",
  PC: "bg-slate-500",
  FIREWALL: "bg-red-500",
  AP: "bg-amber-500",
  PRINTER: "bg-cyan-600",
  CAMERA: "bg-pink-600",
  NVR: "bg-fuchsia-700",
  IP_PHONE: "bg-teal-600",
};
const STATUS_DOT: Record<string, string> = {
  online: "bg-emerald-400",
  degraded: "bg-amber-400",
  offline: "bg-red-500",
};

export function DeviceNode({
  data,
}: {
  data: {
    label: string;
    type: DeviceType;
    selected?: boolean;
    status?: "online" | "degraded" | "offline";
  };
}) {
  const Icon = ICONS[data.type] ?? Monitor;
  const color = COLORS[data.type] ?? "bg-slate-500";
  const dot = STATUS_DOT[data.status ?? "online"] ?? "bg-emerald-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-muted-foreground"
      />
      <div
        className={cn(
          "relative grid h-12 w-12 place-items-center rounded-xl text-white shadow transition-all",
          color,
          data.selected &&
            "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      >
        <Icon className="h-6 w-6" />
        <span
          className={cn(
            "absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background",
            dot,
          )}
        />
      </div>
      <span
        className={cn("text-xs font-medium", data.selected && "text-primary")}
      >
        {data.label}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-muted-foreground"
      />
    </div>
  );
}