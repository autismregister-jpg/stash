import { NextResponse } from "next/server";
import { isValidGtin, gs1Origin } from "@/lib/barcode";
import { parseTitle } from "@/lib/parse";

export const maxDuration = 25;
export const dynamic = "force-dynamic";

interface Candidate {
  source: string;
  title: string;
  name: string;
  manufacturer: string | null;
  line: string | null;
  scale: string | null;
  kitNumber: string | null;
  price: number | null;
  image: string | null;
}

function toCandidate(source: string, title: string, extra: Partial<Candidate> = {}): Candidate {
  const p = parseTitle(title);
  return {
    source, title,
    name: p.name,
    manufacturer: p.manufacturer,
    line: p.line,
    scale: p.scale,
    kitNumber: p.kitNumber,
    price: null,
    image: null,
    ...extra,
  };
}

/** Needs no account. 100 lookups a day, counted per IP. */
async function upcitemdb(code: string): Promise<Candidate[]> {
  try {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.items || []).slice(0, 4).map((i: any) =>
      toCandidate("upcitemdb", i.title || "", {
        image: i.images?.[0] ?? null,
        manufacturer: i.brand || parseTitle(i.title || "").manufacturer,
      })
    );
  } catch { return []; }
}

/** Free developer account, 5000 calls a day. Best coverage for third-party kits. */
let ebayToken: { value: string; expires: number } | null = null;

async function ebayAuth(): Promise<string | null> {
  const id = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
  if (!id || !secret) return null;
  if (ebayToken && ebayToken.expires > Date.now() + 30_000) return ebayToken.value;

  const r = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
    },
    body: "grant_type=client_credentials&scope=" +
      encodeURIComponent("https://api.ebay.com/oauth/api_scope"),
    cache: "no-store",
  });
  if (!r.ok) return null;
  const d = await r.json();
  ebayToken = { value: d.access_token, expires: Date.now() + d.expires_in * 1000 };
  return ebayToken.value;
}

async function ebay(code: string): Promise<Candidate[]> {
  try {
    const token = await ebayAuth();
    if (!token) return [];
    const r = await fetch(
      `https://api.ebay.com/buy/browse/v1/item_summary/search?gtin=${code}&limit=5`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-EBAY-C-MARKETPLACE-ID": process.env.EBAY_MARKETPLACE || "EBAY_US",
        },
        cache: "no-store",
      }
    );
    if (!r.ok) return [];
    const d = await r.json();
    return (d.itemSummaries || []).slice(0, 4).map((i: any) =>
      toCandidate("ebay", i.title || "", {
        image: i.image?.imageUrl ?? null,
        price: i.price?.value ? Number(i.price.value) : null,
      })
    );
  } catch { return []; }
}

/** Free application ID. Best coverage for Bandai, Tamiya, Hasegawa. */
async function rakuten(code: string): Promise<Candidate[]> {
  const app = process.env.RAKUTEN_APP_ID;
  if (!app) return [];
  try {
    const url =
      "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601" +
      `?applicationId=${app}&keyword=${code}&hits=5&format=json`;
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.Items || []).slice(0, 4).map((w: any) =>
      toCandidate("rakuten", w.Item?.itemName || "", {
        image: w.Item?.mediumImageUrls?.[0]?.imageUrl ?? null,
        price: w.Item?.itemPrice ?? null,
      })
    );
  } catch { return []; }
}

function dedupe(list: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = (c.name || c.title).toLowerCase().replace(/\s+/g, " ").slice(0, 48);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(req: Request) {
  const code = (new URL(req.url).searchParams.get("code") || "").trim();

  if (!isValidGtin(code)) {
    return NextResponse.json({
      code, valid: false, origin: null, candidates: [],
      message: "That barcode failed its own check digit, so it was probably misread. Scan it again.",
    });
  }

  const origin = gs1Origin(code);

  if (origin.isBook) {
    return NextResponse.json({
      code, valid: true, origin, candidates: [],
      message: "That is a book barcode, not a model kit.",
    });
  }

  // Every configured source at once. Rakuten first in the list because its
  // titles are the cleanest when it is available.
  const results = await Promise.all([rakuten(code), ebay(code), upcitemdb(code)]);
  const candidates = dedupe(results.flat());

  const notes: string[] = [];
  if (origin.cloneHint) {
    notes.push("Chinese-registered barcode. If the box is marked Bandai, this is almost certainly a third-party kit.");
  }
  if (!candidates.length) {
    notes.push("Nothing found online for this code. Add the details by hand below.");
  }

  return NextResponse.json({
    code, valid: true, origin, candidates,
    message: notes.join(" ") || null,
  });
}
