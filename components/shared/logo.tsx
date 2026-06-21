import { Network } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 font-bold", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Network className="h-5 w-5" />
      </span>
      <span>
        NetTopo<span className="text-primary"> AI</span>
      </span>
    </Link>
  );
}
