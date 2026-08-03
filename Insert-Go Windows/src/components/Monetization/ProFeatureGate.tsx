/**
 * Freemium gate for Workflow Shell features (multi-model routing, prompt
 * library, local history). Core chat is NEVER gated — wrap only power-user
 * entry points.
 *
 * Entitlement: a lifetime license OR a paid subscription tier (Plus/Pro) —
 * the 3-tier model bundles the Workflow Shell into the paid plans, so a
 * subscriber never sees a second paywall.
 *
 * Non-intrusive by design: the wrapped trigger renders exactly as it does
 * for entitled users (no disabled styling, no layout shift —
 * `display:contents` generates no box). What changes is behaviour: a
 * capture-phase click handler intercepts activation BEFORE the child's own
 * handlers run, so the premium code path never executes for free users; they
 * get an upsell modal instead. Capture also covers keyboard activation of
 * native buttons/links, since Enter/Space synthesize a click event.
 *
 * Which modal: pass `reason` ("history") to open the contextual plan-upgrade
 * modal (subscription tiers); without it the lifetime-license upsell opens —
 * the pre-3-tier behaviour for routing/library gates.
 */
import type { ReactNode } from "react";
import { useIsPro, useLicenseStore } from "@/store/licenseStore";
import { tierOf, useAuthStore } from "@/store/authStore";
import {
  useMonetizationStore,
  type UpgradeReason,
} from "@/store/monetizationStore";

export function ProFeatureGate({
  feature,
  reason,
  children,
}: {
  /** User-facing feature name, e.g. "Multi-Model Routing" — shown as the
   *  UpgradeModal headline so the upsell names what was just clicked. */
  feature: string;
  /** When set, a gated click opens the contextual PlanUpgradeModal for this
   *  reason instead of the lifetime-license upsell. */
  reason?: UpgradeReason;
  children: ReactNode;
}) {
  const licensePro = useIsPro();
  const paidTier = useAuthStore((s) => tierOf(s.user) !== "free");
  const openUpsell = useLicenseStore((s) => s.openUpsell);
  const openUpgrade = useMonetizationStore((s) => s.openUpgrade);

  if (licensePro || paidTier) return <>{children}</>;

  return (
    <div
      style={{ display: "contents" }}
      onClickCapture={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (reason) openUpgrade(reason);
        else openUpsell(feature);
      }}
    >
      {children}
    </div>
  );
}
