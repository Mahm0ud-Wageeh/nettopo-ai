"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Terminal } from "lucide-react";
import { TopologyCanvas } from "@/components/topology/topology-canvas";
import { MermaidView } from "@/components/topology/mermaid-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildTopology } from "@/lib/network-engine";
import { assignAddressing, generateCiscoConfigs } from "@/lib/network-engine/cisco";
import type { GeneratedProject } from "@/lib/network-engine/types";
import { mockGenerated } from "@/lib/mock";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ResultPage() {
  const [data, setData] = useState<GeneratedProject | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("nettopo:last");
    setData(raw ? (JSON.parse(raw) as GeneratedProject) : mockGenerated);
  }, []);

  const topology = useMemo(
    () => (data ? buildTopology({ devices: data.devices, connections: data.connections }) : null),
    [data],
  );
  const addressing = useMemo(
    () => (topology && data ? assignAddressing(topology, data.network_plan) : undefined),
    [topology, data],
  );

  if (!data || !topology) return <p className="text-muted-foreground">Loading...</p>;
  const plan = data.network_plan;

  const onDownloadCisco = () => {
    const { combined } = generateCiscoConfigs(topology, plan, addressing);
    downloadText("nettopo-cisco-config.txt", combined);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Generated network</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDownloadCisco}>
            <Terminal className="h-4 w-4" /> Cisco config
          </Button>
          <Button asChild variant="outline">
            <Link href="/export/new">
              <Download className="h-4 w-4" /> Export
            </Link>
          </Button>
        </div>
      </div>
      <Tabs defaultValue="diagram">
        <TabsList>
          <TabsTrigger value="diagram">Diagram</TabsTrigger>
          <TabsTrigger value="mermaid">Mermaid</TabsTrigger>
          <TabsTrigger value="plan">Network plan</TabsTrigger>
        </TabsList>
        <TabsContent value="diagram">
          <p className="mb-2 text-sm text-muted-foreground">
            Tip: click any device to see its IP details, and drag devices to rearrange.
          </p>
          <TopologyCanvas topology={topology} addressing={addressing} />
        </TabsContent>
        <TabsContent value="mermaid">
          <MermaidView topology={topology} />
        </TabsContent>
        <TabsContent value="plan" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">IP plan ({plan.ipPlan.base})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {plan.ipPlan.subnets.map((s) => (
                <div
                  key={s.name}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <code>{s.cidr}</code>
                  <span className="text-muted-foreground">{s.range}</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">VLANs</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {plan.vlanPlan.length === 0 && (
                <span className="text-sm text-muted-foreground">No VLANs needed</span>
              )}
              {plan.vlanPlan.map((v) => (
                <Badge key={v.id} variant="secondary">
                  VLAN {v.id} - {v.name} - {v.subnet}
                </Badge>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Routing ({plan.routing.protocol})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {plan.routing.routes.map((r, i) => (
                <pre key={i} className="rounded bg-muted p-2 text-xs">
                  {r}
                </pre>
              ))}
            </CardContent>
          </Card>
          {plan.notes && plan.notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Security notes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {plan.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}