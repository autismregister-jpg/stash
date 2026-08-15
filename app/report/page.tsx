"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { allKits, type Kit } from "@/lib/store";

/** Draws the share image on a canvas: the band, the counts, the breakdowns. */
function draw(c: HTMLCanvasElement, kits: Kit[], dark: boolean) {
  const W = 1080, H = 1080;
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;

  const bg = dark ? "#14171C" : "#E4E2DB";
  const ink = dark ? "#EAE8E1" : "#1B1F26";
  const soft = dark ? "#A7AFBA" : "#4A515D";
  const edge = dark ? "#454D58" : "#ADA99E";
  const cyan = dark ? "#3E9FC9" : "#0E6E93";

  g.fillStyle = bg; g.fillRect(0, 0, W, H);

  const owned = kits.filter(k => k.status !== "wanted");
  const done = owned.filter(k => k.status === "built").length;
  const bench = owned.filter(k => k.status === "bench").length;
  const unbuilt = owned.filter(k => k.status === "unbuilt").length;
  const value = owned.reduce((s, k) => s + (k.price || 0) * k.qty, 0);

  const M = 88;
  g.fillStyle = ink;
  g.font = "700 44px Archivo, system-ui, sans-serif";
  g.fillText("STASH", M, 132);
  g.fillStyle = soft;
  g.font = "400 30px 'IBM Plex Mono', monospace";
  g.fillText(`${kits.length} kits`, W - M - g.measureText(`${kits.length} kits`).width, 132);

  g.strokeStyle = edge; g.lineWidth = 2;
  g.beginPath(); g.moveTo(M, 160); g.lineTo(W - M, 160); g.stroke();

  // the band
  const bw = W - M * 2, top = 208, bh = 70;
  const n = Math.max(owned.length, 1);
  const gap = n > 90 ? 1 : 3;
  const tw = (bw - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i >= n - done ? cyan : edge;
    g.fillRect(M + i * (tw + gap), top, Math.max(tw, 1), bh);
  }

  g.fillStyle = soft;
  g.font = "400 27px 'IBM Plex Mono', monospace";
  g.fillText(`${unbuilt} unbuilt   ${bench} on the bench   ${done} finished`, M, top + bh + 52);

  // breakdowns
  const tally = (fn: (k: Kit) => string) => {
    const m = new Map<string, number>();
    owned.forEach(k => { const v = fn(k) || "Unknown"; m.set(v, (m.get(v) || 0) + k.qty); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  };

  const block = (title: string, rows: [string, number][], y: number) => {
    g.fillStyle = soft;
    g.font = "500 24px 'IBM Plex Mono', monospace";
    g.fillText(title.toUpperCase(), M, y);
    let yy = y + 46;
    const max = Math.max(...rows.map(r => r[1]), 1);
    rows.forEach(([label, count]) => {
      g.fillStyle = ink;
      g.font = "500 28px Inter, system-ui, sans-serif";
      g.fillText(label, M, yy);
      g.fillStyle = soft;
      const t = String(count);
      g.font = "400 26px 'IBM Plex Mono', monospace";
      g.fillText(t, W - M - g.measureText(t).width, yy);
      g.fillStyle = edge;
      g.fillRect(M, yy + 12, (bw * count) / max, 4);
      yy += 62;
    });
    return yy;
  };

  let y = block("By maker", tally(k => k.manufacturer), 430);
  y = block("By grade or type", tally(k => k.line), y + 44);

  if (value > 0) {
    g.fillStyle = soft;
    g.font = "500 24px 'IBM Plex Mono', monospace";
    g.fillText("VALUE OF THE PILE", M, y + 44);
    g.fillStyle = ink;
    g.font = "700 54px Archivo, system-ui, sans-serif";
    g.fillText(value.toLocaleString(), M, y + 108);
  }

  g.fillStyle = edge;
  g.font = "400 22px 'IBM Plex Mono', monospace";
  const stamp = new Date().toLocaleDateString();
  g.fillText(stamp, M, H - 62);
}

export default function Report() {
  const router = useRouter();
  const ref = useRef<HTMLCanvasElement>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => { allKits().then(setKits); }, []);

  useEffect(() => {
    if (!ref.current || kits.length === 0) return;
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    const go = () => { draw(ref.current!, kits, dark); setReady(true); };
    (document as any).fonts?.ready?.then(go) ?? go();
  }, [kits]);

  const saveImage = () => {
    const a = document.createElement("a");
    a.href = ref.current!.toDataURL("image/png");
    a.download = `stash-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  };

  return (
    <main className="wrap">
      <button className="back" onClick={() => router.push("/")}>← Stash</button>
      <h2>Share image</h2>
      {kits.length === 0 ? (
        <div className="empty">Add some kits first.</div>
      ) : (
        <>
          <canvas ref={ref} style={{ width: "100%", border: "1px solid var(--sprue)", borderRadius: 2 }} />
          <button className="btn" onClick={saveImage} disabled={!ready}>Save the image</button>
          <div className="note">
            Saves a PNG to your phone. Send it to your friends however you like.
          </div>
        </>
      )}
    </main>
  );
}
