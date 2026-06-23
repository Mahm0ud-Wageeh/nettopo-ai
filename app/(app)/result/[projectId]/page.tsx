"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, Loader2, Save, Sparkles, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopologyCanvas } from "@/components/topology/topology-canvas";
import { MermaidView } from "@/components/topology/mermaid-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { buildTopology } from "@/lib/network-engine";
import {
  assignAddressing,
  generateCiscoConfigs,
  type DeviceAddressing,
  type DeviceConfig,
} from "@/lib/network-engine/cisco";
import type { Connection, Device, GeneratedProject } from "@/lib/network-engine/types";
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

async function copyText(text: string, label = "Copied to clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Could not copy");
  }
}

// A short, honest insight per device role (derived from how the engine wires it).
function insightFor(d: Device, addr?: DeviceAddressing): string {
  switch (d.type) {
    case "ROUTER":
      return "Gateway router: owns every VLAN sub-interface (router-on-a-stick) and serves DHCP to the endpoints.";
    case "SWITCH":
      return "Access switch: endpoint ports are pinned to their VLAN with port-security, and a trunk uplink carries all VLANs to the router.";
    case "FIREWALL":
      return "Edge firewall: apply inbound ACLs on the outside interface and only permit established/return traffic.";
    case "SERVER":
      return "Server: give it a static address from its VLAN and exclude it from the DHCP pool.";
    case "AP":
      return "Access point: bridge wireless clients into the wireless VLAN and keep management on VLAN 99.";
    default:
      return addr?.vlanId
        ? `Endpoint in VLAN ${addr.vlanId}. It can pull its address from DHCP or be configured statically.`
        : "Endpoint device — set its IP from the device IP configuration.";
  }
}

// Rebuild a GeneratedProject from the DB shape returned by /api/projects/[id].
function fromDbProject(p: any): GeneratedProject {
  const dbDevices: any[] = p.topology?.devices ?? [];
  const idToLabel = new Map<string, string>(dbDevices.map((d) => [d.id, d.label]));
  const devices: Device[] = dbDevices.map((d) => ({
    id: d.label,
    label: d.label,
    type: d.type,
    meta: d.meta ?? undefined,
  }));
  const connections: Connection[] = (p.topology?.connections ?? []).map(
    (c: any, i: number) => ({
      id: `e${i + 1}`,
      from: idToLabel.get(c.fromId) ?? c.fromId,
      to: idToLabel.get(c.toId) ?? c.toId,
      meta: c.meta ?? undefined,
    }),
  );
  return {
    devices,
    connections,
    network_plan: {
      ipPlan: p.plan?.ipPlan ?? { base: "", subnets: [] },
      vlanPlan: p.plan?.vlanPlan ?? [],
      routing: p.plan?.routing ?? { protocol: "STATIC", routes: [] },
      notes: p.plan?.notes ?? [],
    },
  };
}

