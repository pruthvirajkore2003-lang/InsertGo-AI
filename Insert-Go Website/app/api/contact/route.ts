/**
 * POST /api/contact — the contact form's delivery lane.
 *
 * The form used to fake its own success state: it set `sent` locally and no
 * message ever left the browser. This is the missing half — one Resend send to
 * the support inbox, reusing the transport lib/auth.ts already configures for
 * sign-in codes (no new dependency, no new schema).
 *
 * Trust boundary (this route is UNAUTHENTICATED):
 *  - body is read through readBodyCapped, so an oversize/chunked payload is
 *    never fully buffered,
 *  - every field is length- and shape-checked before it reaches the mail body,
 *  - `topic` must be one of the four the UI offers — free text there would let
 *    a caller write the subject line,
 *  - the reply-to address is validated, and the message body is sent as `text`
 *    (never HTML), so nothing submitted here can be interpreted as markup,
 *  - a honeypot field plus a per-IP fixed window blunt drive-by spam.
 */
import { BodyTooLargeError, readBodyCapped } from "@/lib/httpBody";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const LIMITS = { name: 120, email: 254, message: 4000 } as const;
const TOPICS = ["General", "Bug report", "Feature idea", "Teams / Sales"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
// ponytail: per-instance memory, so N serverless instances allow N× the cap.
// That is fine for a contact form (the honeypot and the mailbox absorb the
// rest); move to the "apiUsage" table if this ever needs to be exact — it
// would need its FK to "user" relaxed first, since callers here are anonymous.
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep — the map only grows while requests arrive.
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

function bad(error: string, status = 400) {
  return Response.json({ error }, { status });
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
  // does not retry with the field left blank.
  if (typeof body.company === "string" && body.company.trim() !== "") {
    return Response.json({ ok: true });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const name = str(body.name);
  const email = str(body.email);
  const message = str(body.message);
  const topic = str(body.topic);

  if (!name) return bad("Tell us your name.");
  if (name.length > LIMITS.name) return bad("That name is too long.");
  if (!EMAIL_RE.test(email) || email.length > LIMITS.email)
    return bad("Enter a valid email address.");
  if (message.length < 10)
    return bad("Add a little more detail — at least 10 characters.");
  if (message.length > LIMITS.message)
    return bad(`Keep the message under ${LIMITS.message} characters.`);
  if (!TOPICS.includes(topic)) return bad("Pick one of the listed topics.");

  if (rateLimited(clientIp(req)))
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
    console.log(`[contact][dev] ${topic} from ${name} <${email}>: ${message}`);
    return Response.json({ ok: true });
  }

  // Imported lazily so the module (and its bundle weight) only loads on a real
  // submission, not on every cold start of an unrelated route.
  const { Resend } = await import("resend");
  const { error } = await new Resend(key).emails.send({
    from,
    to,
    replyTo: email,
    subject: `[${topic}] ${name}`,
    text: `From: ${name} <${email}>\nTopic: ${topic}\n\n${message}`,
  });

  if (error) {
    // The Resend SDK reports failures in `error` rather than throwing, so an
    // unchecked call would report success while nothing was ever delivered.
    console.error("[contact] delivery failed", error);
    return bad("Could not send your message. Try again in a moment.", 502);
  }

  return Response.json({ ok: true });
}
