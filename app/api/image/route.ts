import { NextResponse } from "next/server";

/**
 * Fetches a product image server-side so the browser is not blocked by CORS,
 * and so the picture can be stored on the device permanently. Once saved, the
 * art keeps working offline and does not break when a listing disappears.
 */
export const maxDuration = 20;
export const dynamic = "force-dynamic";

const MAX_BYTES = 3_000_000;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") || "";

  let target: URL;
  try { target = new URL(raw); } catch { return new NextResponse("Bad url", { status: 400 }); }
  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return new NextResponse("Bad protocol", { status: 400 });
  }

  try {
    const r = await fetch(target.toString(), { cache: "no-store" });
    if (!r.ok) return new NextResponse("Upstream failed", { status: 502 });

    const type = r.headers.get("content-type") || "";
    if (!type.startsWith("image/")) return new NextResponse("Not an image", { status: 415 });

    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return new NextResponse("Too large", { status: 413 });

    return new NextResponse(buf, {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new NextResponse("Fetch failed", { status: 502 });
  }
}
