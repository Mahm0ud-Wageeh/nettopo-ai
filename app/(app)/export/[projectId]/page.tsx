"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileJson, FileImage, FileText } from "lucide-react";
import { TopologyCanvas } from "@/components/topology/topology-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildTopology } from "@/lib/network-engine";
import type { GeneratedProject } from "@/lib/network-engine/types";
import { mockGenerated } from "@/lib/mock";

export default function ExportPage() {
  const [data, setData] = useState<GeneratedProject | null>(null);
  useEffect(() => {
    const raw = sessionStorage.getItem("nettopo:last");
    setData(raw ? (JSON.parse(raw) as GeneratedProject) : mockGenerated);
  }, []);

  function triggerDownload(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
  }

  async function exportPng() {
    const node = document.getElementById("topology-canvas");
    if (!node) return toast.error("Nothing to export");
    const { toPng } = await import("html-to-image");
    const url = await toPng(node, { cacheBust: true, pixelRatio: 2 });
    triggerDownload(url, "topology.png");
  }

  async function exportPdf() {
    const node = document.getElementById("topology-canvas");
    if (!node) return toast.error("Nothing to export");
    const { toPng } = await import("html-to-image");
    const { jsPDF } = await import("jspdf");
    const url = await toPng(node, { cacheBust: true, pixelRatio: 2 });
    const pdf = new jsPDF({ orientation: "landscape" });
    const width = pdf.internal.pageSize.getWidth();
    pdf.addImage(url, "PNG", 10, 10, width - 20, (width - 20) * 0.6);
    pdf.save("topology.pdf");
  }

  function exportJson() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    triggerDownload(URL.createObjectURL(blob), "network.json");
  }

  if (!data) return <p className="text-muted-foreground">Loading...</p>;
  const topology = buildTopology({ devices: data.devices, connections: data.connections });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Export</h1>
      <div className="flex flex-wrap gap-3">
        <Button onClick={exportPng}>
          <FileImage className="h-4 w-4" /> PNG
        </Button>
        <Button onClick={exportPdf} variant="outline">
          <FileText className="h-4 w-4" /> PDF
        </Button>
        <Button onClick={exportJson} variant="outline">
          <FileJson className="h-4 w-4" /> JSON
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <TopologyCanvas topology={topology} />
        </CardContent>
      </Card>
    </div>
  );
}
