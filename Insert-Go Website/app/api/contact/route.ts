/**
 * POST /api/contact — the contact form's delivery lane.
 *
 * Two mails leave here per submission: the enquiry to the support inbox, and an
 * acknowledgement receipt to the visitor. The receipt is the half that changes
 * the threat model — the route now sends mail to an address the CALLER chose,
 * which is an open relay's shape unless every one of the guards below holds.
 *
 * Trust boundary (this route is UNAUTHENTICATED):
 *  - body is read through readBodyCapped, so an oversize/chunked payload is
 *    never fully buffered,
 *  - every field is length- and shape-checked before it reaches a mail body,
 *  - `topic` must be one of the four the UI offers — free text there would let
 *    a caller write the subject line,
 *  - `\r` / `\n` are stripped from every single-line field, so nothing
 *    submitted here can split a header and append its own (Bcc:, To:),
 *  - dynamic values in the HTML parts are escaped; the message body is also
 *    sent as `text`, so a client that prefers plain text sees no markup either,
 *  - the visitor's address is never the `from` — only the `replyTo` — so our
 *    domain's SPF/DKIM/DMARC alignment holds,
 *  - the receipt carries RFC 3834's Auto-Submitted / X-Auto-Response-Suppress
 *    headers and is withheld from machine addresses, so it cannot start a loop
 *    with a vacation responder or a bounce daemon,
 *  - a honeypot plus TWO per-IP windows (shared Redis, and a per-instance floor
 *    for when Redis is unconfigured) bound both spam and mail-bombing a third
 *    party through the receipt.
 */
import { BodyTooLargeError, readBodyCapped } from "@/lib/httpBody";
import { safeError } from "@/lib/safeLog";
import { clientIp } from "@/lib/auditLog";
import { withinIpRateLimit } from "@/lib/ipRateLimit";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const LIMITS = { name: 120, email: 254, message: 4000 } as const;
const TOPICS = ["General", "Bug report", "Feature idea", "Teams / Sales"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WINDOW_SECS = 60 * 60;
const MAX_PER_WINDOW = 5;
// Per-instance floor behind the shared limiter. lib/ipRateLimit fails OPEN by
// contract (an Upstash blip must not take the form down), and with Upstash
// simply unconfigured that means NO bound at all — on a route that mails an
// address the caller supplied, "no bound" is a mail bomb aimed at whoever the
// caller names. N serverless instances still allow N x the cap; that is a far
// smaller hole than unbounded, and costs nothing.
const hits = new Map<string, { count: number; resetAt: number }>();

function overLocalWindow(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_SECS * 1000 });
    // Opportunistic sweep — the map only grows while requests arrive.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

/** Single-line fields only. A `\r` or `\n` reaching `subject` or `replyTo`
 *  terminates that header and lets the submitter add their own — SMTP header
 *  injection. Collapsed to a space rather than dropped, so a pasted "Ada\nLovelace"
 *  stays two words instead of becoming one. */
const stripNewlines = (v: string) => v.replace(/[\r\n]+/g, " ").trim();

/** Escape the five characters that can leave text content or an attribute in
 *  an HTML mail part. `&` first, or it re-escapes the entities below it. */
function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Addresses that belong to machines, not people. Auto-replying to one is how
 *  a mail loop starts (RFC 3834 §2): the receipt hits a bounce daemon, its
 *  bounce hits the form, and so on. The RFC headers on the receipt stop a
 *  compliant responder; this stops the ones that ignore them. */
const SYSTEM_ADDRESS = /^(noreply|no-reply|mailer-daemon|postmaster|bounce)@/i;
const isSuppressedAutoReplyEmail = (email: string) => SYSTEM_ADDRESS.test(email);

function bad(error: string, status = 400) {
  return Response.json({ error }, { status });
}

/** Resend reports a refused send in `error` rather than throwing, but a
 *  transport fault still rejects the promise. Both mean "not delivered", and
 *  reading only one of them is how a route reports success on nothing. */
function sendFailure(
  r: PromiseSettledResult<{ error?: unknown } | null>,
): unknown {
  return r.status === "rejected" ? r.reason : (r.value?.error ?? null);
}

