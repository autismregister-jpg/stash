"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { blankKit, cacheGet, cachePut, findByBarcode, type Kit } from "@/lib/store";
import { tintFor } from "@/lib/parse";
import KitForm from "@/lib/KitForm";

type Phase = "camera" | "looking" | "choose" | "form";

export default function Scan() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<null | (() => void)>(null);

  const [phase, setPhase] = useState<Phase>("camera");
  const [code, setCode] = useState("");
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<any>(null);
  const [owned, setOwned] = useState<Kit[]>([]);
  const [draft, setDraft] = useState<Kit | null>(null);
  const [camError, setCamError] = useState<string | null>(null);

  useEffect(() => {
    if (phase !== "camera") return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (res, _err, controls) => {
        stopRef.current = () => controls.stop();
        if (res && !cancelled) {
          cancelled = true;
          controls.stop();
          handle(res.getText());
        }
      })
      .catch(() => setCamError("No camera available here. Type the digits under the barcode instead."));

    return () => { cancelled = true; stopRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function handle(raw: string, force = false) {
    const c = raw.trim();
    setCode(c);
    setPhase("looking");
    stopRef.current?.();

    setOwned(await findByBarcode(c));

    // Already fetched on this device: never ask the internet twice. The cache
    // is stamped with the parser version, so a parser fix invalidates it.
    if (!force) {
      const cached = await cacheGet(c);
      if (cached) { setResult(cached); setPhase("choose"); return; }
    }

    try {
      const r = await fetch(`/api/lookup?code=${encodeURIComponent(c)}`);
      const data = await r.json();
      if (data.valid && data.candidates?.length) await cachePut(c, data);
      setResult(data);
    } catch {
      setResult({ code: c, valid: true, origin: null, candidates: [],
        message: "Could not reach the lookup service. Add the details by hand." });
    }
    setPhase("choose");
  }

  function useCandidate(cand: any | null) {
    const cloneHint = result?.origin?.cloneHint;
    const k = blankKit({
      name: cand?.name || "",
      manufacturer: cand?.manufacturer || "",
      line: cand?.line || "",
      scale: cand?.scale || "",
      kitNumber: cand?.kitNumber || "",
      price: cand?.price ?? null,
      imageUrl: cand?.image || "",
      notes: cand?.series ? `Series: ${cand.series}` : "",
      barcode: code,
      variant: cloneHint ? "third" : "unknown",
      source: cand?.source || "manual",
      sourceTitle: cand?.title || "",
      tint: tintFor(cand?.name || code),
    });
    setDraft(k);
    setPhase("form");
  }

  return (
    <main className="wrap">
      <button className="back" onClick={() => router.push("/")}>← Stash</button>

      {phase === "camera" && (
        <>
          <div className="reticle">
            <video ref={videoRef} playsInline muted />
            <div className="corner c1" /><div className="corner c2" />
            <div className="corner c3" /><div className="corner c4" />
            <div className="laser" />
          </div>
          <div className="note" style={{ paddingTop: 12 }}>
            Point at the barcode on the side or base of the box.
          </div>

          {camError && <div className="card warn">{camError}</div>}

          <label htmlFor="man">Or type the digits</label>
          <div className="row2">
            <input id="man" inputMode="numeric" value={manual}
                   onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))}
                   placeholder="4573102657770" />
            <button className="btn" style={{ flex: "0 0 34%", marginTop: 0 }}
                    onClick={() => manual && handle(manual)}>Look up</button>
          </div>
        </>
      )}

      {phase === "looking" && (
        <div className="card"><h3>Looking this up</h3>
          <div className="rowk"><span>Barcode</span><b>{code}</b></div>
        </div>
      )}

      {phase === "choose" && result && (
        <>
          <div className={"card" + (result.origin?.cloneHint || !result.valid ? " warn" : "")}>
            <div className="rowk"><span>Barcode</span><b>{code}</b></div>
            {result.origin?.region && (
              <div className="rowk"><span>Registered in</span><b>{result.origin.region}</b></div>
            )}
            {result.message && (
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.5,
                            color: result.origin?.cloneHint || !result.valid ? "var(--alertText)" : "var(--ink)" }}>
                {result.message}
              </div>
            )}
          </div>

          {result.sources && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontFamily: "var(--mono)", fontSize: 12.5,
                                color: "var(--soft)", padding: "8px 0" }}>
                Where this came from
              </summary>
              <div className="card">
                {Object.entries(result.sources).map(([name, r]: any) => (
                  <div key={name} style={{ padding: "5px 0" }}>
                    <div className="rowk">
                      <span>{name}</span>
                      <b>{!r.configured ? "not set up" : `${r.count} found`}</b>
                    </div>
                    {r.note && (
                      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5,
                                    color: "var(--faint)", lineHeight: 1.45 }}>
                        {r.note}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {owned.length > 0 && (
            <div className="card">
              <h3>You already own this</h3>
              <div style={{ fontSize: 14, color: "var(--soft)" }}>
                {owned.map((o) => o.name).join(", ")}. Adding it again is fine if you have duplicates.
              </div>
            </div>
          )}

          {result.candidates?.length > 0 && <h2 style={{ marginTop: 22 }}>Which one is it</h2>}
          {result.candidates?.map((c: any, i: number) => (
            <button key={i} className="card" style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                    onClick={() => useCandidate(c)}>
              <h3>{c.name || c.title}</h3>
              <div className="rowk">
                <span>{[c.manufacturer, c.line, c.scale].filter(Boolean).join(" · ") || "No details parsed"}</span>
                <b>{c.kitNumber || ""}</b>
              </div>
              <div className="rowk"><span>Found via</span><b>{c.source}</b></div>
            </button>
          ))}

          <button className="btn ghost" onClick={() => useCandidate(null)}>
            {result.candidates?.length ? "None of these, enter by hand" : "Enter the details by hand"}
          </button>
          <button className="btn ghost" onClick={() => handle(code, true)}>
            Look it up again
          </button>
          <button className="btn ghost" onClick={() => { setResult(null); setPhase("camera"); }}>
            Scan a different box
          </button>
        </>
      )}

      {phase === "form" && draft && <KitForm initial={draft} heading="Check this against the box" />}
    </main>
  );
}
