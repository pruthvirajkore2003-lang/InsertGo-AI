import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer, customSession, emailOTP } from "better-auth/plugins";
import { sso } from "@better-auth/sso";
import { Pool } from "pg";
import { Resend } from "resend";
import { pool } from "./pgPool";
import { pgPoolConfig } from "./pgSsl";
import {
  dailyRemaining,
  normalizeTier,
  TIER_DAILY_CREDITS,
  tierAllowsHistory,
  type Tier,
} from "./entitlements";

/**
 * Server-side Better Auth instance.
 *
 * Sign-in lanes:
 *  1. Google OAuth        — socialProviders.google
 *  2. Enterprise SSO      — @better-auth/sso (OIDC providers registered per org)
 *  3. Email OTP           — emailOTP plugin, codes delivered via Resend
 *
 * Desktop (Tauri) clients authenticate with Authorization Code + PKCE over the
 * `insertgo://` URI scheme (app/desktop/authorize + app/api/desktop/token, see
 * lib/desktopAuth.ts) and then call the API with `Authorization: Bearer
 * <session-token>` (bearer plugin).
 */

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;

/** Operators allowed to register enterprise SSO providers (see `sso()` below).
 *  Comma-separated in SSO_ADMIN_EMAILS; empty means nobody can register one. */
const SSO_ADMIN_EMAILS = new Set(
  (process.env.SSO_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Origins allowed to reach the auth API cross-origin.
 *
 * The two `tauri://`-family entries are the PACKAGED app and belong in every
 * build. `localhost:1420` (Vite dev server) and `localhost:3005` (preview
 * harness) are development-only and must never ship: trustedOrigins feeds Better
 * Auth's originCheckMiddleware, which validates the Origin header AND any
 * `callbackURL`, so a trusted localhost port is a post-sign-in redirect target
 * for anything listening on the user's machine.
 */
const DESKTOP_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:1420", "http://localhost:3005"]
    : []),
];

// Belt and braces: the entry above was already dev-gated once and a second one
// was added beside it without the gate. Fail the build/boot instead of shipping
// it a third time.
if (
  process.env.NODE_ENV === "production" &&
  DESKTOP_ORIGINS.some((o) => /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(o))
) {
  throw new Error(
    "A localhost origin is in trustedOrigins for a production build.",
  );
}

// Cached on `globalThis` for the same reason lib/db.ts is: Next dev HMR
// re-evaluates this module on every edit, and an uncached `new Pool()` here
// strands the previous pool's sockets on the Supabase pooler and makes the next
// request pay a cold TLS handshake (~1.9 s measured against ap-northeast-1).
const g = globalThis as unknown as { __igAuthPool?: Pool };
const authPool = g.__igAuthPool ?? new Pool(pgPoolConfig({ max: 10 }));
if (process.env.NODE_ENV !== "production") g.__igAuthPool = authPool;

