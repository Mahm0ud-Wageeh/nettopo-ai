"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronUp,
  CheckCircle2,
  Copy,
  Download,
  GitCompare,
  Play,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WorkspaceTopbar,
  type WorkspaceView,
} from "@/components/workspace/workspace-topbar";
import { TopologyBoard } from "@/components/workspace/topology-board";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildTopology } from "@/lib/network-engine";
import {
  assignAddressing,
  generateCiscoConfigs,
  type DeviceConfig,
} from "@/lib/network-engine/cisco";
import {
  buildPatch,
  countStatus,
  runPreflight,
  statusFromIssues,
  type PreflightIssue,
} from "@/lib/network-engine/preflight";
import type { Device, GeneratedProject } from "@/lib/network-engine/types";
import { mockGenerated } from "@/lib/mock";

type InspectorTab = "overview" | "devices" | "cli" | "deploy" | "security";

const INSPECTOR_TABS: { id: InspectorTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "devices", label: "Devices" },
  { id: "cli", label: "CLI" },
  { id: "deploy", label: "Deploy" },
  { id: "security", label: "Security" },
];

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

function fromDbProject(p: any): GeneratedProject {
  const dbDevices: any[] = p.topology?.devices ?? [];
  const idToLabel = new Map<string, string>(
    dbDevices.map((d) => [d.id, d.label]),
  );
  const devices: Device[] = dbDevices.map((d) => ({
    id: d.label,
    label: d.label,
    type: d.type,
    meta: d.meta ?? undefined,
  }));
  const connections = (p.topology?.connections ?? []).map(
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
  const [wsView, setWsView] = useState<WorkspaceView>("network");
  const [tab, setTab] = useState<InspectorTab>("overview");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [showDiff, setShowDiff] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setSelectedId(null);
    setResolved(new Set());
    if (isSaved) {
      fetch(`/api/projects/${projectId}`)
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Could not load project")),
        )
        .then((res) => active && setData(fromDbProject(res.project)))
        .catch(() => active && toast.error("Could not load this project"));
    } else {
      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem("nettopo:last")
          : null;
      setData(raw ? (JSON.parse(raw) as GeneratedProject) : mockGenerated);
    }
    return () => {
      active = false;
    };
  }, [isSaved, projectId]);

  const topology = useMemo(
    () =>
      data
        ? buildTopology({
            devices: data.devices,
            connections: data.connections,
          })
        : null,
    [data],
  );
  const addressing = useMemo(
    () =>
      topology && data
        ? assignAddressing(topology, data.network_plan)
        : undefined,
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
  const allIssues = useMemo(
    () => (topology ? runPreflight(topology, addressing) : []),
    [topology, addressing],
  );

  if (!data || !topology)
    return (
      <div className="grid h-screen place-items-center text-muted-foreground">
        Loading workspace...
      </div>
    );

  const plan = data.network_plan;
  const activeIssues = allIssues.filter((i) => !resolved.has(i.id));
  const status = statusFromIssues(topology.devices, activeIssues);
  const counts = countStatus(status);

  const selectedDevice = selectedId
    ? (topology.devices.find((d) => d.id === selectedId) ?? null)
    : null;
  const selectedAddr =
    selectedId && addressing ? (addressing.byDevice[selectedId] ?? null) : null;
  const scopeIssues = selectedId
    ? activeIssues.filter((i) => i.deviceId === selectedId)
    : activeIssues;
  const scopePatch = buildPatch(scopeIssues);

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      setTab("overview");
      setInspectorOpen(true);
    }
  };
  const onDownloadCisco = () =>
    cisco && downloadText("nettopo-cisco-config.txt", cisco.combined);

  const applyPatch = (ids: string[]) => {
    setResolved((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    toast.success(
      ids.length > 1 ? `Applied ${ids.length} patches` : "Patch applied",
    );
  };
  const runCheck = () => {
    setResolved(new Set());
    const n = allIssues.length;
    if (n === 0) toast.success("Pre-flight passed -- no issues found");
    else toast.warning(`Pre-flight found ${n} issue${n === 1 ? "" : "s"}`);
  };

  const configFor = (d: Device | null): string => {
    if (!d) return cisco?.combined ?? "";
    const base = configMap.get(d.id)?.cli ?? "";
    const applied = allIssues.filter(
      (i) => i.deviceId === d.id && resolved.has(i.id),
    );
    if (applied.length === 0) return base;
    const extra = applied.flatMap((i) => i.add).join("\n");
    return `${base}\n!\n! ---- applied hardening patch ----\n${extra}\n`;
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
    <div className="flex h-[100dvh] flex-col">
      <WorkspaceTopbar
        view={wsView}
        onView={setWsView}
        onSave={isSaved ? undefined : onSave}
        saving={saving}
      />

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-0 min-w-0 flex-1">
          {wsView === "network" && (
            <TopologyBoard
              topology={topology}
              status={status}
              counts={counts}
              selectedId={selectedId}
              onSelectDevice={handleSelect}
              onDownload={onDownloadCisco}
            />
          )}
          {wsView === "nodes" && (
            <NodesView
              topology={topology}
              addressing={addressing}
              status={status}
            />
          )}
          {wsView === "cli" && (
            <CliView
              combined={cisco?.combined ?? ""}
              onCopy={() => copyText(cisco?.combined ?? "")}
              onDownload={onDownloadCisco}
            />
          )}
          {wsView === "security" && (
            <SecurityView
              issues={activeIssues}
              counts={counts}
              patch={buildPatch(activeIssues)}
              onApplyAll={() => applyPatch(activeIssues.map((i) => i.id))}
              onRun={runCheck}
            />
          )}
        </section>

        {wsView === "network" && (
          <aside
            className={cn(
              "flex w-full shrink-0 flex-col border-t bg-card lg:w-[400px] lg:border-l lg:border-t-0",
              inspectorOpen ? "max-h-[65vh] lg:max-h-none" : "",
            )}
          >
            <button
              type="button"
              onClick={() => setInspectorOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 border-b px-4 py-3 text-left lg:pointer-events-none"
            >
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold leading-tight">
                  {selectedDevice ? selectedDevice.label : "Network overview"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selectedDevice
                    ? selectedDevice.type
                    : `${topology.devices.length} devices`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {scopeIssues.length > 0 ? (
                  <Badge variant="ai" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> WARNING
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> HEALTHY
                  </Badge>
                )}
                <ChevronUp
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform lg:hidden",
                    inspectorOpen ? "" : "rotate-180",
                  )}
                />
              </div>
            </button>

            <div
              className={cn(
                "items-center gap-4 border-b px-4",
                inspectorOpen ? "flex" : "hidden",
                "lg:flex",
              )}
            >
              {INSPECTOR_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative py-2.5 text-sm font-medium transition-colors",
                    tab === t.id
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                  {tab === t.id && (
                    <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                  )}
                </button>
              ))}
            </div>

            <div
              className={cn(
                "min-h-0 flex-1 space-y-4 overflow-y-auto p-4",
                inspectorOpen ? "block" : "hidden",
                "lg:block",
              )}
            >
              {tab === "overview" && (
                <>
                  <AiAnalysis
                    issues={scopeIssues}
                    healthyText={
                      selectedDevice
                        ? `${selectedDevice.label} passed the automated checks.`
                        : `This ${addressing?.mode === "vlan" ? "VLAN-segmented" : "flat"} network has ${topology.devices.length} devices and ${plan.vlanPlan.length || 1} subnet(s). Routing: ${plan.routing.protocol}.`
                    }
                    onApply={() => applyPatch(scopeIssues.map((i) => i.id))}
                    onViewDiff={() => setTab("security")}
                  />
                  {selectedDevice && selectedAddr ? (
                    <div className="space-y-2 text-sm">
                      {selectedAddr.vlanId ? (
                        <Row
                          label="VLAN"
                          value={`${selectedAddr.vlanId}${selectedAddr.vlanName ? ` · ${selectedAddr.vlanName}` : ""}`}
                        />
                      ) : null}
                      {selectedAddr.gateway ? (
                        <Row
                          label="Gateway"
                          value={selectedAddr.gateway}
                          mono
                        />
                      ) : null}
                      {selectedAddr.interfaces.map((iface) => (
                        <div
                          key={iface.name}
                          className="rounded-md border p-2 text-xs"
                        >
                          <p className="font-mono font-medium">{iface.name}</p>
                          <p>
                            IP: <code>{iface.ip}</code>
                          </p>
                          <p>
                            Mask: <code>{iface.mask}</code>
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : !selectedDevice ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="Devices" value={topology.devices.length} />
                      <Stat label="Links" value={topology.connections.length} />
                      <Stat label="VLANs" value={plan.vlanPlan.length} />
                      <Stat label="Online" value={counts.online} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No addressing for this device.
                    </p>
                  )}
                </>
              )}

              {tab === "devices" && (
                <div className="space-y-1">
                  {topology.devices.map((d) => {
                    const a = addressing?.byDevice[d.id];
                    const st = status[d.id];
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
                        <span className="flex items-center gap-2">
                          <StatusDot status={st} />
                          <span className="font-medium">{d.label}</span>
                        </span>
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
                </div>
              )}

              {tab === "cli" && (
                <>
                  <AiAnalysis
                    issues={scopeIssues}
                    healthyText={`${selectedDevice ? selectedDevice.label : "This network"} passed the automated checks.`}
                    onApply={() => applyPatch(scopeIssues.map((i) => i.id))}
                    onViewDiff={() => setShowDiff((v) => !v)}
                  />
                  <ConfigViewer
                    filename={`${(selectedDevice?.label ?? "nettopo").toLowerCase()}-config.txt`}
                    content={configFor(selectedDevice)}
                    onCopy={() => copyText(configFor(selectedDevice))}
                    onDownload={selectedDevice ? undefined : onDownloadCisco}
                  />
                  {scopeIssues.length > 0 && showDiff && (
                    <PatchCard patch={scopePatch} onRun={runCheck} />
                  )}
                </>
              )}

              {tab === "deploy" && (
                <div className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    Push the generated configuration to each device:
                  </p>
                  <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
                    <li>
                      Connect via console or SSH on the management VLAN (99).
                    </li>
                    <li>
                      Enter <code>enable</code> then{" "}
                      <code>configure terminal</code>.
                    </li>
                    <li>Paste the device block from the CLI tab.</li>
                    <li>
                      Save the running config with <code>write memory</code>.
                    </li>
                  </ol>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyText(configFor(selectedDevice))}
                    >
                      <Copy className="h-4 w-4" /> Copy block
                    </Button>
                    <Button size="sm" onClick={onDownloadCisco}>
                      <Download className="h-4 w-4" /> Download all
                    </Button>
                  </div>
                  {activeIssues.length > 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => applyPatch(activeIssues.map((i) => i.id))}
                    >
                      <Sparkles className="h-4 w-4" /> Apply all patches (
                      {activeIssues.length})
                    </Button>
                  )}
                </div>
              )}

              {tab === "security" && (
                <div className="space-y-3">
                  <AiAnalysis
                    issues={activeIssues}
                    healthyText="No hardening issues detected across the network."
                    onApply={() => applyPatch(activeIssues.map((i) => i.id))}
                    onViewDiff={() => setShowDiff(true)}
                  />
                  {activeIssues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      All checks passed.
                    </p>
                  ) : (
                    activeIssues.map((i) => (
                      <div key={i.id} className="rounded-lg border p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            {i.title}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyPatch([i.id])}
                          >
                            Apply
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {i.detail}
                        </p>
                      </div>
                    ))
                  )}
                  {showDiff && scopeIssues.length > 0 && (
                    <PatchCard
                      patch={buildPatch(activeIssues)}
                      onRun={runCheck}
                    />
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status?: string }) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        status === "offline"
          ? "bg-red-500"
          : status === "degraded"
            ? "bg-amber-400"
            : "bg-emerald-400",
      )}
    />
  );
}

function AiAnalysis({
  issues,
  healthyText,
  onApply,
  onViewDiff,
}: {
  issues: PreflightIssue[];
  healthyText: string;
  onApply: () => void;
  onViewDiff: () => void;
}) {
  const warning = issues.length > 0;
  return (
    <div className="ai-zone rounded-lg p-3">
      <div className="mb-1 flex items-center gap-1.5 text-cyan">
        <Sparkles className="h-4 w-4" />
        <span className="font-display text-sm font-semibold">AI Analysis</span>
      </div>
      <p className="text-sm text-muted-foreground">
        {warning ? issues[0].detail : healthyText}
        {warning && issues.length > 1 ? ` (+${issues.length - 1} more)` : ""}
      </p>
      {warning && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onApply}>
            <Play className="h-4 w-4" /> Apply Patch
          </Button>
          <Button size="sm" variant="outline" onClick={onViewDiff}>
            <GitCompare className="h-4 w-4" /> View Diff
          </Button>
        </div>
      )}
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
        <span className="font-mono text-xs text-muted-foreground">
          {filename}
        </span>
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
      <pre className="max-h-[44vh] overflow-auto bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-300">
        <code>{content || "No CLI generated for this selection."}</code>
      </pre>
    </div>
  );
}

function PatchCard({
  patch,
  onRun,
}: {
  patch: { remove: string[]; add: string[] };
  onRun: () => void;
}) {
  const empty = patch.remove.length === 0 && patch.add.length === 0;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-1.5 text-cyan">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="font-display text-xs font-semibold">
          Generated Patch
        </span>
      </div>
      <pre className="max-h-[36vh] overflow-auto bg-slate-950 p-3 font-mono text-xs leading-relaxed">
        {patch.remove.map((l, i) => (
          <div key={`r${i}`} className="text-red-400">
            - {l}
          </div>
        ))}
        {patch.add.map((l, i) => (
          <div key={`a${i}`} className="text-emerald-400">
            + {l}
          </div>
        ))}
        {empty && <div className="text-slate-500">No changes required.</div>}
      </pre>
      <div className="flex justify-end border-t bg-muted/30 px-3 py-2">
        <Button size="sm" variant="ghost" onClick={onRun}>
          Run Pre-flight Check <Play className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
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

function NodesView({
  topology,
  addressing,
  status,
}: {
  topology: any;
  addressing: any;
  status: Record<string, string>;
}) {
  return (
    <div className="h-full overflow-auto p-6">
      <h1 className="mb-4 font-display text-xl font-bold">Nodes</h1>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Device</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">VLAN</th>
              <th className="px-4 py-2">IP</th>
              <th className="px-4 py-2">Gateway</th>
            </tr>
          </thead>
          <tbody>
            {topology.devices.map((d: any) => {
              const a = addressing?.byDevice[d.id];
              const st = status[d.id];
              return (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-2">
                    <StatusDot status={st} />
                  </td>
                  <td className="px-4 py-2 font-medium">{d.label}</td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className="text-[10px]">
                      {d.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-2">{a?.vlanId ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {a?.interfaces[0]?.ip ?? "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {a?.gateway ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CliView({
  combined,
  onCopy,
  onDownload,
}: {
  combined: string;
  onCopy: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-xl font-bold">Generated Cisco IOS</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" /> Copy
          </Button>
          <Button size="sm" onClick={onDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      </div>
      <pre className="flex-1 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
        <code>{combined || "No CLI generated."}</code>
      </pre>
    </div>
  );
}

function SecurityView({
  issues,
  counts,
  patch,
  onApplyAll,
  onRun,
}: {
  issues: PreflightIssue[];
  counts: { online: number; degraded: number; offline: number };
  patch: { remove: string[]; add: string[] };
  onApplyAll: () => void;
  onRun: () => void;
}) {
  return (
    <div className="h-full space-y-4 overflow-auto p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">
          Security &amp; pre-flight
        </h1>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />{" "}
            {counts.online} Online
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />{" "}
            {counts.degraded} Degraded
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" />{" "}
            {counts.offline} Offline
          </span>
        </div>
      </div>
      {issues.length === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-500" />
          <p className="font-medium">All checks passed</p>
          <p className="text-sm text-muted-foreground">
            No anomalies detected in the generated network.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {issues.map((i) => (
              <div key={i.id} className="rounded-lg border p-3">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> {i.title}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
              </div>
            ))}
            <Button variant="secondary" onClick={onApplyAll}>
              <Sparkles className="h-4 w-4" /> Apply all patches
            </Button>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-1.5 border-b bg-muted/50 px-3 py-1.5 text-cyan">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-display text-xs font-semibold">
                Generated Patch
              </span>
            </div>
            <pre className="max-h-[60vh] overflow-auto bg-slate-950 p-3 font-mono text-xs leading-relaxed">
              {patch.remove.map((l, i) => (
                <div key={`r${i}`} className="text-red-400">
                  - {l}
                </div>
              ))}
              {patch.add.map((l, i) => (
                <div key={`a${i}`} className="text-emerald-400">
                  + {l}
                </div>
              ))}
            </pre>
            <div className="flex justify-end border-t bg-muted/30 px-3 py-2">
              <Button size="sm" variant="ghost" onClick={onRun}>
                Run Pre-flight Check <Play className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}