"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getKit, putKit, deleteKit, type Kit, type Status } from "@/lib/store";
import { useArt, artStyle } from "@/lib/ui";

const LABEL: Record<Status, string> = {
  unbuilt: "Unbuilt", bench: "On the bench", built: "Finished", wanted: "Wanted",
};
const VARIANT: Record<string, string> = {
  jp: "JP release", asia: "Asia release", third: "Third party", unknown: "Unconfirmed",
};

/** Search links built from the kit's own fields. Nothing is fetched or copied in. */
function links(k: Kit) {
  const q = encodeURIComponent([k.manufacturer, k.line, k.scale, k.name].filter(Boolean).join(" "));
  return [
    { label: "Scalemates", hint: "reviews · variants", href: `https://www.scalemates.com/search.php?q=${q}` },
    { label: "YouTube", hint: "build videos", href: `https://www.youtube.com/results?search_query=${q}+build` },
    { label: "HobbyLink Japan", hint: "price · stock", href: `https://www.hlj.com/search/?Word=${q}` },
    { label: "Search the web", hint: "everything else", href: `https://duckduckgo.com/?q=${q}` },
  ];
}

export default function KitPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [k, setK] = useState<Kit | null>(null);
  const [entry, setEntry] = useState("");
  const url = useArt(k?.photo);

  useEffect(() => { getKit(id).then((r) => setK(r ?? null)); }, [id]);

  if (!k) return <main className="wrap"><div className="note" style={{ paddingTop: 60 }}>Loading</div></main>;

  const save = async (next: Kit) => { setK(next); await putKit(next); };

  const addEntry = async () => {
    if (!entry.trim()) return;
    const log = [{ date: new Date().toISOString().slice(0, 10), text: entry.trim() }, ...k.log];
    await save({ ...k, log });
    setEntry("");
  };

  return (
    <main className="wrap">
      <button className="back" onClick={() => router.push("/")}>← Stash</button>

      <div className="hero" style={artStyle(k, url)} />

      <h1 className="d-title">{k.name}</h1>
      <div className="d-meta">
        {[k.manufacturer, k.line, k.scale, k.kitNumber].filter(Boolean).join(" · ") || "No details"}
      </div>

      <div className="tags">
        <span className={"tag" + (k.variant === "third" ? " warn" : "")}>{VARIANT[k.variant]}</span>
        <span className="tag on">{LABEL[k.status]}</span>
        {k.qty > 1 && <span className="tag">x{k.qty}</span>}
        {k.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
      </div>

      <section>
        <h2>Status</h2>
        <div className="seg">
          {(["unbuilt","bench","built","wanted"] as Status[]).map((s) => (
            <button key={s} aria-pressed={k.status === s} onClick={() => save({ ...k, status: s })}>
              {s === "bench" ? "Bench" : LABEL[s]}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>Build log</h2>
        <div className="row2">
          <input value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="What happened today" />
          <button className="btn" style={{ flex: "0 0 26%", marginTop: 0 }} onClick={addEntry}>Add</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {k.log.length === 0
            ? <div className="note" style={{ textAlign: "left", padding: "10px 0 0" }}>Nothing logged yet.</div>
            : k.log.map((l, i) => (
                <div className="log" key={i}>
                  <time>{new Date(l.date).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</time>
                  <div>{l.text}</div>
                </div>
              ))}
        </div>
      </section>

      {k.notes && (
        <section><h2>Notes</h2><div style={{ fontSize: 15.5, lineHeight: 1.55 }}>{k.notes}</div></section>
      )}

      <section>
        <h2>Look this kit up</h2>
        {links(k).map((l) => (
          <a className="link" key={l.label} href={l.href} target="_blank" rel="noreferrer">
            {l.label} <em>{l.hint}</em>
          </a>
        ))}
        <div className="note">Links open elsewhere. Nothing is copied in.</div>
      </section>

      <section>
        <h2>Manage</h2>
        {k.barcode && <div className="rowk"><span>Barcode</span><b>{k.barcode}</b></div>}
        <div className="rowk"><span>Added</span><b>{new Date(k.createdAt).toLocaleDateString()}</b></div>
        <button className="btn ghost" onClick={() => router.push(`/kit/${k.id}/edit`)}>
          Edit the details
        </button>
        <button className="btn danger" onClick={async () => {
          if (confirm(`Remove ${k.name} from your stash? This cannot be undone.`)) {
            await deleteKit(k.id); router.push("/");
          }
        }}>Remove this kit</button>
      </section>
    </main>
  );
}
