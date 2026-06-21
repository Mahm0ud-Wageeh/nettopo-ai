"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Upload, PencilRuler } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prompt", label: "Describe", icon: MessageSquare },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/editor/new", label: "Editor", icon: PencilRuler },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
      <nav className="flex flex-col gap-1">
        {items.map((item) => {
          const base = "/" + item.href.split("/").slice(1, 2).join("/");
          const active = pathname === item.href || pathname.startsWith(base + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
