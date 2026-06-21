import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/ai/parse/route";

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/ai/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/parse", () => {
  it("parses a prompt into a structured intent (rule fallback, no API keys)", async () => {
    const res = await POST(jsonRequest({ text: "2 routers and 3 switches" }) as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    const types = data.intent.devices.map((d: { type: string }) => d.type);
    expect(types).toContain("ROUTER");
    expect(types).toContain("SWITCH");
  });

  it("returns a validation error (422) for empty input", async () => {
    const res = await POST(jsonRequest({ text: "" }) as never);
    expect(res.status).toBe(422);
  });
});
