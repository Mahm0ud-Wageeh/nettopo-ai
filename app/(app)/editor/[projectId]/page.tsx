"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Wand2 } from "lucide-react";
import { DevicePalette } from "@/components/topology/device-palette";
import { TopologyCanvas } from "@/components/topology/topology-canvas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildTopology } from "@/lib/network-engine";
import type { BuiltTopology, Device, DeviceType } from "@/lib/network-engine/types";

const PREFIX: Record<DeviceType, string> = {
  ROUTER: "R", SWITCH: "SW", SERVER: "SRV", PC: "PC", FIREWALL: "FW", AP: "AP",
  PRINTER: "PRN", CAMERA: "CAM", NVR: "NVR", IP_PHONE: "PH",
};

export default function EditorPage() {
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);

  function addDevice(type: DeviceType) {
    const count = devices.filter((d) => d.type === type).length + 1;
    const id = `${PREFIX[type]}${count}`;
    setDevices((prev) => [...prev, { id, label: id, type }]);
  }

  const topology: BuiltTopology = buildTopology({ devices, connections: [] });

  async function plan() {
    if (devices.length === 0) return toast.error("Add at least one device");
    setLoading(true);
    try {
      const res = await fetch("/api/topology/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ devices }),
      });
      if (!res.ok) throw new Error("Planning failed");
      const data = await res.json();
      sessionStorage.setItem("nettopo:last", JSON.stringify(data));
      router.push("/result/new");
    } catch (e) {
      toast.error(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Devices</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DevicePalette onAdd={addDevice} />
          <p className="text-xs text-muted-foreground">{devices.length} device(s) added</p>
          <Button onClick={plan} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Generate plan
          </Button>
        </CardContent>
      </Card>
      <TopologyCanvas topology={topology} />
    </div>
  );
}