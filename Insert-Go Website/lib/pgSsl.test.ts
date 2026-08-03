import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pgPoolConfig } from "./pgSsl";

// `process.env.NODE_ENV` is readonly to TypeScript (@types/node ≥ 20), so a
// direct assignment fails `tsc --noEmit` even though it works at runtime.
// vi.stubEnv is the supported way to move it, and vi.unstubAllEnvs restores it.

const SAMPLE_URL =
  "postgresql://user:pw@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require";
const SAMPLE_CA =
  "-----BEGIN CERTIFICATE-----\\nMIIDabc\\n-----END CERTIFICATE-----\\n";

const saved = {
  url: process.env.DATABASE_URL,
  ca: process.env.SUPABASE_CA_CERT,
};

beforeEach(() => {
  process.env.DATABASE_URL = SAMPLE_URL;
  delete process.env.SUPABASE_CA_CERT;
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  process.env.DATABASE_URL = saved.url;
  if (saved.ca === undefined) delete process.env.SUPABASE_CA_CERT;
  else process.env.SUPABASE_CA_CERT = saved.ca;
  vi.unstubAllEnvs();
});

describe("pgPoolConfig", () => {
  it("strips sslmode (and other ssl* params) from the connection string", () => {
    const { connectionString } = pgPoolConfig();
    expect(connectionString).toBeDefined();
    const params = new URL(connectionString as string).searchParams;
    expect(params.has("sslmode")).toBe(false);
    expect(params.has("sslrootcert")).toBe(false);
  });

  it("verifies against the CA when SUPABASE_CA_CERT is set", () => {
    process.env.SUPABASE_CA_CERT = SAMPLE_CA;
    const { ssl } = pgPoolConfig();
    expect(ssl).toMatchObject({ rejectUnauthorized: true });
    // `\n`-escaped env value is unescaped into a real PEM.
    expect((ssl as { ca: string }).ca).toContain("-----BEGIN CERTIFICATE-----");
    expect((ssl as { ca: string }).ca).toContain("\n");
    expect((ssl as { ca: string }).ca).not.toContain("\\n");
  });

  it("passes extra options through (e.g. max) without clobbering ssl", () => {
    process.env.SUPABASE_CA_CERT = SAMPLE_CA;
    const cfg = pgPoolConfig({ max: 5 });
    expect(cfg.max).toBe(5);
    expect(cfg.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it("falls back to an unverified link in dev when the CA is unset", () => {
    const { ssl } = pgPoolConfig();
    expect(ssl).toEqual({ rejectUnauthorized: false });
  });

  it("throws in production when the CA is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => pgPoolConfig()).toThrow(/SUPABASE_CA_CERT is required/);
  });

  it("throws when DATABASE_URL is not set", () => {
    delete process.env.DATABASE_URL;
    expect(() => pgPoolConfig()).toThrow(/DATABASE_URL is not set/);
  });
});
