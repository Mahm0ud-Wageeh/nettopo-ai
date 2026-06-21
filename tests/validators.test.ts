import { describe, it, expect } from "vitest";
import { parseInputSchema, topologySchema, createProjectSchema } from "@/lib/validators/schemas";

describe("zod validators", () => {
  it("defaults lang to auto", () => {
    const res = parseInputSchema.safeParse({ text: "hello network" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.lang).toBe("auto");
  });

  it("rejects too-short text", () => {
    expect(parseInputSchema.safeParse({ text: "" }).success).toBe(false);
  });

  it("rejects an unknown device type", () => {
    const bad = { devices: [{ id: "x", label: "x", type: "TOASTER" }], connections: [] };
    expect(topologySchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a valid project payload and defaults source to MANUAL", () => {
    const res = createProjectSchema.safeParse({ name: "My net" });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.source).toBe("MANUAL");
  });
});
