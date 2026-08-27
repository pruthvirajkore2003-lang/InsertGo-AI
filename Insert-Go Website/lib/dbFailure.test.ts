import { beforeEach, describe, expect, it, vi } from "vitest";
import { DbConfigError, DbError } from "./db";

const audit = vi.fn();
vi.mock("./auditLog", () => ({ audit }));

const { noteDbFailure } = await import("./dbFailure");

/**
 * The two properties the degraded privacy/consent surfaces depend on.
 *
 * Both matter because the page now *survives* a broken database: the user sees
 * a banner and carries on, so the only thing standing between "the service
 * role key is wrong" and nobody ever finding out is the audit row this writes.
 * And the reason it is worth a test rather than a comment is that the failure
 * mode is silence in both directions — an over-eager audit floods the R-03
 * burst rule until it is ignored, and a missing one is invisible by
 * construction.
 */
function logged(run: () => void): string {
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    run();
    return spy.mock.calls.flat().map(String).join(" ");
  } finally {
    spy.mockRestore();
  }
}

beforeEach(() => audit.mockClear());

describe("noteDbFailure", () => {
  it("raises a critical audit for a failure retrying can never fix", () => {
    // 401 = the service-role key is wrong or was rotated. This is the live
    // /account/privacy bug, and it must not stay a console line.
    logged(() => noteDbFailure("privacy", "consent_current", new DbError("consent_current", 401), "u1"));
    expect(audit).toHaveBeenCalledTimes(1);
    const [event, options] = audit.mock.calls[0];
    expect(event).toBe("db.permanent_failure");
    expect(options).toMatchObject({
      outcome: "failure",
      severity: "critical",
      userId: "u1",
      detail: { scope: "privacy", stage: "consent_current" },
    });
  });

  it("also covers a missing function and absent config", () => {
    logged(() => noteDbFailure("privacy", "consent_current", new DbError("consent_current", 404)));
    logged(() => noteDbFailure("consent", "consent_write", new DbConfigError("SUPABASE_URL missing")));
    expect(audit).toHaveBeenCalledTimes(2);
  });

  it("stays console-only for a blip, so the burst rule keeps meaning something", () => {
    // status 0 = network error or timeout; 503 = PostgREST under load.
    logged(() => noteDbFailure("privacy", "consent_current", new DbError("consent_current", 0)));
    logged(() => noteDbFailure("privacy", "consent_current", new DbError("consent_current", 503)));
    expect(audit).not.toHaveBeenCalled();
  });

  it("never puts the error object itself in the log line", () => {
    // A PostgREST body quotes SQL text and row values; safeError is the only
    // sink allowed to see one (R-06).
    const e = Object.assign(new DbError("consent_current", 400), {
      detail: "Key (email)=(first.last@example.com) already exists",
    });
    const out = logged(() => noteDbFailure("privacy", "consent_current", e));
    expect(out).not.toContain("first.last@example.com");
    expect(out).toContain("[privacy] consent_current failed");
  });
});
