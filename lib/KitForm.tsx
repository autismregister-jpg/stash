"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { putKit, type Kit, type Status } from "./store";
import { useArt, artStyle } from "./ui";

const STATUSES: { v: Status; label: string }[] = [
  { v: "unbuilt", label: "Unbuilt" },
  { v: "bench", label: "Bench" },
  { v: "built", label: "Finished" },
  { v: "wanted", label: "Wanted" },
];

export default function KitForm({ initial, heading, submitLabel = "Add to stash", onDone }:
  { initial: Kit; heading?: string; submitLabel?: string; onDone?: (k: Kit) => void }) {
  const router = useRouter();
  const [k, setK] = useState<Kit>(initial);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const url = useArt(k.photo);

  const set = (field: keyof Kit) => (e: any) => setK({ ...k, [field]: e.target.value });

  async function save() {
    if (!k.name.trim()) { alert("Give the kit a name first."); return; }
    setSaving(true);

    let photo = k.photo;
    // Keep a permanent local copy of the listing art, so the picture still
    // works offline and does not vanish when the listing does.
    if (!photo && k.imageUrl) {
      try {
        const r = await fetch(`/api/image?url=${encodeURIComponent(k.imageUrl)}`);
        if (r.ok) photo = await r.blob();
      } catch { /* art is optional, never block the save */ }
    }

    const saved = await putKit({ ...k, name: k.name.trim(), photo });
    if (onDone) { onDone(saved); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {heading && <h2 style={{ marginTop: 20 }}>{heading}</h2>}

      <div
        className="hero"
        style={artStyle(k, url)}
        onClick={() => photoRef.current?.click()}
        role="button"
      >
        {!url && (
          <div style={{
            position: "absolute", inset: 0, display: "grid", placeItems: "center",
            color: "#fff", fontFamily: "var(--mono)", fontSize: 13, textShadow: "0 1px 3px rgba(0,0,0,.6)",
          }}>
            Tap to add a photo of the box
          </div>
        )}
      </div>
      <input
        ref={photoRef} type="file" accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setK({ ...k, photo: f });
        }}
      />

      <label htmlFor="name">Kit name</label>
      <input id="name" value={k.name} onChange={set("name")} placeholder="RX-78-2 Gundam" />

      <label htmlFor="mfr">Manufacturer</label>
      <input id="mfr" value={k.manufacturer} onChange={set("manufacturer")} placeholder="Bandai" list="makers" />
      <datalist id="makers">
        {["Bandai","Tamiya","Hasegawa","Kotobukiya","Trumpeter","Meng","Takom","Revell","Airfix","Academy","Dragon","Italeri","Fujimi","Aoshima","Daban","Moshow","Reload","Motor Nuclear","Super Nova"].map(m => <option key={m} value={m} />)}
      </datalist>

      <div className="row2">
        <div>
          <label htmlFor="line">Grade or series</label>
          <input id="line" value={k.line} onChange={set("line")} placeholder="HG" list="lines" />
          <datalist id="lines">
            {["HG","RG","MG","PG","EG","SD","FM","MGEX","RE/100","Military","Aircraft","Car","Ship"].map(l => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div>
          <label htmlFor="scale">Scale</label>
          <input id="scale" value={k.scale} onChange={set("scale")} placeholder="1/144" />
        </div>
      </div>

      <div className="row2">
        <div>
          <label htmlFor="num">Kit number</label>
          <input id="num" value={k.kitNumber} onChange={set("kitNumber")} />
        </div>
        <div>
          <label htmlFor="qty">Quantity</label>
          <input id="qty" type="number" min={1} value={k.qty}
                 onChange={(e) => setK({ ...k, qty: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
      </div>

      <label htmlFor="variant">Which release is it</label>
      <select id="variant" value={k.variant} onChange={set("variant")}>
        <option value="jp">Japanese release</option>
        <option value="asia">Asia release</option>
        <option value="third">Third party</option>
        <option value="unknown">Not sure</option>
      </select>

      <label htmlFor="price">What you paid (optional)</label>
      <input id="price" type="number" inputMode="decimal" value={k.price ?? ""}
             onChange={(e) => setK({ ...k, price: e.target.value === "" ? null : Number(e.target.value) })} />

      <label>Status</label>
      <div className="seg">
        {STATUSES.map((s) => (
          <button key={s.v} type="button" aria-pressed={k.status === s.v}
                  onClick={() => setK({ ...k, status: s.v })}>
            {s.label}
          </button>
        ))}
      </div>

      <label htmlFor="tags">Tags, separated by spaces</label>
      <input id="tags" value={k.tags.join(" ")}
             onChange={(e) => setK({ ...k, tags: e.target.value.split(/\s+/).filter(Boolean) })}
             placeholder="sealed p-bandai gift" />

      <label htmlFor="notes">Notes</label>
      <textarea id="notes" value={k.notes} onChange={set("notes")} />

      <button className="btn" onClick={save} disabled={saving}>
        {saving ? "Saving" : submitLabel}
      </button>
      <button className="btn ghost" onClick={() => router.back()}>Cancel</button>
    </>
  );
}
