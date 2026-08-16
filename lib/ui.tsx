"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Kit } from "./store";

/**
 * Photos are stored as data URLs, not Blobs: WebKit refuses to put a Blob into
 * IndexedDB ("Error preparing Blob/File data to be stored in object store").
 * Blobs are still accepted here so that older records keep working.
 */
export function useArt(photo: string | Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) { setUrl(null); return; }
    if (typeof photo === "string") { setUrl(photo); return; }
    const u = URL.createObjectURL(photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return url;
}

/**
 * Turn a picked file or a downloaded image into a compact JPEG data URL.
 * Downscaled because a phone photo is several megabytes and every device has a
 * storage quota that a few dozen of them would exhaust.
 */
export async function toStoredImage(src: Blob, max = 1200, quality = 0.82): Promise<string> {
  try {
    const bitmap = await createImageBitmap(src);
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    // Older engines, or an image the canvas will not take. Store it as is.
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = () => rej(new Error("Could not read that image."));
      r.readAsDataURL(src);
    });
  }
}

export function artStyle(kit: Kit, url: string | null): React.CSSProperties {
  if (url) return { backgroundImage: `url(${url})` };
  if (kit.imageUrl) {
    return { backgroundImage: `url(/api/image?url=${encodeURIComponent(kit.imageUrl)})` };
  }
  return { background: `linear-gradient(150deg, ${kit.tint}, rgba(0,0,0,.5))` };
}

export function Tile({ kit }: { kit: Kit }) {
  const url = useArt(kit.photo);
  const badge =
    kit.variant === "third" ? <span className="badge clone">Clone</span>
    : kit.status === "bench" ? <span className="badge bench">Bench</span>
    : kit.status === "built" ? <span className="badge">Built</span>
    : kit.status === "wanted" ? <span className="badge">Wanted</span>
    : null;

  return (
    <Link className="kit" href={`/kit/${kit.id}`}>
      <div className="art" style={artStyle(kit, url)}>
        {badge}
        <span>{kit.manufacturer || "Unknown"}</span>
      </div>
      <div className="kit-b">
        <div className="kit-n">{kit.name || "Untitled kit"}</div>
        <div className="kit-m">
          {[kit.line, kit.scale, kit.kitNumber].filter(Boolean).join(" · ") || "No details yet"}
        </div>
      </div>
    </Link>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") || "light");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("stash-theme", next);
    setTheme(next);
  };
  return (
    <button className="chip" onClick={flip} style={{ padding: "6px 10px" }}>
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

export function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
