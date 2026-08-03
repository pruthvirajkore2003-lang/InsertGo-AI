"use client";

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LinearTickCircle } from "@/components/icons/LinearTickCircle";
import { LinearSend2 } from "@/components/icons/LinearSend2";

/**
 * Contact form. Every state a submission can end in is reachable and named:
 * idle → validating (inline, per field) → sending (button busy, inputs locked)
 * → sent, or → failed with the server's reason and the draft still intact.
 *
 * Motion carries meaning only: the lane swap tells you the panel changed, the
 * tick springs in to confirm arrival, field errors slide down so the eye is
 * pulled to the field that needs it. Everything is transform/opacity, and the
 * global prefers-reduced-motion block in globals.css collapses all of it.
 */

const topics = ["General", "Bug report", "Feature idea", "Teams / Sales"];
const MESSAGE_MAX = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputCls =
  "glass-chip rounded-lg px-4 py-[13px] text-[15px] text-ink outline-none transition-[border-color,background-color] duration-200 focus:border-brand disabled:opacity-60";
const errorCls = "border-danger/60 focus:border-danger";

type Fields = { name: string; email: string; message: string };
type Errors = Partial<Record<keyof Fields, string>>;

/** Same rules the route re-checks server-side — this copy only buys the user
 *  an answer before the round-trip. */
function validate(f: Fields): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = "Tell us your name.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (f.message.trim().length < 10)
    e.message = "Add a little more detail — at least 10 characters.";
  else if (f.message.length > MESSAGE_MAX)
    e.message = `Keep it under ${MESSAGE_MAX} characters.`;
  return e;
}

