"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { LinearTickCircle } from "@/components/icons/LinearTickCircle";

/**
 * Approve step of the desktop PKCE flow. The code is minted server-side on
 * click, then the browser navigates to the `insertgo://` callback — a user
 * gesture, which is what browsers require before launching an external
 * protocol handler. The link is also rendered so a blocked hand-off is one
 * click away instead of a dead end.
 */
export function DesktopApprove({
  challenge,
  state,
}: {
  challenge: string;
  state: string;
}) {
  const [status, setStatus] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  async function approve() {
    setStatus("busy");
    setError(null);
    try {
      const res = await fetch("/api/desktop/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: "insertgo-desktop",
          code_challenge: challenge,
          code_challenge_method: "S256",
          state,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.redirect) {
        throw new Error(
          res.status === 401
            ? "Your session expired. Reload this page and sign in again."
            : "Couldn't complete the request. Start again from the desktop app.",
        );
      }
      setLink(data.redirect);
      setStatus("done");
      window.location.href = data.redirect;
    } catch (e) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center text-center">
        {/* Was a bare "✓" glyph at text-4xl — the one confirmation in the whole
            auth flow, rendered in a style used nowhere else on the site. */}
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent/50 text-brand"
        >
          <LinearTickCircle size={26} />
        </motion.span>
        <h2 className="mt-3 font-serif text-xl font-semibold text-ink">
          Handing off to the app
        </h2>
        <p className="mt-2 text-sm text-muted">
          InsertGo should be signed in now — you can close this tab. Nothing
          happened?{" "}
          <a href={link!} className="font-medium text-brand hover:underline">
            Open InsertGo
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        disabled={status === "busy"}
        onClick={() => void approve()}
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-terracotta text-[15px] font-medium text-on-accent shadow-cta-sm transition-[transform,box-shadow,opacity] hover:-translate-y-px hover:shadow-cta-hover disabled:opacity-60"
      >
        {status === "busy" ? "Working…" : "Approve and open InsertGo"}
      </button>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-center text-[13px] text-danger"
        >
          {error}
        </p>
      )}
      <p className="text-center text-[13px] leading-relaxed text-muted">
        Only approve if you just started sign-in from the InsertGo desktop app
        on your own computer.
      </p>
    </div>
  );
}
