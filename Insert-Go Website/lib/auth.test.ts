import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-06: what the OTP lane is allowed to write to a log.
 *
 * The assertions look at the console output rather than at return values,
 * because the regression this guards has no other symptom: a build that logs
 * the code still signs users in, still sends the mail, and still passes every
 * auth test — while handing anyone with log access a working credential.
 */

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

// Stubbed so the OTP lane's audit write is observable AND silent: unconfigured,
// the real module degrades to its own console.error, which would look like a
// log-hygiene regression to the assertions below.
const { audit } = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock("./auditLog", () => ({ audit }));

process.env.BETTER_AUTH_SECRET ||= "test-secret-value-32-bytes-long!!";
process.env.BETTER_AUTH_URL ||= "http://localhost:3000";
process.env.DATABASE_URL ||= "postgres://u:p@localhost:5432/db";
// lib/pgSsl refuses to build a pool under NODE_ENV=production without a CA, and
// these cases load the module under exactly that. Never dialled — the pool is
// constructed at import and no query runs here.
process.env.SUPABASE_CA_CERT ||= "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----";

const ADDRESS = "person@example.com";
const CODE = "483920";

/** `resend` is decided once at module scope from the environment, so each case
 *  re-imports the module under the environment it is about. */
async function load(env: "production" | "development", withKey: boolean) {
  vi.resetModules();
  send.mockReset();
  audit.mockReset();
  vi.stubEnv("NODE_ENV", env);
  if (withKey) process.env.RESEND_API_KEY = "re_test_key";
  else delete process.env.RESEND_API_KEY;
  return import("./auth");
}

function spies() {
  return {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };
}

const text = (s: ReturnType<typeof spies>) =>
  [...s.log.mock.calls, ...s.error.mock.calls].flat().map(String).join(" ");

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

// Importing lib/auth.ts boots Better Auth, which opens a real pooled
// connection to DATABASE_URL. Since the project moved to ap-south-1 that cold
// handshake alone can eat most of vitest's 5s default, so these cases time out
// on a cold run while asserting nothing about latency. The budget is raised
// rather than the connection mocked: the wiring is the thing under test.
describe("deliverOtp in production", { timeout: 20_000 }, () => {
  it("fails closed with no transport, and logs neither address nor code", async () => {
    // The finding this item opened on: the old guard was `!resend`, so a
    // production deploy that lost its Resend key printed live codes and told
    // the client the mail had been sent.
    const { deliverOtp } = await load("production", false);
    const s = spies();

    await expect(
      deliverOtp({ email: ADDRESS, otp: CODE, type: "sign-in" }),
    ).rejects.toThrow(/Could not send the sign-in code/);

    expect(s.log).not.toHaveBeenCalled();
    expect(text(s)).not.toContain(CODE);
    expect(text(s)).not.toContain(ADDRESS);
  });

  it("logs neither address nor code when delivery fails", async () => {
    const { deliverOtp } = await load("production", true);
    send.mockResolvedValue({
      error: {
        name: "validation_error",
        message: `You can only send testing emails to your own address (${ADDRESS})`,
      },
    });
    const s = spies();

    const thrown = await deliverOtp({
      email: ADDRESS,
      otp: CODE,
      type: "sign-in",
    }).catch((e: Error) => e);

    expect(s.log).not.toHaveBeenCalled();
    expect(text(s)).not.toContain(ADDRESS);
    expect(text(s)).not.toContain(CODE);
    // Better Auth renders a thrown message back to an unauthenticated caller,
    // so the provider's echoed request must not travel in it either.
    expect((thrown as Error).message).not.toContain(ADDRESS);
    expect((thrown as Error).message).not.toContain("testing emails");
  });

  it("sends the mail and logs nothing on the happy path", async () => {
    const { deliverOtp } = await load("production", true);
    send.mockResolvedValue({ error: null });
    const s = spies();

    await deliverOtp({ email: ADDRESS, otp: CODE, type: "sign-in" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ to: ADDRESS, subject: expect.stringContaining(CODE) }),
    );
    expect(text(s)).toBe("");
  });

  it("records the code request in the audit log, pseudonymously", async () => {
    // A burst of these against one account is credential stuffing with the
    // password step removed, and Vercel's own logs age out long before the
    // 180-day window CERT-In asks for.
    const { deliverOtp } = await load("production", true);
    send.mockResolvedValue({ error: null });

    await deliverOtp({ email: ADDRESS, otp: CODE, type: "sign-in" });

    expect(audit).toHaveBeenCalledWith(
      "auth.otp.request",
      expect.objectContaining({ outcome: "success" }),
    );
    const detail = audit.mock.calls[0]?.[1]?.detail as Record<string, unknown>;
    expect(detail.type).toBe("sign-in");
    expect(JSON.stringify(detail)).not.toContain(ADDRESS);
    expect(JSON.stringify(detail)).not.toContain(CODE);
  });

  it("records a delivery failure as a failure", async () => {
    const { deliverOtp } = await load("production", true);
    send.mockResolvedValue({ error: { name: "x", message: "y" } });

    await deliverOtp({ email: ADDRESS, otp: CODE, type: "sign-in" }).catch(
      () => {},
    );

    expect(audit).toHaveBeenCalledWith(
      "auth.otp.request",
      expect.objectContaining({ outcome: "failure" }),
    );
  });
});

describe("deliverOtp in development", () => {
  it("still prints the code so local sign-in works without a Resend key", async () => {
    // DEV_SETUP.md's local flow reads the code from this line. Removing it
    // would be the kind of "fix" that gets reverted the first time someone
    // tries to sign in locally.
    const { deliverOtp } = await load("development", false);
    const s = spies();

    await deliverOtp({ email: ADDRESS, otp: CODE, type: "sign-in" });

    expect(text(s)).toContain(CODE);
  });
});
