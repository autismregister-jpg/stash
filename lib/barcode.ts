/** Everything here runs offline. No network, no cost, instant. */

export interface Origin {
  region: string | null;
  cloneHint: boolean;
  isBook: boolean;
}

/** EAN-13 / UPC-A check digit. Catches a misread before we spend a lookup. */
export function isValidGtin(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop() as number;
  let sum = 0;
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}

/**
 * GS1 prefix tells you which country's authority issued the code.
 * The useful case: a 690-699 code on a box marked Bandai means the barcode
 * was registered in China, which is strong evidence of a third-party kit.
 */
export function gs1Origin(code: string): Origin {
  const p = Number(code.slice(0, 3));
  const at = (a: number, b: number) => p >= a && p <= b;

  if (at(978, 979)) return { region: "Bookland (this is a book)", cloneHint: false, isBook: true };
  if (at(450, 459) || at(490, 499)) return { region: "Japan", cloneHint: false, isBook: false };
  if (at(690, 699)) return { region: "China", cloneHint: true, isBook: false };
  if (at(880, 880)) return { region: "South Korea", cloneHint: false, isBook: false };
  if (at(890, 890)) return { region: "India", cloneHint: false, isBook: false };
  if (at(0, 139)) return { region: "US or Canada", cloneHint: false, isBook: false };
  if (at(400, 440)) return { region: "Germany", cloneHint: false, isBook: false };
  if (at(500, 509)) return { region: "United Kingdom", cloneHint: false, isBook: false };
  if (at(300, 379)) return { region: "France", cloneHint: false, isBook: false };
  if (at(800, 839)) return { region: "Italy", cloneHint: false, isBook: false };
  return { region: null, cloneHint: false, isBook: false };
}
