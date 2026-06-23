import Link from "next/link";
import { Plus, FolderKanban, Cpu, Network, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/prisma";
import { getDbUser } from "@/lib/auth";

// Server component: lists the signed-in user's saved projects from Supabase.
export const dynamic = "force-dynamic";

function formatDate(d: Date) {
  return new Date(d).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const user = await getDbUser();
  const projects = user
    ? await prisma.project.findMany({
        where: { ownerId: user.id },
        orderBy: { updatedAt: "desc" },
        include: {
          topology: { include: { devices: true, connections: true } },
          plan: true,
        },
      })
    : [];

  // Real aggregate stats derived from the saved projects (no fake monitoring).
  const totalDevices = projects.reduce(
    (sum, p) => sum + (p.topology?.devices.length ?? 0),
    0,
  );
  const totalVlans = projects.reduce((sum, p) => {
    const vlans = p.plan?.vlanPlan;
    return sum + (Array.isArray(vlans) ? vlans.length : 0);
  }, 0);
  const lastUpdated = projects[0]?.updatedAt;

  const stats = [
    { label: "Projects", value: String(projects.length), icon: FolderKanban },
    { label: "Devices", value: String(totalDevices), icon: Cpu },
    { label: "VLANs", value: String(totalVlans), icon: Network },
    {
      label: "Last updated",
      value: lastUpdated ? formatDate(lastUpdated) : "—",
      icon: Clock,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header banner */}
      <div className="relative overflow-hidden rounded-xl border bg-card p-6">
        <div
          className="pointer-events-none absolute inset-0 cyber-grid"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 brand-glow"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <Badge variant="ai" className="mb-2">
              WORKSPACE
            </Badge>
            <h1 className="font-display text-2xl font-bold">Your projects</h1>
            <p className="text-sm text-muted-foreground">
              {projects.length} saved network{projects.length === 1 ? "" : "s"}
            </p>
          </div>
          <Button asChild>
              <Link href="/prompt">Create your first network</Link>
              <Link href="/">Create your first network</Link>
          </Button>
        </div>
      </div>

      {/* Real stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="surface-elevated">
            <CardContent className="flex items-center gap-3 p-4">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
                <s.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xl font-bold leading-none">{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Projects */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="text-muted-foreground">No saved projects yet.</p>
            <Button asChild variant="outline">
              <Link href="/prompt">Create your first network</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => {
            const deviceCount = p.topology?.devices.length ?? 0;
            const linkCount = p.topology?.connections.length ?? 0;
            return (
              <Link key={p.id} href={`/result/${p.id}`} className="group">
                <Card className="h-full transition-all hover:border-primary/50 hover:shadow-md">
                  <CardHeader className="flex-row items-start justify-between gap-2">
                    <CardTitle className="text-base group-hover:text-primary">
                      {p.name}
                    </CardTitle>
                    <Badge variant="secondary">{p.source}</Badge>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="flex items-center gap-1">
                        <Cpu className="h-3.5 w-3.5" /> {deviceCount} devices
                      </span>
                      <span className="flex items-center gap-1">
                        <Network className="h-3.5 w-3.5" /> {linkCount} links
                      </span>
                    </div>
                    <p className="text-xs">Updated {formatDate(p.updatedAt)}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}