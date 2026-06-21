import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth";
import { route } from "@/lib/api/handler";
import { createProjectSchema } from "@/lib/validators/schemas";

// GET /api/projects -> current user's projects
export function GET() {
  return route(async () => {
    const user = await requireUser();
    const projects = await prisma.project.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    return { projects };
  });
}

// POST /api/projects -> create a project
export function POST(req: NextRequest) {
  return route(async () => {
    const user = await requireUser();
    const data = createProjectSchema.parse(await req.json());
    const project = await prisma.project.create({ data: { ...data, ownerId: user.id } });
    return { project };
  });
}
