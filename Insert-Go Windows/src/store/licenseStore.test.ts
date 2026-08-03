import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLicenseStore } from "@/store/licenseStore";
import { LicenseNetworkError, validateLicenseKey } from "@/services/licenseService";

vi.mock("@/services/licenseService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/licenseService")>()),
  validateLicenseKey: vi.fn(),
}));

const mockValidate = vi.mocked(validateLicenseKey);
const KEY = "AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD";

beforeEach(() => {
  localStorage.clear();
  useLicenseStore.setState({
    licenseKey: null,
    status: "unlicensed",
    lastValidatedAt: null,
    error: null,
    upsellFeature: null,
  });
  mockValidate.mockReset();
});

describe("licenseStore", () => {
  it("grants Pro on a valid key and caches the verdict in localStorage", async () => {
    mockValidate.mockResolvedValue({ valid: true });
    expect(await useLicenseStore.getState().activate(KEY)).toBe(true);
    expect(useLicenseStore.getState().status).toBe("pro");

    const cached = JSON.parse(localStorage.getItem("insertgo-license")!);
    expect(cached.state).toMatchObject({ licenseKey: KEY, status: "pro" });
  });

  it("keeps Pro when revalidation fails with a network error (offline)", async () => {
    useLicenseStore.setState({ licenseKey: KEY, status: "pro" });
    mockValidate.mockRejectedValue(new LicenseNetworkError());
    await useLicenseStore.getState().revalidate();
    expect(useLicenseStore.getState().status).toBe("pro");
    expect(useLicenseStore.getState().licenseKey).toBe(KEY);
  });

  it("downgrades and clears the key on a definitive revocation", async () => {
    useLicenseStore.setState({ licenseKey: KEY, status: "pro" });
    mockValidate.mockResolvedValue({ valid: false, reason: "revoked" });
    await useLicenseStore.getState().revalidate();
    expect(useLicenseStore.getState().status).toBe("invalid");
    expect(useLicenseStore.getState().licenseKey).toBeNull();
    expect(useLicenseStore.getState().error).toMatch(/revoked/);
  });

  it("does not destroy an existing license when a mistyped new key is rejected", async () => {
    useLicenseStore.setState({ licenseKey: KEY, status: "pro" });
    mockValidate.mockResolvedValue({ valid: false, reason: "invalid" });
    expect(await useLicenseStore.getState().activate("TYPO-KEY")).toBe(false);
    expect(useLicenseStore.getState().status).toBe("pro");
    expect(useLicenseStore.getState().licenseKey).toBe(KEY);
    expect(useLicenseStore.getState().error).toMatch(/isn't valid/);
  });

  it("never grants Pro when a NEW key can't be validated (offline activation)", async () => {
    mockValidate.mockRejectedValue(new LicenseNetworkError());
    expect(await useLicenseStore.getState().activate(KEY)).toBe(false);
    expect(useLicenseStore.getState().status).toBe("unlicensed");
    expect(useLicenseStore.getState().error).toMatch(/offline/);
  });

  it("falls back to defaults when the persisted cache is corrupted", async () => {
    localStorage.setItem(
      "insertgo-license",
      JSON.stringify({ state: { licenseKey: 42, status: "banana" }, version: 1 })
    );
    await useLicenseStore.persist.rehydrate();
    expect(useLicenseStore.getState().status).toBe("unlicensed");
    expect(useLicenseStore.getState().licenseKey).toBeNull();
  });

  it("never trusts cached Pro before startup revalidation", async () => {
    localStorage.setItem(
      "insertgo-license",
      JSON.stringify({
        state: { licenseKey: KEY, status: "pro", lastValidatedAt: 1 },
        version: 1,
      })
    );
    await useLicenseStore.persist.rehydrate();
    expect(useLicenseStore.getState().status).toBe("unlicensed");
    expect(useLicenseStore.getState().licenseKey).toBe(KEY);
  });

  it("restores Pro only after the cached key validates this launch", async () => {
    localStorage.setItem(
      "insertgo-license",
      JSON.stringify({
        state: { licenseKey: KEY, status: "pro", lastValidatedAt: 1 },
        version: 1,
      })
    );
    await useLicenseStore.persist.rehydrate();
    mockValidate.mockResolvedValue({ valid: true });

    await useLicenseStore.getState().revalidate();

    expect(useLicenseStore.getState().status).toBe("pro");
    expect(mockValidate).toHaveBeenCalledWith(KEY);
  });
});