export default function ResultPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params?.projectId ?? "new";
  const isSaved = projectId !== "new";

  const [data, setData] = useState<GeneratedProject | null>(null);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"diagram" | "mermaid">("diagram");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSelectedId(null);
    if (isSaved) {
      fetch(`/api/projects/${projectId}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Could not load project"))))
        .then((res) => active && setData(fromDbProject(res.project)))
        .catch(() => active && toast.error("Could not load this project"));
    } else {
      const raw = sessionStorage.getItem("nettopo:last");
      setData(raw ? (JSON.parse(raw) as GeneratedProject) : mockGenerated);
    }
    return () => {
      active = false;
    };
  }, [isSaved, projectId]);

  const topology = useMemo(
    () => (data ? buildTopology({ devices: data.devices, connections: data.connections }) : null),
    [data],
  );
  const addressing = useMemo(
    () => (topology && data ? assignAddressing(topology, data.network_plan) : undefined),
    [topology, data],
  );
  const cisco = useMemo(
    () =>
      topology && data && addressing
        ? generateCiscoConfigs(topology, data.network_plan, addressing)
        : null,
    [topology, data, addressing],
  );
  const configMap = useMemo(() => {
    const m = new Map<string, DeviceConfig>();
    cisco?.configs.forEach((c) => m.set(c.deviceId, c));
    return m;
  }, [cisco]);

  if (!data || !topology) return <p className="text-muted-foreground">Loading...</p>;
  const plan = data.network_plan;

  const selectedDevice = selectedId
    ? topology.devices.find((d) => d.id === selectedId) ?? null
    : null;
  const selectedAddr =
    selectedId && addressing ? addressing.byDevice[selectedId] ?? null : null;
  const selectedConfig = selectedId ? configMap.get(selectedId) ?? null : null;

  const onDownloadCisco = () => {
    if (!cisco) return;
    downloadText("nettopo-cisco-config.txt", cisco.combined);
  };

  async function onSave() {
    const name = window.prompt("Project name", "My network");
    if (!name) return;
    setSaving(true);
    try {
      const res = await fetch("/api/projects/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          source: "PROMPT",
          topology: {
            devices: topology!.devices,
            connections: topology!.connections,
            layout: topology!.layout,
          },
          plan,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      const { project } = await res.json();
      toast.success("Project saved");
      router.push(`/result/${project.id}`);
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Generated network</h1>
          <p className="text-sm text-muted-foreground">
            {topology.devices.length} devices · {topology.connections.length} links ·{" "}
            {plan.vlanPlan.length} VLANs
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isSaved && (
            <Button onClick={onSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}{" "}
              Save project
            </Button>
          )}
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

      {/* Workspace: canvas (left) + inspector (right) */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* LEFT */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={view === "diagram" ? "default" : "outline"}
              onClick={() => setView("diagram")}
            >
              Diagram
            </Button>
            <Button
              size="sm"
              variant={view === "mermaid" ? "default" : "outline"}
              onClick={() => setView("mermaid")}
            >
              Mermaid
            </Button>
            <span className="ml-auto text-xs text-muted-foreground">
              Click a device · drag to rearrange
            </span>
          </div>

          {view === "diagram" ? (
            <>
              <TopologyCanvas
                topology={topology}
                addressing={addressing}
                selectedId={selectedId}
                onSelectDevice={setSelectedId}
                className="h-[64vh]"
              />
              <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card px-4 py-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-primary" /> {topology.devices.length}{" "}
                  devices
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan" /> {topology.connections.length}{" "}
                  links
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> {plan.vlanPlan.length}{" "}
                  VLANs
                </span>
              </div>
            </>
          ) : (
            <MermaidView topology={topology} />
          )}
        </div>

        {/* RIGHT: inspector */}
        <Card className="flex max-h-[80vh] flex-col">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">
                {selectedDevice ? selectedDevice.label : "Network overview"}
              </CardTitle>
              {selectedDevice ? (
                <Badge variant="ai">{selectedDevice.type}</Badge>
              ) : (
                <Badge variant="secondary">
                  {addressing?.mode === "vlan" ? "VLAN" : "FLAT"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedDevice
                ? "Addressing and the generated CLI for this device."
                : "Click any device on the canvas to inspect it."}
            </p>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="cli">CLI</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
                <TabsTrigger value="devices">Devices</TabsTrigger>
              </TabsList>

              {/* OVERVIEW */}
              <TabsContent value="overview" className="space-y-4">
                <div className="ai-zone rounded-lg p-3">
                  <div className="mb-1 flex items-center gap-1.5 text-cyan">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-display text-sm font-semibold">AI Analysis</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {selectedDevice
                      ? insightFor(selectedDevice, selectedAddr ?? undefined)
                      : `This is a ${
                          addressing?.mode === "vlan" ? "VLAN-segmented" : "flat"
                        } network with ${topology.devices.length} devices across ${
                          plan.vlanPlan.length || 1
                        } subnet(s). Routing protocol: ${plan.routing.protocol}.`}
                  </p>
                </div>

                {selectedDevice && selectedAddr ? (
                  <div className="space-y-2 text-sm">
                    {selectedAddr.vlanId ? (
                      <Row
                        label="VLAN"
                        value={`${selectedAddr.vlanId}${
                          selectedAddr.vlanName ? ` · ${selectedAddr.vlanName}` : ""
                        }`}
                      />
                    ) : null}
                    {selectedAddr.gateway ? (
                      <Row label="Gateway" value={selectedAddr.gateway} mono />
                    ) : null}
                    <div className="space-y-2">
                      {selectedAddr.interfaces.map((iface) => (
                        <div key={iface.name} className="rounded-md border p-2">
                          <p className="font-mono text-xs font-medium">{iface.name}</p>
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
                ) : !selectedDevice ? (
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Devices" value={topology.devices.length} />
                    <Stat label="Links" value={topology.connections.length} />
                    <Stat label="VLANs" value={plan.vlanPlan.length} />
                    <Stat label="Subnets" value={addressing?.subnets.length ?? 0} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No addressing assigned for this device.
                  </p>
                )}
              </TabsContent>

              {/* CLI */}
              <TabsContent value="cli" className="space-y-3">
                {selectedDevice ? (
                  selectedConfig ? (
                    <ConfigViewer
                      filename={`${selectedConfig.hostname.toLowerCase()}-config.txt`}
                      content={selectedConfig.cli}
                      onCopy={() => copyText(selectedConfig.cli)}
                    />
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {selectedDevice.label} is an endpoint — set its IP from the device IP
                        configuration:
                      </p>
                      {selectedAddr?.interfaces.map((iface) => (
                        <div key={iface.name} className="rounded-md border p-2 text-xs">
                          IP <code>{iface.ip}</code> / Mask <code>{iface.mask}</code>
                          {selectedAddr.gateway ? (
                            <>
                              {" "}/ GW <code>{selectedAddr.gateway}</code>
                            </>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <ConfigViewer
                    filename="nettopo-cisco-config.txt"
                    content={cisco?.combined ?? ""}
                    onCopy={() => copyText(cisco?.combined ?? "")}
                    onDownload={onDownloadCisco}
                  />
                )}
              </TabsContent>

              {/* PLAN */}
              <TabsContent value="plan" className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-display text-sm font-semibold">
                    IP plan ({plan.ipPlan.base})
                  </h4>
                  {plan.ipPlan.subnets.map((s) => (
                    <div
                      key={s.name}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm"
                    >
                      <span className="font-medium">{s.name}</span>
                      <code className="text-xs">{s.cidr}</code>
                      <span className="text-xs text-muted-foreground">{s.range}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <h4 className="font-display text-sm font-semibold">VLANs</h4>
                  <div className="flex flex-wrap gap-2">
                    {plan.vlanPlan.length === 0 && (
                      <span className="text-sm text-muted-foreground">No VLANs needed</span>
                    )}
                    {plan.vlanPlan.map((v) => (
                      <Badge key={v.id} variant="secondary">
                        VLAN {v.id} · {v.name} · {v.subnet}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-display text-sm font-semibold">
                    Routing ({plan.routing.protocol})
                  </h4>
                  {plan.routing.routes.map((r, i) => (
                    <pre key={i} className="rounded bg-muted p-2 text-xs">
                      {r}
                    </pre>
                  ))}
                </div>
                {plan.notes && plan.notes.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-display text-sm font-semibold">Security notes</h4>
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {plan.notes.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </TabsContent>

              {/* DEVICES */}
              <TabsContent value="devices" className="space-y-1">
                {topology.devices.map((d) => {
                  const a = addressing?.byDevice[d.id];
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedId(d.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-md border p-2 text-left text-sm transition-colors hover:border-primary/50",
                        selectedId === d.id && "border-primary bg-primary/5",
                      )}
                    >
                      <span className="font-medium">{d.label}</span>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {d.type}
                        </Badge>
                        {a?.interfaces[0]?.ip ? (
                          <code className="text-xs text-muted-foreground">
                            {a.interfaces[0].ip}
                          </code>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function ConfigViewer({
  filename,
  content,
  onCopy,
  onDownload,
}: {
  filename: string;
  content: string;
  onCopy: () => void;
  onDownload?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-1.5">
        <span className="font-mono text-xs text-muted-foreground">{filename}</span>
        <div className="flex items-center gap-1">
          {onDownload ? (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onDownload}
              aria-label="Download config"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onCopy}
            aria-label="Copy config"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <pre className="max-h-[48vh] overflow-auto bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300">
        <code>{content || "No CLI generated for this selection."}</code>
      </pre>
    </div>
  );
}