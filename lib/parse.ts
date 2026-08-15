/**
 * Marketplace titles are noisy:
 *   "Bandai Hobby Mobile Suit Gundam: The Witch from Mercury Demi Barding
 *    High Grade 1/144 Model Kit NEW"
 * These rules pull out the structured bits and strip the rest. They are
 * heuristics, which is exactly why nothing saves without you confirming it.
 */

export interface Parsed {
  name: string;
  series: string | null;
  manufacturer: string | null;
  line: string | null;
  scale: string | null;
  kitNumber: string | null;
}

const MAKERS = [
  "Bandai Spirits", "Bandai", "Tamiya", "Hasegawa", "Kotobukiya", "Trumpeter",
  "Meng", "Takom", "Zvezda", "Revell", "Airfix", "Academy", "Dragon", "Italeri",
  "Fujimi", "Aoshima", "Wave", "Good Smile", "Daban", "Moshow", "Reload",
  "Motor Nuclear", "Super Nova", "Dragon Momoko", "TT Hongli", "Zhanyi", "Eaglemoss",
];

/** Brand fields often hold a franchise rather than a maker. These are not makers. */
const NOT_MAKERS = /^(gundam|mobile suit.*|bandai namco.*|gunpla|star wars|marvel|dc|pokemon|evangelion|macross|zoids)$/i;

/** Long form to the form modellers actually use. */
const LINE_MAP: Record<string, string> = {
  "perfect grade": "PG", "master grade": "MG", "real grade": "RG",
  "entry grade": "EG", "high grade": "HG", "full mechanics": "FM",
  "advance of zeta": "HG", "super deformed": "SD",
};
const LINES = [
  "MGEX", "MGSD", "HGUC", "HGCE", "HGBF", "HGIBO", "RE/100", "Full Mechanics",
  "Perfect Grade", "Master Grade", "Real Grade", "Entry Grade", "High Grade",
  "Super Deformed", "PG", "MG", "RG", "EG", "HG", "SD", "FM",
];

/** Series names. Useful to keep, but not part of the kit's own name. */
const SERIES = [
  "Mobile Suit Gundam: The Witch from Mercury", "The Witch from Mercury",
  "Mobile Suit Gundam: Iron-Blooded Orphans", "Iron-Blooded Orphans",
  "Mobile Suit Gundam SEED Freedom", "Mobile Suit Gundam SEED Destiny",
  "Mobile Suit Gundam SEED", "Mobile Suit Gundam Unicorn",
  "Mobile Suit Gundam Wing", "Mobile Suit Zeta Gundam",
  "Mobile Suit Gundam Hathaway", "Mobile Suit Gundam 00",
  "Gundam Build Metaverse", "Gundam Build Divers", "Gundam Build Fighters",
  "Gundam Breaker Battlogue", "Mobile Suit Gundam", "Gundam Thunderbolt",
  "SD Gundam G Generation-0 Gzero", "SD Gundam G Generation-0",
  "SD Gundam G Generation", "G Generation-0 Gzero", "Ggeneration-0 Gzero",
  "G Generation-0", "Ggeneration-0", "Gzero",
  "SD Gundam World Heroes", "SD Gundam Sangoku", "BB Senshi Sangokuden",
  "Gundam After War X", "After War Gundam X",
].sort((a, b) => b.length - a.length);

// Order matters: longest phrases first, or a short rule eats part of a long
// one and strands the remainder ("Plastic Model Kit" -> "Plastic").
const NOISE = [
  /[\[\(\u3010][^\]\)\u3011]*[\]\)\u3011]/g,
  /\bfrom\s+japan\b/gi, /\bmade\s+in\s+japan\b/gi,
  /\bplastic\s*model(ing)?\s*kit\b/gi, /\bplastic\s*model(ing)?\b/gi,
  /\bmodel\s*kit\b/gi, /\baction\s*figure\b/gi,
  /\bthird\s*party\b/gi, /\bbrand\s*new\b/gi,
  /\bus\s*seller\b/gi, /\bfree\s*ship(ping)?\b/gi, /\bfast\s*ship(ping)?\b/gi,
  /\bin\s*stock\b/gi, /\bpre[\s-]?order\b/gi,
  /\bplamo\b/gi, /\bplastic\b/gi, /\bscale\b/gi, /\bkit\b/gi, /\bhobby\b/gi,
  /\bnew\b/gi, /\bsealed\b/gi, /\bmisb\b/gi, /\bnib\b/gi, /\bboxed\b/gi,
  /\bauthentic\b/gi, /\bgenuine\b/gi, /\bofficial\b/gi, /\bltd\.?\b/gi,
  /\bimport(ed)?\b/gi, /\bjapan(ese)?\b/gi,
  /\bfor\b\s*$/gi, /\bfrom\b\s*$/gi, /^\s*\bby\b/gi,
];

