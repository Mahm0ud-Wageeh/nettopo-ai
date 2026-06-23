"use client";
import Link from "next/link";
import {
  Bell,
  Loader2,
  Network as NetworkIcon,
  Save,
  Server,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WorkspaceView = "network" | "nodes" | "cli" | "security";

const TABS: { id: WorkspaceView; label: string; icon: typeof NetworkIcon }[] = [
  { id: "network", label: "Network", icon: NetworkIcon },
  { id: "nodes", label: "Nodes", icon: Server },
  { id: "cli", label: "CLI", icon: Terminal },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export function WorkspaceTopbar({
  view,
  onView,
  onSave,
  saving,
}: {
  view: WorkspaceView;
  onView: (v: WorkspaceView) => void;
  onSave?: () => void;
  saving?: boolean;
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-6 border-b bg-background/80 px-4 backdrop-blur-xl">
      <Logo />
      <nav className="flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onView(t.id)}
            className={cn(
              "relative flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
              view === t.id
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
            {view === t.id && (
              <span className="absolute inset-x-2 -bottom-[15px] h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-1.5">
        {onSave && (
          <Button size="sm" onClick={onSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Save
          </Button>
        )}
        <Link
          href="/dashboard"
          aria-label="Notifications"
          title="Projects"
          className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </Link>
        <ThemeToggle />
        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>
      </div>
    </header>
  );
}