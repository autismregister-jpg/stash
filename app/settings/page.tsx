"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { exportJson, exportCsv, importJson } from "@/lib/store";
import { download, ThemeToggle } from "@/lib/ui";

export default function Settings() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <main className="wrap">
      <button className="back" onClick={() => router.push("/")}>← Stash</button>
      <h2>Back up and restore</h2>

      <div className="card">
        Everything lives on this phone only. If you clear your browser data or
        lose the device, the stash goes with it. Export every so often.
      </div>

      <button className="btn" onClick={async () =>
        download(`stash-backup-${stamp}.json`, await exportJson(), "application/json")}>
        Export a full backup
      </button>
      <div className="note" style={{ textAlign: "left" }}>
        JSON, including your photos. This is the one that can be restored.
      </div>

      <button className="btn ghost" onClick={async () =>
        download(`stash-${stamp}.csv`, await exportCsv(), "text/csv")}>
        Export a spreadsheet
      </button>
      <div className="note" style={{ textAlign: "left" }}>
        CSV for Excel or Sheets. Readable, but photos are not included.
      </div>

      <section>
        <h2>Restore</h2>
        <input ref={fileRef} type="file" accept="application/json,.json"
               style={{ display: "none" }}
               onChange={async (e) => {
                 const f = e.target.files?.[0];
                 if (!f) return;
                 try {
                   const n = await importJson(await f.text());
                   setMsg(`Restored ${n} kits.`);
                 } catch (err: any) {
                   setMsg(err?.message || "That file could not be read.");
                 }
               }} />
        <button className="btn ghost" onClick={() => fileRef.current?.click()}>
          Restore from a backup file
        </button>
        {msg && <div className="card">{msg}</div>}
        <div className="note" style={{ textAlign: "left" }}>
          Kits with the same id are overwritten. Everything else is added.
        </div>
      </section>

      <section>
        <h2>Appearance</h2>
        <ThemeToggle />
      </section>
    </main>
  );
}
