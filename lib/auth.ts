import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db/prisma";

/**
 * Returns the local DB user for the signed-in Clerk account,
 * creating it on first login (lazy sync). Returns null if signed out.
 */
export async function getDbUser() {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (existing) return existing;

  const cu = await currentUser();
  const email = cu?.emailAddresses[0]?.emailAddress ?? `${userId}@placeholder.local`;
  return prisma.user.create({
    data: { clerkId: userId, email, name: cu?.firstName ?? null },
  });
}

/** Throws a 401 Response when there is no signed-in user. */
export async function requireUser() {
  const user = await getDbUser();
  if (!user) throw new Response("Unauthorized", { status: 401 });
  return user;
}
