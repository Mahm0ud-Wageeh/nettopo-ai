import type { NextRequest } from "next/server";
import { route } from "@/lib/api/handler";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { exportSchema } from "@/lib/validators/schemas";

/**
 * POST /api/export
 * Server-side JSON export of a project. PNG/PDF exports are produced
 * client-side (html-to-image + jsPDF) on the export page.
 */
export function POST(req: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const { projectId } = exportSchema.parse(await req.json());
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: user.id },
      include: { topology: { include: { devices: true, connections: true } }, plan: true },
    });
    if (!project) throw new Response("Not found", { status: 404 });
    return { project };
  });
}
