// @vitest-environment node
// Runs in Node (not jsdom) so undici's FormData/Request interop works correctly.
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/upload/route";

function fileRequest(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return new Request("http://localhost/api/upload", { method: "POST", body: fd });
}

describe("POST /api/upload", () => {
  it("rejects a request with no file (400)", async () => {
    const req = new Request("http://localhost/api/upload", { method: "POST", body: new FormData() });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("rejects an unsupported file type (415)", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const res = await POST(fileRequest(file) as never);
    expect(res.status).toBe(415);
  });

  it("accepts a valid PNG (200)", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "diagram.png", { type: "image/png" });
    const res = await POST(fileRequest(file) as never);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});