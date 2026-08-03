import type { PoolConfig } from "pg";

/**
 * Build a pg PoolConfig from DATABASE_URL with TLS owned by the `ssl` object
 * instead of the connection string.
 *
 * node-postgres (pg-connection-string ≥ 2.7) treats `sslmode=require` as
 * `verify-full` AND lets any `ssl*` URL param silently override the `ssl`
 * config object. Supabase presents a chain rooted at the private "Supabase
 * Root 2021 CA", absent from Node's trust store — so without the CA,
 * verification fails with SELF_SIGNED_CERT_IN_CHAIN. We strip the URL's
 * `ssl*` params and pass the CA explicitly so verification actually uses it.
 *
 * Set SUPABASE_CA_CERT to the "Supabase Root 2021 CA" PEM (single line,
 * `\n`-escaped). Chain + hostname are then verified (`rejectUnauthorized:
 * true`). In production the CA is required; in dev, an unset CA falls back to
 * an encrypted-but-unverified link so local work isn't blocked.
 */
export function pgPoolConfig(extra: PoolConfig = {}): PoolConfig {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");

  const url = new URL(raw);
  for (const p of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    url.searchParams.delete(p);
  }

  const caEnv = process.env.SUPABASE_CA_CERT;
  const ca = caEnv ? caEnv.replace(/\\n/g, "\n") : undefined;

  let ssl: PoolConfig["ssl"];
  if (ca) {
    ssl = { ca, rejectUnauthorized: true }; // verify chain against Supabase CA
  } else if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SUPABASE_CA_CERT is required in production for verified database TLS",
    );
  } else {
    // Dev-only fallback: still encrypted, but the chain is not verified.
    ssl = { rejectUnauthorized: false };
  }

  return { connectionString: url.toString(), ssl, ...extra };
}
