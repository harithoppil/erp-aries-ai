import { NextRequest, NextResponse } from "next/server";
import { createMarkItDown } from "@/lib/markitdown/markitdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "No file provided. Send a file as multipart/form-data with key 'file'." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Read Gemini API key from env (never from query params — security)
    const geminiApiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || undefined;

    const engine = await createMarkItDown();
    const result = await engine.convert(buffer, {
      filename: file.name,
      extension: file.name.includes(".") ? `.${file.name.split(".").pop()}` : undefined,
      mimetype: file.type || undefined,
    }, {
      geminiApiKey,
      geminiModel: "gemini-3-flash-preview",
      imagePrompt: "Describe this image in detail, including any text, tables, charts, or diagrams visible.",
    });

    return NextResponse.json({
      markdown: result.markdown,
      title: result.title,
      filename: file.name,
    });
  } catch (error: any) {
    console.error("[MarkItDown] Conversion failed:", error?.message || error);

    const status = error?.name === "UnsupportedFormatError" ? 415 : 500;
    return NextResponse.json(
      {
        error: error?.message || "Conversion failed",
        details: error?.attempts || undefined,
      },
      { status }
    );
  }
}
