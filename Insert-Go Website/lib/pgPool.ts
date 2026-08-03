/**
 * App-owned Postgres pool for the Node-runtime surfaces that still speak raw
 * SQL over a socket: Better Auth's adapter (lib/auth.ts), the Dodo billing
 * webhook, and the account page.
 *
 * This used to live in lib/db.ts. It moved out when `/api/ai/generate` went to
 * the Edge runtime: `pg` needs `node:net`/`node:tls`, so any module reachable
 * from an Edge route must not import it — and lib/db.ts is reachable (via
 * lib/usageLimit.ts). lib/db.ts is now the Edge-safe HTTP client; this file is
 * the Node-only one. Nothing may import it from an Edge route.
 *
 * Point DATABASE_URL at Supabase's **transaction pooler** (Supavisor, port
 * 6543) rather than the direct 5432 endpoint: it multiplexes many short-lived
 * serverless pools onto a small set of real backends, which is what keeps N
 * warm instances × `max` from exhausting Postgres. `max` stays small for the
 * same reason — the pooler, not this process, is the place to hold connections.
 *
 * Cached on `globalThis` so Next.js dev HMR and warm serverless invocations
 * reuse one pool instead of leaking a new one per reload/invocation. TLS is
 * owned by the `ssl` object via pgPoolConfig, not the connection string (see
 * lib/pgSsl.ts).
 */
import { Pool } from "pg";
import { pgPoolConfig } from "./pgSsl";

const g = globalThis as unknown as { __igPool?: Pool };

export const pool =
  g.__igPool ?? new Pool(pgPoolConfig({ max: Number(process.env.PG_POOL_MAX ?? 3) }));

if (process.env.NODE_ENV !== "production") g.__igPool = pool;
