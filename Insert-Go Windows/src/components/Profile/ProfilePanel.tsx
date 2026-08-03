/**
 * Profile: authentication, account management, and the plan chooser
 * (extracted from Settings, SPEC §16.1). Signed-out users never see this
 * tab — App.tsx renders the fullscreen AuthPanel instead — so this always
 * shows the account view.
 *
 * ONE vertical flow, plan first: the Pro card carries the tab's only upgrade
 * CTA, and the account card's action row (Log Out) closes the column instead
 * of butting into the "Your plan" heading below it.
 */
import { motion, MotionConfig } from "framer-motion";
import { AuthPanel } from "@/components/Settings/AuthPanel";
import { MonetizationOnboarding } from "@/components/Monetization/MonetizationOnboarding";

export function ProfilePanel() {
  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        className="ig-body ig-profile"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
      >
        <MonetizationOnboarding />
        <AuthPanel />
      </motion.div>
    </MotionConfig>
  );
}