function FieldError({ id, children }: { id: string; children?: string }) {
  return (
    <AnimatePresence initial={false}>
      {children && (
        <motion.span
          id={id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: [0.2, 0.7, 0.2, 1] }}
          className="block overflow-hidden text-[13px] text-danger"
        >
          {children}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export function ContactForm() {
  const uid = useId();
  const [fields, setFields] = useState<Fields>({
    name: "",
    email: "",
    message: "",
  });
  const [topic, setTopic] = useState(topics[0]);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  // Filled only by bots — mirrored by the `company` check in the API route.
  const honeypot = useRef<HTMLInputElement>(null);

  const patch = (p: Partial<Fields>) => {
    setFields((f) => ({ ...f, ...p }));
    // Clear the error for a field the moment it is edited: keeping a stale
    // "invalid" label under a field the user is fixing reads as broken.
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(p) as (keyof Fields)[]) delete next[k];
      return next;
    });
    if (failure) setFailure(null);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(fields);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Send focus to the first offending field so keyboard users are not
      // left guessing which one the error belongs to.
      const first = (["name", "email", "message"] as const).find(
        (k) => found[k],
      );
      if (first) document.getElementById(`${uid}-${first}`)?.focus();
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          topic,
          company: honeypot.current?.value ?? "",
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        setFailure(
          data?.error ?? "Could not send your message. Try again in a moment.",
        );
        return;
      }
      setSent(true);
    } catch {
      setFailure("No connection. Check your network and try again.");
    } finally {
      setBusy(false);
    }
  }

  const remaining = MESSAGE_MAX - fields.message.length;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <motion.div
          key="sent"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
          className="flex flex-col items-center gap-3.5 py-10 text-center"
        >
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{
              type: "spring",
              stiffness: 320,
              damping: 18,
              delay: 0.1,
            }}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent/50 text-brand"
          >
            <LinearTickCircle size={26} />
          </motion.span>
          <h2 className="m-0 font-serif text-2xl font-semibold text-ink">
            Message sent
          </h2>
          <p className="m-0 max-w-[340px] text-[15px] leading-relaxed text-muted">
            Thanks — we&apos;ll reply to{" "}
            <strong className="font-medium text-ink-soft">
              {fields.email}
            </strong>{" "}
            within one business day.
          </p>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setFields({ name: fields.name, email: fields.email, message: "" });
            }}
            className="glass-chip mt-2 cursor-pointer rounded-full px-5 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-200 hover:bg-muted/10 active:scale-[0.97] active:duration-75"
          >
            Send another
          </button>
        </motion.div>
      ) : (
        <motion.form
          key="form"
          noValidate
          onSubmit={submit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-[18px]"
        >
          {/* Honeypot — off-screen rather than display:none, which some bots
              skip, and hidden from assistive tech and tab order. */}
          <input
            ref={honeypot}
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-px w-px opacity-0"
          />

          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[18px]">
            <label className="flex flex-col gap-2" htmlFor={`${uid}-name`}>
              <span className="text-[13px] font-medium text-ink-soft">Name</span>
              <input
                id={`${uid}-name`}
                name="name"
                autoComplete="name"
                disabled={busy}
                value={fields.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Ada Lovelace"
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${uid}-name-err` : undefined}
                className={`${inputCls} ${errors.name ? errorCls : ""}`}
              />
              <FieldError id={`${uid}-name-err`}>{errors.name}</FieldError>
            </label>

            <label className="flex flex-col gap-2" htmlFor={`${uid}-email`}>
              <span className="text-[13px] font-medium text-ink-soft">
                Email
              </span>
              <input
                id={`${uid}-email`}
                name="email"
                type="email"
                autoComplete="email"
                disabled={busy}
                value={fields.email}
                onChange={(e) => patch({ email: e.target.value })}
                placeholder="ada@example.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? `${uid}-email-err` : undefined}
                className={`${inputCls} ${errors.email ? errorCls : ""}`}
              />
              <FieldError id={`${uid}-email-err`}>{errors.email}</FieldError>
            </label>
          </div>

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 p-0 text-[13px] font-medium text-ink-soft">
              Topic
            </legend>
            <div className="flex flex-wrap gap-2">
              {topics.map((t) => {
                const active = topic === t;
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={busy}
                    aria-pressed={active}
                    onClick={() => setTopic(t)}
                    className={`cursor-pointer rounded-full border px-4 py-2 text-[13px] font-medium transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.97] active:duration-75 disabled:opacity-60 ${
                      active
                        ? "border-transparent bg-brand text-on-accent"
                        : "glass-chip text-ink-soft hover:border-brand/40 hover:text-ink"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="flex flex-col gap-2" htmlFor={`${uid}-message`}>
            <span className="flex items-baseline justify-between gap-3 text-[13px] font-medium text-ink-soft">
              Message
              {/* Only appears near the ceiling — a permanent counter reads as a
                  quota on a form nobody is close to filling. */}
              {remaining < 300 && (
                <span
                  className={remaining < 0 ? "text-danger" : "text-muted"}
                  aria-live="polite"
                >
                  {remaining} left
                </span>
              )}
            </span>
            <textarea
              id={`${uid}-message`}
              name="message"
              rows={5}
              disabled={busy}
              value={fields.message}
              onChange={(e) => patch({ message: e.target.value })}
              placeholder="Tell us what's on your mind…"
              aria-invalid={Boolean(errors.message)}
              aria-describedby={
                errors.message ? `${uid}-message-err` : undefined
              }
              className={`${inputCls} min-h-[120px] resize-y ${
                errors.message ? errorCls : ""
              }`}
            />
            <FieldError id={`${uid}-message-err`}>{errors.message}</FieldError>
          </label>

          {/* One live region for submit-level outcomes, so a screen reader
              hears the failure without moving focus off the button. */}
          <div role="status" aria-live="polite">
            <AnimatePresence initial={false}>
              {failure && (
                <motion.p
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
                  className="m-0 overflow-hidden rounded-xl border border-danger/30 bg-danger/5 px-4 py-2.5 text-[13px] text-danger"
                >
                  {failure}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-3xl border-none bg-terracotta text-[15px] font-medium text-on-accent shadow-cta transition-all duration-200 ease-standard hover:-translate-y-px hover:shadow-cta-hover active:translate-y-0 active:scale-[0.98] active:duration-75 disabled:cursor-wait disabled:opacity-70 disabled:hover:translate-y-0"
          >
            {busy ? (
              <>
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                />
                Sending…
              </>
            ) : (
              <>
                <LinearSend2 size={17} />
                Send message
              </>
            )}
          </button>

          <p className="m-0 text-center text-[12px] text-muted">
            We only use your email to reply. No newsletter, no sharing.
          </p>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
