import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001/api/v1";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
  }

  try {
    const res = await fetch(`${API_BASE}/document-upload/${id}/content`);
    if (!res.ok) {
      return NextResponse.json(
        { error: "Document not found or unavailable" },
        { status: res.status }
      );
    }

    const data = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "application/octet-stream";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Error proxying document image:", error);
    return NextResponse.json(
      { error: "Failed to fetch document" },
      { status: 500 }
    );
  }
}