export async function POST(req: Request) {
  let raw: string;
  try {
    raw = await readBodyCapped(req, MAX_BODY_BYTES);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return bad("Message is too long.", 413);
    return bad("Could not read the request.");
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return bad("Malformed request.");
  }

  // Honeypot: a field hidden from humans. Answer 200 so a bot sees success and
  // does not retry with the field left blank. Checked before the limiter, so a
  // bot behind a shared NAT address cannot spend a real visitor's budget.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return Response.json({ ok: true });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  // Sanitise BEFORE validating, so what the checks below accept is exactly what
  // reaches the mail — no second, unchecked copy of a field stays in scope.
  const name = stripNewlines(str(body.name));
  const email = stripNewlines(str(body.email));
  const topic = stripNewlines(str(body.topic));
  // Multi-line by design: it only ever goes in a body, never in a header.
  const message = str(body.message);

  if (!name) return bad("Tell us your name.");
  if (name.length > LIMITS.name) return bad("That name is too long.");
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email)
    return bad("Enter a valid email address.");
  if (message.length < 10)
    return bad("Add a little more detail — at least 10 characters.");
  if (message.length > LIMITS.message)
    return bad(`Keep the message under ${LIMITS.message} characters.`);
  if (!TOPICS.includes(topic)) return bad("Pick one of the listed topics.");

  // Both windows are consumed, never short-circuited: the local floor has to
  // keep counting even on a request the shared limiter already refused.
  const shared = await withinIpRateLimit(req, {
    action: "contact",
    max: MAX_PER_WINDOW,
    windowSecs: WINDOW_SECS,
  });
  const local = overLocalWindow(clientIp(req) ?? "unknown");
  if (!shared || local)
    return bad("Too many messages from this network. Try again later.", 429);

  const key = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO ?? "support@insertgo.ai";
  const from = process.env.EMAIL_FROM ?? "InsertGo <onboarding@resend.dev>";

  if (!key) {
    // Dev fallback, mirroring lib/auth.ts: no key configured yet, so log the
    // envelope (never in production — there the missing key is a real fault).
    if (process.env.NODE_ENV === "production") {
      console.error("[contact] RESEND_API_KEY is not configured");
      return bad("Messaging is temporarily unavailable.", 503);
    }
    console.log(
      // log-hygiene: dev only — production returned 503 above.
      [
        "[contact][dev] no RESEND_API_KEY set — NOTHING was sent.",
        `  inbox mail  to ${to}  reply-to ${email}`,
        `  subject     [${topic}] ${name}`,
        `  receipt     ${
          isSuppressedAutoReplyEmail(email)
            ? "SUPPRESSED (system address)"
            : `to ${email}`
        }`,
        "",
        message,
        "",
        "  To send for real: put RESEND_API_KEY in .env.local. On the shared",
        "  onboarding@resend.dev sender Resend delivers ONLY to the Resend",
        "  account owner's own address — so set CONTACT_TO to that address AND",
        "  type it into the form's Email field, or both mails come back 403",
        "  (this route then answers 502). Verify a domain in Resend and point",
        "  EMAIL_FROM at an address on it to mail arbitrary visitors.",
      ].join("\n"),
    );
    return Response.json({ ok: true });
  }

  // One id ties the two mails to each other and to the log line. It also gives
  // each send its own idempotency key, so an SDK-level retry after a timeout
  // cannot deliver either mail twice.
  const submissionId = crypto.randomUUID();
  const safe = {
    name: escapeHtml(name),
    email: escapeHtml(email),
    topic: escapeHtml(topic),
    message: escapeHtml(message).replace(/\n/g, "<br />"),
  };
  const shell = (inner: string) =>
    `<div style="margin:0;padding:24px;background:#f6f4f1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e2dc;border-radius:14px;padding:28px">${inner}</div>` +
    `<p style="max-width:560px;margin:14px auto 0;font-size:12px;color:#8a8177;text-align:center">InsertGo · insertgo.ai</p>` +
    `</div>`;
  const detailRows =
    `<tr><td style="padding:4px 16px 4px 0;color:#8a8177;font-size:13px">Name</td><td style="padding:4px 0;font-size:13px">${safe.name}</td></tr>` +
    `<tr><td style="padding:4px 16px 4px 0;color:#8a8177;font-size:13px">Email</td><td style="padding:4px 0;font-size:13px"><a href="mailto:${safe.email}" style="color:#1c1917">${safe.email}</a></td></tr>` +
    `<tr><td style="padding:4px 16px 4px 0;color:#8a8177;font-size:13px">Topic</td><td style="padding:4px 0;font-size:13px">${safe.topic}</td></tr>`;

  // Imported lazily so the module (and its bundle weight) only loads on a real
  // submission, not on every cold start of an unrelated route.
  const { Resend } = await import("resend");
  const resend = new Resend(key);

  const [inbox, receipt] = await Promise.allSettled([
    resend.emails.send(
      {
        from,
        to: [to],
        // The visitor's address goes HERE and only here. As a `from` it would
        // fail SPF/DKIM alignment for our domain — rejected or junked by the
        // receiver, and every such send erodes the domain's reputation.
        replyTo: email,
        subject: `[${topic}] ${name}`,
        text: `New contact form submission\n\nName: ${name}\nEmail: ${email}\nTopic: ${topic}\nSubmission: ${submissionId}\n\n${message}`,
        html: shell(
          `<p style="margin:0 0 18px;font-size:16px;font-weight:600">New contact form submission</p>` +
            `<table style="border-collapse:collapse;margin:0 0 18px">${detailRows}</table>` +
            `<div style="padding:16px;background:#faf8f6;border-radius:10px;font-size:14px;line-height:1.6;white-space:pre-wrap">${safe.message}</div>` +
            `<p style="margin:18px 0 0;font-size:11px;color:#8a8177">Submission ${submissionId} · reply to this mail to answer the sender.</p>`,
        ),
      },
      { idempotencyKey: `contact-inbox/${submissionId}` },
    ),
    isSuppressedAutoReplyEmail(email)
      ? Promise.resolve(null)
      : resend.emails.send(
          {
            from,
            to: [email],
            replyTo: to,
            subject: `We received your message: [${topic}]`,
            headers: {
              // RFC 3834 §5: mark the mail as machine-generated so a vacation
              // responder or gateway on the other side stays quiet instead of
              // replying to it — the second half of the loop guard, next to
              // isSuppressedAutoReplyEmail above.
              "Auto-Submitted": "auto-replied",
              "X-Auto-Response-Suppress": "All",
              "X-Entity-Ref-ID": submissionId,
            },
            text: `Hi ${name},\n\nThanks for getting in touch — your message reached the InsertGo team and we'll reply within one business day.\n\nYour enquiry\nTopic: ${topic}\nSent from: ${email}\nReference: ${submissionId}\n\n${message}\n\nNo need to reply to this note; it is an automated confirmation. Replies go to ${to} and reach a human.\n\n— The InsertGo team`,
            html: shell(
              `<p style="margin:0 0 10px;font-size:18px;font-weight:600">Thanks, ${safe.name} — we got your message.</p>` +
                `<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#57534e">It's with the InsertGo team now, and you'll have a reply within one business day.</p>` +
                `<table style="border-collapse:collapse;margin:0 0 18px">${detailRows}</table>` +
                `<div style="padding:16px;background:#faf8f6;border-radius:10px;font-size:14px;line-height:1.6;white-space:pre-wrap">${safe.message}</div>` +
                `<p style="margin:20px 0 0;font-size:12px;color:#8a8177">Automated confirmation — no need to reply. Anything you send to <a href="mailto:${escapeHtml(to)}" style="color:#8a8177">${escapeHtml(to)}</a> reaches a person. Reference ${submissionId}.</p>`,
            ),
          },
          { idempotencyKey: `contact-ack/${submissionId}` },
        ),
  ]);

  const inboxError = sendFailure(inbox);
  if (inboxError) {
    // safeError, not console.error (R-06): this error object quotes the request
    // it failed on, and the request carries the submitter's address.
    safeError("[contact] delivery failed", inboxError);
    return bad("Could not send your message. Try again in a moment.", 502);
  }

  // The enquiry IS filed by this point — the receipt is a courtesy. Failing the
  // request over it would tell the visitor to send again and duplicate the
  // ticket, which is worse than a missing confirmation mail.
  const receiptError = sendFailure(receipt);
  if (receiptError)
    safeError(
      `[contact] acknowledgement failed submission=${submissionId}`,
      receiptError,
    );

  return Response.json({ ok: true, submissionId });
}
