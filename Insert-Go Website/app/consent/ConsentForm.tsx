"use client";

import { useState } from "react";
import Link from "next/link";
import { NOTICE_VERSION, PURPOSES } from "@/lib/consent";
import { submitConsent } from "./actions";

/**
 * The consent gate's checkboxes (R-09, R-14).
 *
 * Three rules from DPDP §6(1), all of them structural rather than cosmetic:
 *
 *  1. **Nothing starts ticked.** A pre-ticked box is not "clear affirmative
 *     action". `defaultChecked` is deliberately absent from every input here.
 *  2. **Required and optional are visually separated**, because a list where
 *     everything looks alike reads as one bundled agreement — and a bundled
 *     "I agree to the Terms and Privacy Policy" is precisely the consent §6(1)
 *     invalidates for not being specific.
 *  3. **Declining an optional purpose still completes signup.** The submit
 *     button gates on required purposes only.
 */
export function ConsentForm({ incomplete }: { incomplete?: boolean }) {
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const required = PURPOSES.filter((p) => p.required);
  const optional = PURPOSES.filter((p) => !p.required);
  const allRequired = required.every((p) => ticked[p.id]);

  const row = (p: (typeof PURPOSES)[number]) => (
    <li key={p.id} className="glass-chip rounded-2xl px-4 py-3.5">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          name={`purpose:${p.id}`}
          checked={ticked[p.id] ?? false}
          onChange={(e) =>
            setTicked((t) => ({ ...t, [p.id]: e.target.checked }))
          }
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand,#5b5bd6)]"
        />
        <span className="min-w-0">
          <span className="block text-[15px] text-ink">{p.label}</span>
          <span className="mt-1 block text-[13px] leading-relaxed text-muted">
            {p.description}
          </span>
        </span>
      </label>
    </li>
  );

  return (
    <form action={submitConsent} onSubmit={() => setBusy(true)}>
      {incomplete && (
        <p
          role="alert"
          className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          Please accept the items required to run your account.
        </p>
      )}

      <h2 className="m-0 text-sm font-medium text-muted">
        Required to provide the service
      </h2>
      <ul className="mt-2 mb-0 flex list-none flex-col gap-2 p-0">
        {required.map(row)}
      </ul>

      <h2 className="mt-6 mb-0 text-sm font-medium text-muted">
        Optional — declining changes nothing about how InsertGo works
      </h2>
      <ul className="mt-2 mb-0 flex list-none flex-col gap-2 p-0">
        {optional.map(row)}
      </ul>

      <button
        type="submit"
        disabled={!allRequired || busy}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-3xl bg-brand text-[15px] font-medium text-on-accent transition-[transform,filter] duration-200 hover:-translate-y-px hover:brightness-105 disabled:translate-y-0 disabled:opacity-50 disabled:brightness-100"
      >
        {busy ? "Saving…" : "Continue"}
      </button>

      <p className="mt-4 mb-0 text-center text-xs text-muted">
        You can change any of these later at{" "}
        <Link href="/account/privacy" className="underline">
          Account → Privacy
        </Link>
        , with the same number of clicks it took to set them. Notice version{" "}
        {NOTICE_VERSION} — read the{" "}
        <Link href="/privacy" className="underline">
          full policy
        </Link>
        .
      </p>
    </form>
  );
}
