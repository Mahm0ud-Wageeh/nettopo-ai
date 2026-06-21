"use client";
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import type { Topology } from "@/lib/network-engine/types";

mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });

function toMermaid(t: Topology): string {
  const lines = ["graph TD"];
  for (const d of t.devices) lines.push(`  ${d.id}["${d.label}"]`);
  for (const c of t.connections) lines.push(`  ${c.from} --- ${c.to}`);
  return lines.join("\n");
}

export function MermaidView({ topology }: { topology: Topology }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const id = `m${Math.random().toString(36).slice(2)}`;
    mermaid
      .render(id, toMermaid(topology))
      .then((res) => {
        if (!cancelled && ref.current) ref.current.innerHTML = res.svg;
      })
      .catch((e) => setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [topology]);
  if (error) return <pre className="text-xs text-destructive">{error}</pre>;
  return <div ref={ref} className="overflow-auto rounded-lg border p-4" />;
}
