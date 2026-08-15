"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getKit, type Kit } from "@/lib/store";
import KitForm from "@/lib/KitForm";

export default function EditKit() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [k, setK] = useState<Kit | null>(null);

  useEffect(() => { getKit(id).then((r) => setK(r ?? null)); }, [id]);

  return (
    <main className="wrap">
      <button className="back" onClick={() => router.push(`/kit/${id}`)}>← Back</button>
      {k ? (
        <KitForm
          initial={k}
          heading="Edit this kit"
          submitLabel="Save changes"
          onDone={() => { router.push(`/kit/${id}`); router.refresh(); }}
        />
      ) : (
        <div className="note" style={{ paddingTop: 60 }}>Loading</div>
      )}
    </main>
  );
}
