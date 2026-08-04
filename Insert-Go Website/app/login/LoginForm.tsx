"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { authClient } from "@/lib/auth-client";
import { safeNext } from "./safeNext";

type Lane = "menu" | "otp-email" | "otp-code" | "sso";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Post-login destination: same-origin paths only (open redirects), query
  // re-encoded so Better Auth accepts it as a callbackURL — see safeNext.ts.
  const next = safeNext(searchParams.get("next"));
  const [lane, setLane] = useState<Lane>("menu");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Codes get filtered, delayed, or typo'd into the wrong inbox. Without a
  // resend the only way out of this lane was to abandon it.
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fail = (msg: string) => {
    setError(msg);
    setBusy(false);
  };

  async function continueWithGoogle() {
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
    });
    if (error) fail(error.message ?? "Google sign-in failed. Try again.");
    // on success the browser navigates away — no state reset needed
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return fail("Enter a valid email address.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (error)
      return fail(error.message ?? "Couldn't send the code. Try again.");
    setBusy(false);
    setCooldown(30);
    setLane("otp-code");
  }

  /** Re-issue the code for the address already entered. Rate-limited client
   *  side by `cooldown`; the server enforces its own limit regardless. */
  async function resendOtp() {
    setBusy(true);
    setError(null);
    setResent(false);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    if (error)
      return fail(error.message ?? "Couldn't resend the code. Try again.");
    setBusy(false);
    setResent(true);
    setCooldown(30);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return fail("The code is 6 digits.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp });
    if (error)
      return fail(
        error.message ?? "That code didn't work. Check it and try again.",
      );
    router.push(next);
    router.refresh();
  }

  async function continueWithSso(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email)) return fail("Enter your work email address.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.sso({
      email,
      callbackURL: next,
    });
    if (error)
      return fail(
        error.message ??
          "No SSO provider is registered for this email domain yet. Ask your admin, or sign in with Google / email code.",
      );
  }

  const inputCls =
    "glass-chip h-12 w-full rounded-2xl px-4 text-[15px] text-ink placeholder:text-muted focus:outline-none focus:ring-4 focus:ring-focus-ring";
  const primaryBtn =
    "inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-[15px] font-medium text-on-accent shadow-cta-sm transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-px hover:shadow-cta-hover disabled:cursor-not-allowed disabled:opacity-60";
  const laneBtn =
    "glass-chip inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl px-6 text-[15px] font-medium text-ink transition-colors duration-200 hover:bg-muted/10 disabled:cursor-not-allowed disabled:opacity-60";
  const backBtn =
    "mt-1 text-center text-sm font-medium text-brand underline-offset-2 hover:underline";

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={lane}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: [0.2, 0.7, 0.2, 1] }}
          className="flex flex-col gap-3"
        >
          {lane === "menu" && (
            <>
              <form onSubmit={sendOtp} className="flex flex-col gap-3">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="name@work-email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  required
                />
                <button type="submit" disabled={busy} className={primaryBtn}>
                  {busy ? "Sending code…" : "Continue with email"}
                </button>
              </form>

              <div className="my-1 flex items-center gap-3">
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  or
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>

              <button
                type="button"
                onClick={continueWithGoogle}
                disabled={busy}
                className={laneBtn}
              >
                <GoogleMark />
                Continue with Google
              </button>

              <button
                type="button"
                className={backBtn}
                onClick={() => {
                  setError(null);
                  setLane("sso");
                }}
                disabled={busy}
              >
                Continue with company SSO
              </button>
            </>
          )}

          {lane === "otp-code" && (
            <form onSubmit={verifyOtp} className="flex flex-col gap-3">
              <p className="text-center text-sm text-muted">
                We sent a 6-digit code to{" "}
                <strong className="break-all text-ink">{email}</strong>. It
                expires in 5
                minutes.
              </p>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} text-center font-mono text-xl tracking-[0.4em]`}
                autoFocus
                required
              />
              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                className={primaryBtn}
              >
                {busy ? "Verifying…" : "Sign in"}
              </button>

              <div
                className="text-center text-sm text-muted"
                role="status"
                aria-live="polite"
              >
                {resent && cooldown > 0 ? (
                  <span className="text-ink-soft">
                    New code sent — check your inbox.
                  </span>
                ) : cooldown > 0 ? (
                  <span>Didn&apos;t get it? Resend in {cooldown}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void resendOtp()}
                    disabled={busy}
                    className="font-medium text-brand underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    Resend the code
                  </button>
                )}
              </div>

              <button
                type="button"
                className={backBtn}
                onClick={() => {
                  setOtp("");
                  setError(null);
                  setResent(false);
                  setLane("menu");
                }}
              >
                Use a different email or method
              </button>
            </form>
          )}

          {lane === "sso" && (
            <form onSubmit={continueWithSso} className="flex flex-col gap-3">
              <p className="text-center text-sm text-muted">
                Enter your work email — we&apos;ll route you to your
                organization&apos;s identity provider.
              </p>
              <input
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
                autoFocus
                required
              />
              <button type="submit" disabled={busy} className={primaryBtn}>
                {busy ? "Looking up your org…" : "Continue with SSO"}
              </button>
              <button
                type="button"
                className={backBtn}
                onClick={() => {
                  setError(null);
                  setLane("menu");
                }}
              >
                Back to all sign-in options
              </button>
            </form>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-center text-[13px] text-danger"
            >
              {error}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
