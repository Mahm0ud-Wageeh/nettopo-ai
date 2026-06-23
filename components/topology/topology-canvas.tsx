"use client";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeviceNode } from "@/components/topology/device-node";
import type { BuiltTopology, CableType } from "@/lib/network-engine/types";
import type { Addressing } from "@/lib/network-engine/cisco";

const nodeTypes = { device: DeviceNode };
const fitViewOptions = { padding: 0.2 };

// Cable type -> edge color (matches the Cisco wiring guide).
const CABLE_COLOR: Record<CableType, string> = {
  "Straight-through": "#334155", // slate
  Crossover: "#2563eb", // blue
  Serial: "#dc2626", // red
  Console: "#0ea5e9", // sky
  Fiber: "#ea580c", // orange
};

function toNodes(topology: BuiltTopology, selectedId?: string | null): Node[] {
  return topology.devices.map((d) => ({
    id: d.id,
    type: "device",
    position: topology.layout?.[d.id] ?? { x: 0, y: 0 },
    data: { label: d.label, type: d.type, selected: d.id === selectedId },
  }));
}

function toEdges(topology: BuiltTopology, selectedId?: string | null): Edge[] {
  return topology.connections.map((c) => {
    const cable = (c.meta?.cableType as CableType) ?? "Straight-through";
    const color = CABLE_COLOR[cable] ?? "#334155";
    const active = !!selectedId && (c.from === selectedId || c.to === selectedId);
    const dim = !!selectedId && !active;
    return {
      id: c.id,
      source: c.from,
      target: c.to,
      label: cable,
      animated: active,
      labelStyle: { fontSize: 10, fill: color, fontWeight: 600 },
      labelBgStyle: { fill: "#ffffff", fillOpacity: 0.8 },
      style: { stroke: color, strokeWidth: active ? 3 : 2, opacity: dim ? 0.35 : 1 },
      markerEnd: { type: MarkerType.ArrowClosed, color },
    };
  });
}

export function TopologyCanvas({
  topology,
  addressing,
  selectedId,
  onSelectDevice,
  className,
}: {
  topology: BuiltTopology;
  addressing?: Addressing;
  selectedId?: string | null;
  onSelectDevice?: (id: string | null) => void;
  className?: string;
}) {
  const controlled = onSelectDevice !== undefined;
  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes(topology, selectedId));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toEdges(topology, selectedId));
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const activeId = controlled ? selectedId ?? null : internalSelected;

  // Rebuild when the topology itself changes.
  useEffect(() => {
    setNodes(toNodes(topology, activeId));
    setEdges(toEdges(topology, activeId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology, setNodes, setEdges]);

  // Re-style the highlight whenever the active selection changes.
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, selected: n.id === activeId } })),
    );
    setEdges((eds) =>
      eds.map((e) => {
        const active = !!activeId && (e.source === activeId || e.target === activeId);
        const dim = !!activeId && !active;
        return {
          ...e,
          animated: active,
          style: { ...e.style, strokeWidth: active ? 3 : 2, opacity: dim ? 0.35 : 1 },
        };
      }),
    );
  }, [activeId, setNodes, setEdges]);

  const onNodeClick = useCallback(
    (_e: unknown, node: Node) => {
      if (controlled) onSelectDevice?.(node.id);
      else setInternalSelected(node.id);
    },
    [controlled, onSelectDevice],
  );

  const onPaneClick = useCallback(() => {
    if (controlled) onSelectDevice?.(null);
    else setInternalSelected(null);
  }, [controlled, onSelectDevice]);

  const info =
    !controlled && internalSelected && addressing
      ? addressing.byDevice[internalSelected]
      : null;
  const device =
    !controlled && internalSelected
      ? topology.devices.find((d) => d.id === internalSelected)
      : null;

  return (
    <div
      className={cn("relative w-full rounded-lg border bg-card", className ?? "h-[60vh]")}
      id="topology-canvas"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={fitViewOptions}
        minZoom={0.2}
        nodesDraggable
      >
        <Background gap={16} />
        <Controls />
        <MiniMap zoomable pannable />
      </ReactFlow>

      {device && !controlled && (
        <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">{device.label}</span>
            <button
              type="button"
              onClick={() => setInternalSelected(null)}
              aria-label="Close device details"
              title="Close"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Type: {device.type}</p>
          {info ? (
            <div className="mt-2 space-y-2">
              {info.vlanId && (
                <p className="text-xs">
                  VLAN:{" "}
                  <span className="font-medium">
                    {info.vlanId}
                    {info.vlanName ? ` (${info.vlanName})` : ""}
                  </span>
                </p>
              )}
              {info.gateway && (
                <p className="text-xs">
                  Gateway: <code>{info.gateway}</code>
                </p>
              )}
              <div className="space-y-1">
                {info.interfaces.map((iface) => (
                  <div key={iface.name} className="rounded border p-2">
                    <p className="text-xs font-medium">{iface.name}</p>
                    <p className="text-xs">
                      IP: <code>{iface.ip}</code>
                    </p>
                    <p className="text-xs">
                      Mask: <code>{iface.mask}</code>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No addressing assigned.</p>
          )}
        </div>
      )}
    </div>
  );
}