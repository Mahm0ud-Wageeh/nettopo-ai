"use client";
import { useCallback, useEffect, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import { X } from "lucide-react";
import { DeviceNode } from "@/components/topology/device-node";
import type { BuiltTopology } from "@/lib/network-engine/types";
import type { Addressing } from "@/lib/network-engine/cisco";

const nodeTypes = { device: DeviceNode };
const fitViewOptions = { padding: 0.2 };

function toNodes(topology: BuiltTopology): Node[] {
  return topology.devices.map((d) => ({
    id: d.id,
    type: "device",
    position: topology.layout?.[d.id] ?? { x: 0, y: 0 },
    data: { label: d.label, type: d.type },
  }));
}

function toEdges(topology: BuiltTopology): Edge[] {
  return topology.connections.map((c) => ({
    id: c.id,
    source: c.from,
    target: c.to,
    animated: true,
  }));
}

export function TopologyCanvas({
  topology,
  addressing,
}: {
  topology: BuiltTopology;
  addressing?: Addressing;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes(topology));
  const [edges, setEdges, onEdgesChange] = useEdgesState(toEdges(topology));
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setNodes(toNodes(topology));
    setEdges(toEdges(topology));
    setSelected(null);
  }, [topology, setNodes, setEdges]);

  const onNodeClick = useCallback((_e: unknown, node: Node) => setSelected(node.id), []);

  const info = selected && addressing ? addressing.byDevice[selected] : null;
  const device = selected ? topology.devices.find((d) => d.id === selected) : null;

  return (
    <div className="relative h-[60vh] w-full rounded-lg border" id="topology-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
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

      {device && (
        <div className="absolute right-3 top-3 z-10 w-64 rounded-lg border bg-background/95 p-3 text-sm shadow-lg backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold">{device.label}</span>
            <button
                type="button"
                onClick={() => setSelected(null)}
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
                  VLAN: <span className="font-medium">{info.vlanId}{info.vlanName ? ` (${info.vlanName})` : ""}</span>
                </p>
              )}
              {info.gateway && (
                <p className="text-xs">Gateway: <code>{info.gateway}</code></p>
              )}
              <div className="space-y-1">
                {info.interfaces.map((iface) => (
                  <div key={iface.name} className="rounded border p-2">
                    <p className="text-xs font-medium">{iface.name}</p>
                    <p className="text-xs">IP: <code>{iface.ip}</code></p>
                    <p className="text-xs">Mask: <code>{iface.mask}</code></p>
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