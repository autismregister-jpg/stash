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
  series: string | null;
  price: number | null;
  image: string | null;
}

function toCandidate(source: string, title: string, extra: Partial<Candidate> = {}, brand?: string | null): Candidate {
  const p = parseTitle(title, brand);
  return {
    source, title,
    name: p.name,
    series: p.series,
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
async function upcitemdb(code: string, rep: SourceReport): Promise<Candidate[]> {
  try {
    const r = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    if (!r.ok) { rep.note = `UPCitemdb replied ${r.status}`; return []; }
    const d = await r.json();
    const out = (d.items || []).slice(0, 4).map((i: any) =>
      toCandidate("upcitemdb", i.title || "", { image: i.images?.[0] ?? null }, i.brand)
    );
    rep.count = out.length;
    if (!out.length) rep.note = "No record of this barcode";
    return out;
  } catch { rep.note = "UPCitemdb call failed"; return []; }
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

async function ebay(code: string, rep: SourceReport): Promise<Candidate[]> {
  try {
    if (!process.env.EBAY_CLIENT_ID) { rep.note = "EBAY_CLIENT_ID not set"; return []; }
    rep.configured = true;
    const token = await ebayAuth();
    if (!token) { rep.note = "eBay refused the credentials"; return []; }
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
    if (!r.ok) { rep.note = `eBay replied ${r.status}`; return []; }
    const d = await r.json();
    const out = (d.itemSummaries || []).slice(0, 4).map((i: any) =>
      toCandidate("ebay", i.title || "", {
        image: i.image?.imageUrl ?? null,
        price: i.price?.value ? Number(i.price.value) : null,
      })
    );
    rep.count = out.length;
    if (!out.length) rep.note = "No listing with this barcode";
    return out;
  } catch { rep.note = "eBay call failed"; return []; }
}

export interface SourceReport {
  configured: boolean;
  count: number;
  note?: string;
}

/** Free application ID. Best coverage for Bandai, Tamiya, Hasegawa. */
async function rakuten(code: string, rep: SourceReport): Promise<Candidate[]> {
  const app = process.env.RAKUTEN_APP_ID;
  if (!app) { rep.note = "RAKUTEN_APP_ID not set on this deployment"; return []; }
  rep.configured = true;

  try {
    const url =
      "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601" +
      `?applicationId=${encodeURIComponent(app)}&keyword=${code}&hits=10&format=json`;
    const r = await fetch(url, { cache: "no-store" });

    if (!r.ok) {
      const body = await r.text();
      rep.note = `Rakuten replied ${r.status}: ${body.slice(0, 160)}`;
      return [];
    }

    const d = await r.json();
    const items = d.Items || [];
    if (!items.length) { rep.note = "Rakuten has no listing carrying this barcode"; }

    const out = items.slice(0, 4).map((w: any) => {
      const it = w.Item ?? w;
      const image =
        it.mediumImageUrls?.[0]?.imageUrl ??
        it.smallImageUrls?.[0]?.imageUrl ??
        (typeof it.mediumImageUrls?.[0] === "string" ? it.mediumImageUrls[0] : null);
      return toCandidate("rakuten", it.itemName || "", {
        image: image ? String(image).replace(/\?_ex=\d+x\d+$/, "") : null,
        price: it.itemPrice ?? null,
      });
    });
    rep.count = out.length;
    return out;
  } catch (e: any) {
    rep.note = "Rakuten call threw: " + (e?.message || "unknown");
    return [];
  }
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
  const reports: Record<string, SourceReport> = {
    rakuten:    { configured: false, count: 0 },
    ebay:       { configured: false, count: 0 },
    upcitemdb:  { configured: true,  count: 0 },
  };

  const results = await Promise.all([
    rakuten(code, reports.rakuten),
    ebay(code, reports.ebay),
    upcitemdb(code, reports.upcitemdb),
  ]);
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
    sources: reports,
  });
}