function tidy(s: string): string {
  return s.replace(/\s+/g, " ").replace(/^[\s\-–—|,:;/]+|[\s\-–—|,:;/]+$/g, "").trim();
}

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseTitle(raw: string, brandHint?: string | null): Parsed {
  let s = " " + (raw || "") + " ";

  // 1. Maker. A known maker in the title always beats the source's brand field,
  //    because brand fields frequently hold a franchise ("Gundam") instead.
  let manufacturer = MAKERS.find((m) => new RegExp("\\b" + esc(m) + "\\b", "i").test(s)) ?? null;

  if (!manufacturer && brandHint) {
    const hint = brandHint.trim();
    // "BANDAI/GUNDAM WING" is a maker glued to a franchise. Take the maker.
    const inside = MAKERS.find((m) => new RegExp("\\b" + esc(m) + "\\b", "i").test(hint));
    if (inside) manufacturer = inside;
    else if (!NOT_MAKERS.test(hint) && !/[\/|]/.test(hint)) manufacturer = hint;
  }

  // 2. Grade first, because a series name can contain the grade ("SD Gundam
  //    G Generation") and stripping the series would take it with it.
  const lineHit = LINES.find((l) =>
    new RegExp("(^|\\s)" + esc(l) + "(\\s|$)", "i").test(s)
  );
  const line = lineHit ? (LINE_MAP[lineHit.toLowerCase()] ?? lineHit) : null;

  // 3. Series, removed from the name and kept separately.
  const series = SERIES.find((f) => new RegExp(esc(f), "i").test(s)) ?? null;
  if (series) s = s.replace(new RegExp(esc(series), "gi"), " ");

  // 4. Scale, and critically: remove it from the working string BEFORE looking
  //    for a kit number, or "1/144" gets read as kit number 144.
  const scaleMatch = s.match(/\b1\s*[\/:]\s*(\d{1,4})\s*(?:th)?\b/);
  const scale = scaleMatch ? "1/" + scaleMatch[1] : null;
  if (scaleMatch) s = s.replace(scaleMatch[0], " ");

  // 5. Kit number, from what is left.
  const labelled = s.match(/(?:^|[\s(])(?:no\.?\s*|#\s*)(\d{1,7}[A-Z]?)\b/i);
  const bare = s.match(/\b([A-Z]{1,3}-?\d{3,7}[A-Z]?|\d{4,7})\b/);
  const numMatch = labelled ?? bare;
  const kitNumber = numMatch ? numMatch[1] : null;

  // 6. Name is whatever survives.
  let name = s;
  NOISE.forEach((r) => (name = name.replace(r, " ")));
  if (manufacturer) name = name.replace(new RegExp("\\b" + esc(manufacturer) + "\\b", "gi"), " ");
  if (lineHit) name = name.replace(new RegExp("\\b" + esc(lineHit) + "\\b", "gi"), " ");
  if (kitNumber) {
    name = name.replace(new RegExp("(?:no\\.?\\s*|#\\s*)?\\b" + esc(kitNumber) + "\\b", "gi"), " ");
  }
  name = tidy(name);

  return {
    name: name || tidy(raw),
    series,
    manufacturer,
    line,
    scale,
    kitNumber,
  };
}

/** Deterministic tint so a kit without a photo still has a stable colour. */
export function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `hsl(${h} 38% 34%)`;
}
