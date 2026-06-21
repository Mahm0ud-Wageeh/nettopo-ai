"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLES = [
  "شبكة فيها راوتر و 3 سويتش و 10 أجهزة و سيرفر مع تقسيم VLAN",
  "A network with 2 routers, a firewall, 4 switches, 20 PCs and 2 servers using OSPF",
];

export default function PromptPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    if (text.trim().length < 2) return toast.error("Please describe your network first");
    setLoading(true);
    try {
      const res = await fetch("/api/topology/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: "auto" }),
      });
      if (!res.ok) throw new Error("Generation failed");
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Describe your network</h1>
        <p className="text-muted-foreground">
          Write in Arabic or English. The AI structures it and the engine plans it.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-4 p-6">
          <Textarea
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. شبكة فيها راوتر و سويتش و 5 أجهزة..."
            dir="auto"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setText(ex)}
                className="rounded-full border px-3 py-1 text-xs hover:bg-muted"
                dir="auto"
              >
                {ex.slice(0, 40)}...
              </button>
            ))}
          </div>
          <Button onClick={generate} disabled={loading} className="w-full">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate topology &amp; plan
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
