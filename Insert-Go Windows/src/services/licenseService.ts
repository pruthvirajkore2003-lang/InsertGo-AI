/**
 * Lifetime Pro license validation — DEVELOPMENT-ONLY mock transport.
 *
 * This is the single seam to the real license provider (LemonSqueezy):
 * swap the body of `validateLicenseKey` for
 *   POST https://api.lemonsqueezy.com/v1/licenses/validate { license_key }
 * and map its `{ valid, license_key.status }` response onto
 * `LicenseValidationResult`. Nothing in `licenseStore` changes.
 *
 * Contract the store relies on (do not weaken when wiring the real API):
 * - Resolves `{ valid: false, reason }` ONLY when the provider definitively
 *   rejected the key (invalid / revoked / activation limit).
 * - Throws `LicenseNetworkError` when the answer is UNKNOWN (offline, DNS,
 *   5xx, timeout). The store preserves any entitlement validated during this
 *   process, but never promotes a cold localStorage cache without a successful
 *   response. Misclassifying a rejection as a network error can retain a
 *   revoked runtime entitlement; misclassifying offline as a rejection can
 *   strip a paying user mid-flight.
 *
 * Production builds fail closed until the real provider call replaces this
 * seam. Mock behaviour (dev / tests):
 * - `AAAAAAAA-BBBBBBBB-CCCCCCCC-DDDDDDDD` (4×8 hex, dashed) → valid
 * - `TEST-REVOKED` → definitive rejection (revoked)
 * - `TEST-NETFAIL` → LicenseNetworkError (deterministic offline)
 * - `navigator.onLine === false` → LicenseNetworkError (DevTools offline
 *   toggle exercises the real offline path end to end)
 */

export class LicenseNetworkError extends Error {
  constructor(message = "Could not reach the license server.") {
    super(message);
    this.name = "LicenseNetworkError";
  }
}

export type LicenseRejectReason = "invalid" | "revoked";

export type LicenseValidationResult =
  | { valid: true }
  | { valid: false; reason: LicenseRejectReason };

/** LemonSqueezy-style key: four dash-separated groups of 8 hex chars. */
const KEY_PATTERN = /^[0-9A-F]{8}(-[0-9A-F]{8}){3}$/i;

const MOCK_LATENCY_MS = 450;

export async function validateLicenseKey(
  key: string
): Promise<LicenseValidationResult> {
  if (!import.meta.env.DEV) {
    throw new Error(
      "Lifetime license validation is not configured in this production build."
    );
  }

  await new Promise((r) => setTimeout(r, MOCK_LATENCY_MS));

  if (key === "TEST-NETFAIL" || !navigator.onLine) {
    throw new LicenseNetworkError();
  }
  if (key === "TEST-REVOKED") return { valid: false, reason: "revoked" };
  if (KEY_PATTERN.test(key)) return { valid: true };
  return { valid: false, reason: "invalid" };
}
