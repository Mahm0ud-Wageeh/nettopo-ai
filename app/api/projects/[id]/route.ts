import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api/handler";
import { updateProjectSchema } from "@/lib/validators/schemas";

type Ctx = { params: { id: string } };

// GET /api/projects/[id] -> full project with topology + plan
export function GET(_req: NextRequest, { params }: Ctx) {
  return route(async () => {
    const user = await requireUser();
    const project = await prisma.project.findFirst({
      where: { id: params.id, ownerId: user.id },
      include: { topology: { include: { devices: true, connections: true } }, plan: true },
    });
    if (!project) throw new Response("Not found", { status: 404 });
    return { project };
  });
}

// PATCH /api/projects/[id]
export function PATCH(req: NextRequest, { params }: Ctx) {
  return route(async () => {
    const user = await requireUser();
    const data = updateProjectSchema.parse(await req.json());
    const result = await prisma.project.updateMany({
      where: { id: params.id, ownerId: user.id },
      data,
    });
    return { updated: result.count };
  });
}

// DELETE /api/projects/[id]
export function DELETE(_req: NextRequest, { params }: Ctx) {
  return route(async () => {
    const user = await requireUser();
    const result = await prisma.project.deleteMany({ where: { id: params.id, ownerId: user.id } });
    return { deleted: result.count };
  });
}
