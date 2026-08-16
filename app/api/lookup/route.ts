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

/**
 * Bandai Spirits' own product database, keyed directly by JAN.
 *
 * Their product page URL is the barcode with three zeros appended, so a kit's
 * page can be addressed from the barcode alone with no search step at all.
 * This is the manufacturer's own record: correct name, grade, scale, price,
 * release date and official box art. It beats any marketplace listing.
 *
 * Not an official API, so it could change without notice. It fails quietly and
 * the other sources still run.
 */
async function bandai(code: string, rep: SourceReport): Promise<Candidate[]> {
  rep.configured = true;
  try {
    const url = "https://www.bandaispirits.co.jp/products/search/detail.php" +
      `?prd_id=${code}000&grp_id=5325`;
    const r = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ja,en;q=0.8",
      },
    });
    if (!r.ok) {
      rep.note = r.status === 403
        ? "Bandai refused the request (403), likely blocking server traffic"
        : `Bandai replied ${r.status}`;
      return [];
    }

    const html = await r.text();

    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<title>([^<|\u2502]+)/i)?.[1]?.trim() ?? "";

    // A barcode with no product still returns a page, just without a real title.
    if (!title || /商品検索|PRODUCTS/.test(title) && title.length < 12) {
      rep.note = "Bandai has no product with this barcode";
      return [];
    }

    const image = html.match(/https:\/\/bandai-a\.akamaihd\.net\/bc\/img\/model\/[^\s"')]+\.jpg/i)?.[0] ?? null;
    const priceRaw = html.match(/([\d,]+)\s*円\(税込\)/)?.[1] ?? null;
    const released = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})?日?/)?.[0] ?? null;

    rep.count = 1;
    if (released) rep.note = `released ${released}`;

    return [toCandidate("bandai", title, {
      image,
      price: priceRaw ? Number(priceRaw.replace(/,/g, "")) : null,
    }, "Bandai")];
  } catch (e: any) {
    rep.note = "Bandai lookup failed: " + (e?.message || "unknown");
    return [];
  }
}

/**
 * Rakuten, two different indexes.
 *
 * Ichiba searches shop listings, which only match a barcode when the merchant
 * typed it into their listing text. Many do not, which is why a barcode that
 * plainly exists can come back empty. The Product index is Rakuten's own
 * catalogue and is indexed differently, so it is worth asking as well.
 */
async function rakuten(code: string, rep: SourceReport): Promise<Candidate[]> {
  const app = process.env.RAKUTEN_APP_ID;
  if (!app) { rep.note = "RAKUTEN_APP_ID not set on this deployment"; return []; }
  rep.configured = true;

  const notes: string[] = [];
  const out: Candidate[] = [];

  // 1. Rakuten's product catalogue.
  try {
    const url = "https://app.rakuten.co.jp/services/api/Product/Search/20170426" +
      `?applicationId=${encodeURIComponent(app)}&keyword=${code}&hits=10&format=json`;
    const r = await fetch(url, { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      for (const w of (d.Products || []).slice(0, 3)) {
        const it = w.Product ?? w;
        const title = it.productName || it.itemName || "";
        if (!title) continue;
        out.push(toCandidate("rakuten", title, {
          image: it.mediumImageUrl || it.smallImageUrl || null,
          price: it.averagePrice ?? it.maxPrice ?? null,
        }, it.makerName || it.brandName));
      }
      if (!out.length) notes.push("product catalogue: no match");
    } else {
      notes.push(`product catalogue replied ${r.status}`);
    }
  } catch (e: any) {
    notes.push("product catalogue failed: " + (e?.message || "unknown"));
  }

  // 2. Shop listings.
  try {
    const url = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601" +
      `?applicationId=${encodeURIComponent(app)}&keyword=${code}&hits=10&format=json`;
    const r = await fetch(url, { cache: "no-store" });

    if (!r.ok) {
      const body = await r.text();
      notes.push(`shop listings replied ${r.status}: ${body.slice(0, 120)}`);
    } else {
      const d = await r.json();
      const items = d.Items || [];
      if (!items.length) notes.push("shop listings: no merchant lists this barcode");
      for (const w of items.slice(0, 3)) {
        const it = w.Item ?? w;
        const image =
          it.mediumImageUrls?.[0]?.imageUrl ??
          it.smallImageUrls?.[0]?.imageUrl ??
          (typeof it.mediumImageUrls?.[0] === "string" ? it.mediumImageUrls[0] : null);
        out.push(toCandidate("rakuten", it.itemName || "", {
          image: image ? String(image).replace(/\?_ex=\d+x\d+$/, "") : null,
          price: it.itemPrice ?? null,
        }));
      }
    }
  } catch (e: any) {
    notes.push("shop listings failed: " + (e?.message || "unknown"));
  }

  rep.count = out.length;
  if (notes.length) rep.note = notes.join(" · ");
  return out;
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
    bandai:     { configured: false, count: 0 },
    rakuten:    { configured: false, count: 0 },
    ebay:       { configured: false, count: 0 },
    upcitemdb:  { configured: true,  count: 0 },
  };

  // Bandai first: it is the manufacturer's own record, so when it answers it is
  // the most trustworthy thing available.
  const results = await Promise.all([
    bandai(code, reports.bandai),
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
