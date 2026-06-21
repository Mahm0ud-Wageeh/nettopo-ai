import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/**
 * POST /api/upload (multipart/form-data, field "file")
 * Validates an uploaded diagram. OCR itself runs client-side with
 * tesseract.js; this endpoint only validates type and size.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8 MB)" }, { status: 413 });
  }

  return NextResponse.json({ ok: true, name: file.name, size: file.size, type: file.type });
}
