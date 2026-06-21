import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Wraps a route handler with uniform error handling. */
export function route<T>(fn: () => Promise<T>) {
  return (async () => {
    try {
      const data = await fn();
      return NextResponse.json(data);
    } catch (err) {
      if (err instanceof Response) return err; // e.g. 401 from requireUser
      if (err instanceof ZodError) {
        return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 422 });
      }
      console.error(err);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
  })();
}
