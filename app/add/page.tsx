"use client";

import { useRouter } from "next/navigation";
import { blankKit } from "@/lib/store";
import { tintFor } from "@/lib/parse";
import KitForm from "@/lib/KitForm";

export default function Add() {
  const router = useRouter();
  return (
    <main className="wrap">
      <button className="back" onClick={() => router.push("/")}>← Stash</button>
      <KitForm initial={blankKit({ tint: tintFor(String(Math.random())) })} heading="Add a kit by hand" />
    </main>
  );
}
