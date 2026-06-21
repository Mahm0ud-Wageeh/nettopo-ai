import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockProjects } from "@/lib/mock";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your projects</h1>
        <Button asChild>
          <Link href="/prompt">
            <Plus className="h-4 w-4" /> New project
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockProjects.map((p) => (
          <Link key={p.id} href={`/result/${p.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">{p.name}</CardTitle>
                <Badge variant="secondary">{p.source}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">Updated {p.updatedAt}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
