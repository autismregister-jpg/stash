"use client";

import { openDB, type IDBPDatabase } from "idb";

export type Status = "unbuilt" | "bench" | "built" | "wanted";

export interface LogEntry {
  date: string;   // ISO date
  text: string;
}

export interface Kit {
  id: string;
  name: string;
  manufacturer: string;
  line: string;
  scale: string;
  kitNumber: string;
  barcode: string;
  variant: "jp" | "asia" | "third" | "unknown";
  status: Status;
  tags: string[];
  price: number | null;
  qty: number;
  rating: number;          // 0 to 5, 0 means unrated
  notes: string;
  log: LogEntry[];
  photo: string | null;   // data URL; Blobs cannot be stored on WebKit
  imageUrl: string;      // remote art, used until the blob is saved
  tint: string;
  source: string;          // where the data came from
  sourceTitle: string;     // the raw listing text, so a bad parse is visible
  createdAt: string;
  updatedAt: string;
}

/**
 * Bump this whenever lib/parse.ts changes. Cached lookups store the PARSED
 * result, so without a version stamp a parser fix would never reach any
 * barcode already scanned on this device.
 */
export const PARSE_VERSION = 6;

/** Cached barcode lookups, so the same code is never fetched twice. */
export interface CacheRow {
  code: string;
  payload: any;
  v: number;
  at: string;
}

const NAME = "stash";
const VERSION = 1;

let dbp: Promise<IDBPDatabase> | null = null;

function db() {
  if (!dbp) {
    dbp = openDB(NAME, VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("kits")) {
          const s = d.createObjectStore("kits", { keyPath: "id" });
          s.createIndex("status", "status");
          s.createIndex("barcode", "barcode");
        }
        if (!d.objectStoreNames.contains("lookups")) {
          d.createObjectStore("lookups", { keyPath: "code" });
        }
        if (!d.objectStoreNames.contains("meta")) {
          d.createObjectStore("meta");
        }
      },
    });
  }
  return dbp;
}

export function newId() {
  return (crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(16).slice(2));
}

export function blankKit(partial: Partial<Kit> = {}): Kit {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: "", manufacturer: "", line: "", scale: "", kitNumber: "",
    barcode: "", variant: "unknown", status: "unbuilt", tags: [],
    price: null, qty: 1, rating: 0, notes: "", log: [], photo: null, imageUrl: "",
    tint: "hsl(210 20% 34%)", source: "manual", sourceTitle: "",
    createdAt: now, updatedAt: now,
    ...partial,
  };
}

export async function allKits(): Promise<Kit[]> {
  const rows: Kit[] = await (await db()).getAll("kits");
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getKit(id: string): Promise<Kit | undefined> {
  return (await db()).get("kits", id);
}

export async function putKit(k: Kit) {
  k.updatedAt = new Date().toISOString();
  await (await db()).put("kits", k);
  return k;
}

export async function deleteKit(id: string) {
  await (await db()).delete("kits", id);
}

export async function findByBarcode(code: string): Promise<Kit[]> {
  return (await db()).getAllFromIndex("kits", "barcode", code);
}

export async function cacheGet(code: string): Promise<any | null> {
  const row: CacheRow = await (await db()).get("lookups", code);
  if (!row) return null;
  if (row.v !== PARSE_VERSION) return null;   // stale parse, fetch it fresh
  return row.payload;
}

export async function cachePut(code: string, payload: any) {
  await (await db()).put("lookups", {
    code, payload, v: PARSE_VERSION, at: new Date().toISOString(),
  });
}

export async function clearLookupCache() {
  await (await db()).clear("lookups");
}

/* ── backup ──────────────────────────────────────────────────────────── */

export async function exportJson(): Promise<string> {
  const kits = await allKits();
  return JSON.stringify(
    { app: "stash", version: 2, exportedAt: new Date().toISOString(), kits },
    null, 2
  );
}

export async function importJson(text: string): Promise<number> {
  const data = JSON.parse(text);
  if (!data?.kits) throw new Error("That file is not a Stash backup.");
  let n = 0;
  for (const raw of data.kits) {
    const k: Kit = { ...blankKit(), ...raw };
    k.photo = typeof raw.photo === "string" && raw.photo.startsWith("data:") ? raw.photo : null;
    await (await db()).put("kits", k);
    n++;
  }
  return n;
}

export async function exportCsv(): Promise<string> {
  const kits = await allKits();
  const head = ["Name","Manufacturer","Line","Scale","Kit number","Barcode","Variant","Status","Qty","Price","Rating","Tags","Notes"];
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = kits.map((k) =>
    [k.name,k.manufacturer,k.line,k.scale,k.kitNumber,k.barcode,k.variant,k.status,k.qty,k.price ?? "",k.rating || "",k.tags.join(" "),k.notes].map(esc).join(",")
  );
  return [head.map(esc).join(","), ...rows].join("\n");
}