export const auth = betterAuth({
  appName: "InsertGo.AI",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  // TLS owned by the `ssl` object via pgPoolConfig (see lib/pgSsl.ts), not the
  // connection string — Supabase's chain needs the pinned CA to verify.
  database: authPool,

  // Password auth intentionally disabled — OTP / OAuth / SSO only.
  emailAndPassword: { enabled: false },

  // Desktop (Tauri) app origins — allowed to hit the auth API cross-origin.
  // trustedOrigins gates originCheckMiddleware, which validates BOTH the Origin
  // header and any `callbackURL`, so a dev origin left in a production build
  // widens the set of post-sign-in redirect targets to whatever answers on that
  // localhost port on the victim's machine.
  trustedOrigins: DESKTOP_ORIGINS,

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days — tool spends money/credits, keep the window short
    updateAge: 60 * 60 * 24, // refresh expiry at most once a day
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  advanced: {
    // Never expose whether an email exists beyond what the flow requires.
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20, // global default; auth endpoints have stricter built-ins
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 60 * 5, // 5 minutes
      allowedAttempts: 3,
      async sendVerificationOTP({ email, otp, type }) {
        const subject =
          type === "sign-in"
            ? `${otp} is your InsertGo sign-in code`
            : `${otp} is your InsertGo verification code`;

        const isDev = process.env.NODE_ENV !== "production";

        if (!resend) {
          // Dev fallback: no RESEND_API_KEY yet — print to server console.
          console.log(`[auth][dev] OTP for ${email} (${type}): ${otp}`);
          return;
        }

        // The Resend SDK reports API failures in `error` instead of throwing,
        // so an unchecked call returns `{ success: true }` to the client while
        // no mail was ever sent — the user then waits for a code that does not
        // exist. The shared `onboarding@resend.dev` sender in particular only
        // delivers to the Resend account owner's own address.
        const { error } = await resend.emails.send({
          from: process.env.EMAIL_FROM ?? "InsertGo <onboarding@resend.dev>",
          to: email,
          subject,
          text: `Your InsertGo code is ${otp}. It expires in 5 minutes. If you didn't request this, ignore this email.`,
        });
        if (error) {
          console.error(`[auth] OTP delivery to ${email} failed`, error);
          if (isDev) {
            // Local work shouldn't be blocked by an unverified sending domain.
            console.log(`[auth][dev] OTP for ${email} (${type}): ${otp}`);
            return;
          }
          throw new Error(`Could not send the sign-in code: ${error.message}`);
        }
      },
    }),

    // OIDC providers are registered at runtime via /api/auth/sso/register.
    // Better Auth gates that endpoint on a session ALONE: without the limit
    // below, any signed-in user could register a provider claiming any email
    // domain. Domain verification is off (the `ssoProvider` table has no
    // `domainVerified` column, see supabase-auth-schema.sql), so a claimed
    // domain would route that domain's real employees straight to an
    // attacker-controlled IdP on our sign-in flow. A limit of 0 makes the
    // endpoint return 403 for everyone not on the operator allowlist.
    sso({
      providersLimit: (user) =>
        SSO_ADMIN_EMAILS.has((user.email ?? "").toLowerCase()) ? 10 : 0,
    }),

    bearer(), // lets the desktop app use `Authorization: Bearer <session-token>`

    // Adds billing entitlements to every get-session response. New desktop
    // builds read `tier` / `dailyCreditsRemaining` / `dailyCreditsMax` /
    // `addOnCredits` / `historyAllowed`; pre-3-tier builds
    // still read the legacy `subscriptionStatus` / `credits` stamps (mapped
    // from the tier model so nothing breaks mid-rollout). customSession
    // fields are never cookie-cached, so a webhook-driven change is visible
    // on the next fetch. On a DB blip we fall back to free-tier defaults
    // rather than failing the whole session read.
    customSession(async ({ user, session }) => {
      let tier: Tier = "free";
      let addOnCredits = 0;
      let remaining = TIER_DAILY_CREDITS.free;
      try {
        const { rows } = await pool.query(
          `select "tier", "subscriptionStatus", "addOnCredits",
                  "dailyCreditsUsed",
                  to_char("dailyCreditsDate", 'YYYY-MM-DD') as "dailyDate"
             from "user" where "id" = $1`,
          [user.id],
        );
        const row = (rows[0] ?? {}) as Record<string, unknown>;
        tier = normalizeTier(row);
        addOnCredits =
          typeof row.addOnCredits === "number" &&
          Number.isFinite(row.addOnCredits)
            ? row.addOnCredits
            : 0;
        remaining = dailyRemaining(row, tier);
      } catch (e) {
        console.error("[auth] entitlement lookup failed; using defaults", e);
      }
      return {
        user: {
          ...user,
          tier,
          dailyCreditsRemaining: remaining,
          dailyCreditsMax: TIER_DAILY_CREDITS[tier],
          addOnCredits,
          historyAllowed: tierAllowsHistory(tier),
          // Legacy stamps for pre-3-tier clients: paid tiers read as
          // "subscribed", free as "trial"; credits = total spendable now.
          subscriptionStatus: tier === "free" ? "trial" : "subscribed",
          credits: remaining + addOnCredits,
        },
        session,
      };
    }),

    // Must be last: writes Set-Cookie headers in Next.js server actions.
    nextCookies(),
  ],
});
