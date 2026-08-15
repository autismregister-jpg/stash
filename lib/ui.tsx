"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Kit } from "./store";

/** Photo if we have one, otherwise a stable tint derived from the name. */
export function useArt(photo: Blob | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) { setUrl(null); return; }
    const u = URL.createObjectURL(photo);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);
  return url;
}

export function artStyle(kit: Kit, url: string | null): React.CSSProperties {
  if (url) return { backgroundImage: `url(${url})` };
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
