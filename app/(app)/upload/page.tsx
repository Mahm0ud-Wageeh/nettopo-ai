"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload as UploadIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function UploadPage() {
  const router = useRouter();
  const [reading, setReading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file (PNG/JPG/WebP)");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Max file size is 8 MB");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setText("");
    setProgress(0);
    setReading(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng+ara", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100));
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const extracted = (data.text || "").trim();
      setText(extracted);
      if (extracted.length < 2) {
        toast.message("Couldn't read clear text. Type the devices manually below, then generate.");
      } else {
        toast.success("Text extracted - review it below, then generate.");
      }
    } catch (err) {
      toast.error("OCR failed: " + String(err instanceof Error ? err.message : err));
    } finally {
      setReading(false);
    }
  }

  async function generate() {
    const value = text.trim();
    if (value.length < 2) {
      toast.error("Please extract or type some text first");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/topology/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, lang: "auto" }),
      });
      if (!res.ok) throw new Error(`Generation failed (HTTP ${res.status})`);
      const result = await res.json();
      sessionStorage.setItem("nettopo:last", JSON.stringify(result));
      router.push("/result/new");
    } catch (err) {
      toast.error(String(err instanceof Error ? err.message : err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload a diagram</h1>
        <p className="text-muted-foreground">
          We extract text with OCR (English + Arabic). You can review and edit it before generating.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center hover:bg-muted">
            <UploadIcon className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Click to choose an image (PNG/JPG/WebP, max 8 MB)</span>
            <input type="file" accept="image/*" className="hidden" onChange={onFile} disabled={reading || generating} />
          </label>

          {preview && (
            <img src={preview} alt="preview" className="mt-4 max-h-64 rounded-lg border object-contain" />
          )}

          {reading && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Reading image... {progress}%
            </p>
          )}
        </CardContent>
      </Card>

      {(text || (!reading && preview)) && (
        <Card>
          <CardContent className="space-y-3 p-6">
            <label htmlFor="ocr-text" className="text-sm font-medium">
              Extracted text (editable)
            </label>
            <Textarea
              id="ocr-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="e.g. 2 routers, 3 switches, 1 server, 20 PCs with VLAN"
            />
            <Button onClick={generate} disabled={generating || reading}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate topology
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}