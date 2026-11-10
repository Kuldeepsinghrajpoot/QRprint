"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert } from "@/components/lexical/ui";

/** Shown to the shop owner on every dashboard page until phone, email and address are saved. */
export default function ContactBanner() {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/shop", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d && d.isOwner && !d.contactComplete) setMissing(true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!missing) return null;
  return (
    <Alert tone="warning" icon="⚠️" className="mb-4">
      <strong>Add your business details.</strong> Your phone, email and address are required for your Terms, Privacy, Refund and Pricing pages.{" "}
      <Link href="/admin/settings#business" className="font-semibold underline">Add them in Settings</Link>
    </Alert>
  );
}
