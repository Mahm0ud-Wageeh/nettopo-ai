import { Network } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 font-display text-lg font-bold tracking-tight", className)}
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-cyan text-primary-foreground shadow-glow">
        <Network className="h-5 w-5" />
      </span>
      <span>
        NetTopo<span className="text-primary"> AI</span>
      </span>
    </Link>
  );
}