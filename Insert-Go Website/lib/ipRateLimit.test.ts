import { afterEach, describe, expect, it, vi } from "vitest";

const { redisMock } = vi.hoisted(() => ({
  redisMock: { value: null as unknown },
}));
vi.mock("./edgeCache", async () => {
  const actual = await vi.importActual<typeof import("./edgeCache")>(
    "./edgeCache"
  );
  return { ...actual, redis: () => redisMock.value };
});

import { withinIpRateLimit } from "./ipRateLimit";

const OPTS = { action: "test", max: 3, windowSecs: 60 };
const req = (ip = "203.0.113.7") =>
  new Request("https://example.com/x", { headers: { "x-forwarded-for": ip } });

afterEach(() => {
  redisMock.value = null;
  vi.restoreAllMocks();
});

/** Minimal Redis stand-in: a counter per key, like INCR. */
function fakeRedis() {
  const counts = new Map<string, number>();
  return {
    counts,
    incr: vi.fn(async (k: string) => {
      const n = (counts.get(k) ?? 0) + 1;
      counts.set(k, n);
      return n;
    }),
    expire: vi.fn(async () => 1),
  };
}

describe("withinIpRateLimit", () => {
  it("allows up to max, then denies", async () => {
    const r = fakeRedis();
    redisMock.value = r;
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await withinIpRateLimit(req(), OPTS));
    expect(results).toEqual([true, true, true, false, false]);
    // TTL written exactly once, on the call that created the bucket.
    expect(r.expire).toHaveBeenCalledTimes(1);
  });

  it("counts each IP separately", async () => {
    redisMock.value = fakeRedis();
    for (let i = 0; i < 4; i++) await withinIpRateLimit(req("198.51.100.1"), OPTS);
    // A different caller starts from zero — one flood must not lock out
    // everybody else's sign-in.
    expect(await withinIpRateLimit(req("198.51.100.2"), OPTS)).toBe(true);
  });

  it("never puts the raw IP in the key", async () => {
    const r = fakeRedis();
    redisMock.value = r;
    await withinIpRateLimit(req("203.0.113.7"), OPTS);
    expect([...r.counts.keys()][0]).not.toContain("203.0.113.7");
  });

  it("fails OPEN when Redis is unconfigured, erroring, or the IP is unknown", async () => {
    redisMock.value = null;
    expect(await withinIpRateLimit(req(), OPTS)).toBe(true);

    vi.spyOn(console, "error").mockImplementation(() => {});
    redisMock.value = {
      incr: vi.fn().mockRejectedValue(new Error("upstash down")),
      expire: vi.fn(),
    };
    expect(await withinIpRateLimit(req(), OPTS)).toBe(true);

    redisMock.value = fakeRedis();
    expect(
      await withinIpRateLimit(new Request("https://example.com/x"), OPTS)
    ).toBe(true);
  });
});
