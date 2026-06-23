"use client";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  MarkerType,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { Download, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeviceNode } from "@/components/topology/device-node";
import type { BuiltTopology, CableType } from "@/lib/network-engine/types";
import type { NodeStatus } from "@/lib/network-engine/preflight";

const nodeTypes = { device: DeviceNode };
const FIT_OPTIONS = { padding: 0.25 };

const CABLE_COLOR: Record<CableType, string> = {
  "Straight-through": "#94a3b8",
  Crossover: "#2563eb",
  Serial: "#dc2626",
  Console: "#0ea5e9",
  Fiber: "#ea580c",
};

function toNodes(
  topology: BuiltTopology,
  status: Record<string, NodeStatus>,
  selectedId?: string | null,
): Node[] {
  return topology.devices.map((d) => ({
    id: d.id,
    type: "device",
    position: topology.layout?.[d.id] ?? { x: 0, y: 0 },
    data: {
      label: d.label,
      type: d.type,
      selected: d.id === selectedId,
      status: status[d.id] ?? "online",
    },
  }));
}

function toEdges(topology: BuiltTopology, selectedId?: string | null): Edge[] {
  return topology.connections.map((c) => {
    const cable = (c.meta?.cableType as CableType) ?? "Straight-through";
    const color = CABLE_COLOR[cable] ?? "#94a3b8";
    const active =
      !!selectedId && (c.from === selectedId || c.to === selectedId);
    const dim = !!selectedId && !active;
    const dash = cable === "Straight-through" ? "6 4" : undefined;
    return {
      id: c.id,
      source: c.from,
      target: c.to,
      type: "smoothstep",
      animated: active,
      style: {
        stroke: color,
        strokeWidth: active ? 2.5 : 1.5,
        opacity: dim ? 0.3 : 0.85,
        strokeDasharray: dash,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    };
  });
}

function ToolBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

export function TopologyBoard({
  topology,
  status,
  counts,
  selectedId,
  onSelectDevice,
  onDownload,
}: {
  topology: BuiltTopology;
  status: Record<string, NodeStatus>;
  counts: { online: number; degraded: number; offline: number };
  selectedId: string | null;
  onSelectDevice: (id: string | null) => void;
  onDownload: () => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    toNodes(topology, status, selectedId),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    toEdges(topology, selectedId),
  );
  const [rf, setRf] = useState<ReactFlowInstance | null>(null);

  useEffect(() => {
    setNodes(toNodes(topology, status, selectedId));
    setEdges(toEdges(topology, selectedId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology, status, selectedId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_e: unknown, node: Node) => onSelectDevice(node.id),
    [onSelectDevice],
  );
  const onPaneClick = useCallback(() => onSelectDevice(null), [onSelectDevice]);
  const fitView = useCallback(() => rf?.fitView(FIT_OPTIONS), [rf]);

  return (
    <div className="relative h-full w-full bg-muted/10">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        onInit={setRf}
        fitView
        fitViewOptions={FIT_OPTIONS}
        minZoom={0.2}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#cbd5e1"
        />
      </ReactFlow>

      <div className="absolute left-4 top-4 flex items-center gap-0.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
        <ToolBtn label="Zoom in" onClick={() => rf?.zoomIn()}>
          <ZoomIn className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn label="Zoom out" onClick={() => rf?.zoomOut()}>
          <ZoomOut className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn label="Fit view" onClick={fitView}>
          <Maximize2 className="h-4 w-4" />
        </ToolBtn>
        <ToolBtn label="Export config" onClick={onDownload}>
          <Download className="h-4 w-4" />
        </ToolBtn>
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-4 rounded-lg border bg-background/90 px-4 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur">
        <LegendDot color="bg-emerald-400" label={`${counts.online} Online`} />
        <LegendDot color="bg-amber-400" label={`${counts.degraded} Degraded`} />
        <LegendDot color="bg-red-500" label={`${counts.offline} Offline`} />
      </div>
    </div>
  );
}