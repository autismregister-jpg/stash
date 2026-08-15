"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { allKits, type Kit, type Status } from "@/lib/store";
import { Tile, ThemeToggle } from "@/lib/ui";

type Filter = "all" | Status;

export default function Home() {
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [list, setList] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    allKits().then(setKits);
    setList(localStorage.getItem("stash-view") === "list");
  }, []);

  const stats = useMemo(() => {
    const k = kits ?? [];
    const owned = k.filter((x) => x.status !== "wanted");
    return {
      owned: owned.length,
      done: owned.filter((x) => x.status === "built").length,
      bench: owned.filter((x) => x.status === "bench").length,
      unbuilt: owned.filter((x) => x.status === "unbuilt").length,
      total: k.length,
    };
  }, [kits]);

  const shown = useMemo(() => {
    let k = kits ?? [];
    if (filter !== "all") k = k.filter((x) => x.status === filter);
    if (q.trim()) {
      const t = q.toLowerCase();
      k = k.filter((x) =>
        [x.name, x.manufacturer, x.line, x.scale, x.kitNumber, x.tags.join(" ")]
          .join(" ").toLowerCase().includes(t)
      );
    }
    return k;
  }, [kits, filter, q]);

  const toggleView = () => {
    const next = !list;
    setList(next);
    localStorage.setItem("stash-view", next ? "list" : "grid");
  };

  // Grouped, not interleaved: unfinished first, then finished, so the band
  // reads as a proportion rather than as texture.
  const ticks = [
    ...Array(Math.max(0, stats.owned - stats.done)).fill("todo"),
    ...Array(stats.done).fill("done"),
  ];

  return (
    <>
      <main className="wrap">
        <div className="mast">
          <div className="mast-top">
            <div className="mark">Stash</div>
            <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
              <span className="count">{stats.total} kits</span>
              <ThemeToggle />
            </div>
          </div>

          <div className="band">
            {ticks.map((t, i) => (
              <div key={i} className="tick" data-s={t} style={{ animationDelay: `${Math.min(i * 12, 900)}ms` }} />
            ))}
          </div>

          <div className="legend">
            {kits === null
              ? "Loading"
              : `${stats.unbuilt} unbuilt · ${stats.bench} on the bench · ${stats.done} finished`}
          </div>
        </div>

        <div className="bar">
          {(["all", "unbuilt", "bench", "built", "wanted"] as Filter[]).map((f) => (
            <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f === "bench" ? "Bench" : f}
            </button>
          ))}
          <button className="chip right" onClick={toggleView}>{list ? "Grid" : "List"}</button>
        </div>

        {(kits?.length ?? 0) > 6 && (
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search your stash"
            style={{ marginBottom: 12 }}
          />
        )}

        {kits === null ? null : kits.length === 0 ? (
          <div className="empty">
            Nothing here yet.<br />Scan a box to add your first kit.
          </div>
        ) : shown.length === 0 ? (
          <div className="empty">No kits match that.</div>
        ) : (
          <div className={"grid" + (list ? " list" : "")}>
            {shown.map((k) => <Tile key={k.id} kit={k} />)}
          </div>
        )}

        {(kits?.length ?? 0) > 0 && (
          <div className="note">
            <Link href="/report">Make a share image</Link> · <Link href="/settings">Back up</Link>
          </div>
        )}
      </main>

      <nav className="dock">
        <div className="dock-in">
          <Link href="/add" style={{ flex: "0 0 34%" }}>
            <button className="btn ghost" style={{ width: "100%" }}>By hand</button>
          </Link>
          <Link href="/scan" style={{ flex: 1 }}>
            <button className="btn" style={{ width: "100%" }}>Scan a box</button>
          </Link>
        </div>
      </nav>
    </>
  );
}
