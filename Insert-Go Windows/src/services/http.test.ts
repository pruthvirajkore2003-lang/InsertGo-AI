import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http } from "./http";

describe("http auth gate", () => {
  const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockClear();
    sessionStorage.clear();
    localStorage.clear();
  });

  function setToken() {
    sessionStorage.setItem(
      "auth_token",
      JSON.stringify({ v: "test-token", exp: Date.now() + 60 * 60 * 1000 }),
    );
    localStorage.setItem("auth_token_ts", String(Date.now()));
  }

  it("blocks unauthenticated non-auth requests with a local 401", async () => {
    const res = await http("https://api.example.com/api/generate");
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lets auth-flow requests through without a token", async () => {
    const res = await http("https://api.example.com/api/auth/get-session");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets the desktop token exchange through without a token", async () => {
    const res = await http("https://api.example.com/api/desktop/token", {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("lets authenticated requests through", async () => {
    setToken();
    const res = await http("https://api.example.com/api/generate");
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles Request and URL inputs", async () => {
    const blocked = await http(
      new Request("https://api.example.com/api/generate"),
    );
    expect(blocked.status).toBe(401);
    const allowed = await http(
      new URL("https://api.example.com/api/desktop/token"),
    );
    expect(allowed.status).toBe(200);
  });
});
