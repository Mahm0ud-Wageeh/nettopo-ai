"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BarChart3,
  Loader2,
  ScanLine,
  Sparkles,
  Terminal,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@clerk/nextjs";

const EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "Campus Edge Network",
    prompt:
      "Design a campus edge network with a core router, 3 distribution switches, 8 access switches, 40 PCs, 4 servers and VLAN segmentation.",
  },
  {
    label: "Multi-Cloud VPN Hub",
    prompt:
      "Design a multi-cloud VPN hub with 2 routers, a firewall and site-to-site IPSec tunnels to AWS and Azure using OSPF.",
  },
  {
    label: "Small Branch Office",
    prompt:
      "Design a small branch office with one router, one switch, a firewall, 10 PCs, a printer and a server.",
  },
];

// Reusable fade-up animation (kept as a helper so the JSX stays clean).
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, delay },
});

const capacityBars = ["h-10", "h-16", "h-9", "h-24", "h-32", "h-20", "h-12"];

export default function LandingPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // Gate guests: the first interaction sends them to sign in first.
  function requireAuth() {
    if (!isLoaded) return false;
    if (isSignedIn) return true;
    router.push("/sign-in");
    return false;
  }

  async function generate() {
    if (!requireAuth()) return;
    if (text.trim().length < 2) {
      toast.error("Describe your network first, or pick an example below.");
      return;
    }
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
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1">
        {/* ---------------- HERO ---------------- */}
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 cyber-grid"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 brand-glow"
            aria-hidden
          />

          <div className="container relative flex flex-col items-center py-20 text-center sm:py-28">
            <motion.div {...fadeUp(0)}>
              <Badge variant="ai" className="gap-1.5">
                <Sparkles className="h-3 w-3" /> AI-NATIVE NETWORK PLANNING
              </Badge>
            </motion.div>

            <motion.h1
              {...fadeUp(0.05)}
              className="mt-6 max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-6xl"
            >
              Design Network Topologies
              <br />
              <span className="bg-gradient-to-r from-primary to-cyan bg-clip-text text-transparent">
                Using AI
              </span>
            </motion.h1>

            <motion.p
              {...fadeUp(0.1)}
              className="mt-5 max-w-2xl text-lg text-muted-foreground"
            >
              Describe your ideal network architecture or upload an existing
              diagram. Our core engine instantly generates detailed, deployable
              Cisco CLI configurations and visual topologies.
            </motion.p>

            {/* Prompt box */}
            <motion.div {...fadeUp(0.15)} className="mt-10 w-full max-w-3xl">
              <Card className="ai-zone overflow-hidden text-left">
                <CardContent className="p-4">
                  <Textarea
                    rows={3}
                    dir="auto"
                    value={text}
                    onFocus={() => requireAuth()}
                    onChange={(e) => {
                      if (!requireAuth()) return;
                      setText(e.target.value);
                    }}
                    placeholder="E.g., Design a high-availability spine-leaf data center fabric with BGP EVPN for 4 server racks..."
                    className="resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="gap-2"
                    >
                      <Link href="/upload">
                        <Upload className="h-4 w-4" /> Upload Topology Image
                      </Link>
                    </Button>
                    <Button
                      onClick={generate}
                      disabled={loading}
                      className="gap-2"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Generate Topology
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Try chips */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    type="button"
                    onClick={() => {
                      if (!requireAuth()) return;
                      setText(ex.prompt);
                    }}
                    className="rounded-full border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    Try: {ex.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ---------------- FEATURES ---------------- */}
        <section className="container grid gap-4 pb-24 lg:grid-cols-2">
          {/* AI Diagram Generation */}
          <motion.div {...fadeUp(0)}>
            <Card className="h-full">
              <CardHeader>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </span>
                <CardTitle className="mt-3 text-xl">
                  AI Diagram Generation
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Instantly convert natural language prompts into precise,
                  editable visual topologies mapped to industry standard icons.
                </p>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-hidden rounded-lg border bg-muted/40 p-4">
                  <NodeGraph />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Full Cisco CLI */}
          <motion.div {...fadeUp(0.05)}>
            <Card className="ai-zone h-full">
              <CardHeader>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-cyan/10 text-cyan">
                  <Terminal className="h-5 w-5" />
                </span>
                <CardTitle className="mt-3 text-xl">Full Cisco CLI</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Export production-ready configuration scripts perfectly tuned
                  for Cisco IOS, NX-OS, or general vendor-neutral YAML.
                </p>
              </CardHeader>
              <CardContent>
                <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
                  <code>
                    <span className="text-slate-500">
                      ! Generated by NetTopo AI
                    </span>
                    {"\n"}
                    <span className="text-primary">router bgp</span> 65001{"\n"}
                    {"  "}bgp router-id 10.0.0.1{"\n"}
                    {"  "}
                    <span className="text-cyan">neighbor</span> 10.0.0.2
                    remote-as 65002{"\n"}
                    {"  "}...
                  </code>
                </pre>
              </CardContent>
            </Card>
          </motion.div>

          {/* Whiteboard OCR */}
          <motion.div {...fadeUp(0.1)}>
            <Card className="h-full">
              <CardHeader>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ScanLine className="h-5 w-5" />
                </span>
                <CardTitle className="mt-3 text-xl">Whiteboard OCR</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Upload photos of hand-drawn diagrams. Our vision model parses
                  shapes and text to digitize your brainstorms instantly.
                </p>
              </CardHeader>
            </Card>
          </motion.div>

          {/* Smart Capacity Planning */}
          <motion.div {...fadeUp(0.15)}>
            <Card className="h-full">
              <CardHeader>
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <BarChart3 className="h-5 w-5" />
                </span>
                <CardTitle className="mt-3 text-xl">
                  Smart Capacity Planning
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Predict bandwidth bottlenecks and validate redundancy paths
                  before deployment using integrated simulation heuristics.
                </p>
              </CardHeader>
              <CardContent>
                <div className="flex h-32 items-end justify-between gap-2 rounded-lg border bg-muted/40 p-4">
                  {capacityBars.map((h, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex-1 rounded-t bg-primary/20",
                        h,
                        i === 4 && "bg-primary",
                      )}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function NodeGraph() {
  return (
    <svg
      viewBox="0 0 400 140"
      className="h-32 w-full"
      role="img"
      aria-label="Network nodes"
    >
      <g stroke="hsl(var(--primary) / 0.35)" strokeWidth="1.5">
        <line x1="60" y1="70" x2="170" y2="40" />
        <line x1="60" y1="70" x2="170" y2="100" />
        <line x1="170" y1="40" x2="280" y2="60" />
        <line x1="170" y1="100" x2="280" y2="60" />
        <line x1="280" y1="60" x2="350" y2="95" />
      </g>
      <g>
        <circle cx="60" cy="70" r="7" className="fill-primary" />
        <circle cx="170" cy="40" r="6" className="fill-cyan" />
        <circle cx="170" cy="100" r="6" className="fill-cyan" />
        <circle cx="280" cy="60" r="8" className="fill-primary" />
        <circle cx="350" cy="95" r="6" className="fill-cyan" />
      </g>
    </svg>
  );
}