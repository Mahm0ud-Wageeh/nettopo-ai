import Link from "next/link";
import { Logo } from "@/components/shared/logo";

const links = [
  { label: "Privacy", href: "#" },
  { label: "Terms", href: "#" },
  { label: "API Docs", href: "#" },
  { label: "Github", href: "https://github.com/Mahm0ud-Wageeh/nettopo-ai" },
];

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container flex flex-col items-center gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <Logo className="text-base" />
        <p>© 2024 NetTopo AI Systems</p>
        <nav className="flex items-center gap-5 font-mono text-xs">
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}