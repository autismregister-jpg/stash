/**
 * Marketplace listings come back as noisy titles like
 *   "Bandai HG 1/144 RX-78-2 Gundam Model Kit NEW US Seller Free Ship"
 * These rules pull out the structured bits and strip the seller noise.
 * They are heuristics, not magic. The confirm screen exists because of that.
 */

export interface Parsed {
  name: string;
  manufacturer: string | null;
  line: string | null;
  scale: string | null;
  kitNumber: string | null;
}

const MAKERS = [
  "Bandai Spirits", "Bandai", "Tamiya", "Hasegawa", "Kotobukiya", "Trumpeter",
  "Meng", "Takom", "Zvezda", "Revell", "Airfix", "Academy", "Dragon", "Italeri",
  "Fujimi", "Aoshima", "Wave", "Good Smile", "Daban", "Moshow", "Reload",
  "Motor Nuclear", "Super Nova", "Dragon Momoko", "TT Hongli", "Zhanyi",
];

const LINES = [
  "MGEX", "MGSD", "HGUC", "HGCE", "HGBF", "HGIBO", "RE/100", "Full Mechanics",
  "Perfect Grade", "Master Grade", "Real Grade", "Entry Grade", "High Grade",
  "PG", "MG", "RG", "EG", "HG", "SD", "FM",
];

const NOISE = [
  /\bmodel\s*kit\b/gi, /\bplastic\s*model\b/gi, /\bplamo\b/gi, /\bnew\b/gi,
  /\bsealed\b/gi, /\bmisb\b/gi, /\bnib\b/gi, /\bus\s*seller\b/gi,
  /\bfree\s*ship(ping)?\b/gi, /\bfast\s*ship(ping)?\b/gi, /\bin\s*stock\b/gi,
  /\bauthentic\b/gi, /\bgenuine\b/gi, /\bimport\b/gi, /\bjapan(ese)?\b/gi,
  /\bfrom\s+japan\b/gi, /\bbrand\s*new\b/gi, /\bofficial\b/gi,
  /[\[\(【][^\]\)】]*[\]\)】]/g,
];

function tidy(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–|,:/]+|[\s\-–|,:/]+$/g, "")
    .trim();
}

export function parseTitle(raw: string): Parsed {
  let s = " " + (raw || "") + " ";

  const manufacturer = MAKERS.find((m) => new RegExp("\\b" + m + "\\b", "i").test(s)) ?? null;

  const lineHit = LINES.find((l) =>
    new RegExp("(^|\\s)" + l.replace("/", "\\/") + "(\\s|$)", "i").test(s)
  );
  const line = lineHit ?? null;

  const scaleMatch = s.match(/\b1\s*[\/:]\s*(\d{1,4})\b/);
  const scale = scaleMatch ? "1/" + scaleMatch[1] : null;

  // A kit number is a standalone alphanumeric token that is not the scale.
  const numMatch = s.match(/\b(?:no\.?\s*)?([A-Z]{0,3}-?\d{3,7}[A-Z]?)\b/);
  const kitNumber = numMatch && !s.includes("1/" + numMatch[1]) ? numMatch[1] : null;

  // Build the display name by removing everything we captured plus the noise.
  let name = s;
  NOISE.forEach((r) => (name = name.replace(r, " ")));
  if (manufacturer) name = name.replace(new RegExp("\\b" + manufacturer + "\\b", "gi"), " ");
  if (lineHit) name = name.replace(new RegExp("\\b" + lineHit.replace("/", "\\/") + "\\b", "gi"), " ");
  if (scaleMatch) name = name.replace(scaleMatch[0], " ");
  name = tidy(name);

  return {
    name: name || tidy(raw),
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
