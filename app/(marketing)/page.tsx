"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Cpu, Image as ImageIcon, Network, ShieldCheck, Workflow } from "lucide-react";
import { Navbar } from "@/components/shared/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  { icon: Cpu, title: "Natural language", desc: "Describe your network in Arabic or English and let the AI structure it." },
  { icon: ImageIcon, title: "Image to topology", desc: "Upload a diagram or screenshot; OCR extracts the devices." },
  { icon: Workflow, title: "Manual editor", desc: "Drag devices and draw links on an interactive canvas." },
  { icon: Network, title: "Auto diagram", desc: "Get a clean, professional topology generated for you." },
  { icon: ShieldCheck, title: "Full plan", desc: "IP plan, subnetting, VLANs, routing and security notes." },
];

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <section className="container flex flex-col items-center gap-6 py-24 text-center">
        <motion.h1
          initial={ { opacity: 0, y: 20 } }
          animate={ { opacity: 1, y: 0 } }
          transition={ { duration: 0.5 } }
          className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl"
        >
          Design and plan networks with <span className="text-primary">AI</span>
        </motion.h1>
        <motion.p
          initial={ { opacity: 0, y: 20 } }
          animate={ { opacity: 1, y: 0 } }
          transition={ { duration: 0.5, delay: 0.1 } }
          className="max-w-2xl text-lg text-muted-foreground"
        >
          NetTopo AI turns a description, a screenshot, or a few clicks into a professional topology
          diagram and a complete IP, VLAN, and routing plan.
        </motion.p>
        <motion.div
          initial={ { opacity: 0, y: 20 } }
          animate={ { opacity: 1, y: 0 } }
          transition={ { duration: 0.5, delay: 0.2 } }
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <Button asChild size="lg">
            <Link href="/prompt">
              Start describing <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/upload">Upload a diagram</Link>
          </Button>
        </motion.div>
      </section>
      <section className="container grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={ { opacity: 0, y: 20 } }
            whileInView={ { opacity: 1, y: 0 } }
            viewport={ { once: true } }
            transition={ { duration: 0.4, delay: i * 0.05 } }
          >
            <Card className="h-full">
              <CardContent className="flex flex-col gap-2 p-6">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </section>
    </main>
  );
}
