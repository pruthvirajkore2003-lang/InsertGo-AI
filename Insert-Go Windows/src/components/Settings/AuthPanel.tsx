import { AnimatePresence, motion, MotionConfig, type Variants } from "framer-motion";
import { useAuthStore } from "@/store/authStore";
import { copyToClipboard } from "@/services/clipboard";
import { toast } from "@/store/toastStore";

// Stage swap — quick out, settled in; bezier mirrors --ig-ease.
const STAGE: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: [0.32, 0.72, 0, 1] },
  },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15, ease: "easeIn" } },
};

/**
 * Account panel — sign-in happens in the system browser via Authorization
 * Code + PKCE (Google / SSO / email OTP live on the website). The desktop app
 * waits for the `insertgo://` hand-off; no code to type. The three stages
 * (sign-in → waiting → account) must render as keyed children of ONE
 * AnimatePresence so mode="wait" can cross-fade between them — early
 * returns would drop the exit animation.
 */
export function AuthPanel() {
  const {
    user,
    hardwareId,
    isLoading,
    browserPrompt,
    error,
    signInWithBrowser,
    cancelSignIn,
    logout,
  } = useAuthStore();

  const copyLink = async () => {
    if (!browserPrompt) return;
    try {
      await copyToClipboard(browserPrompt.authorizeUrl);
      toast.success("Link copied — paste it into your browser");
    } catch (e) {
      toast.error(
        `Couldn't copy the link: ${e instanceof Error ? e.message : e}`
      );
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="ig-auth-panel">
        <AnimatePresence mode="wait" initial={false}>
          {user ? (
            <motion.div
              key="account"
              className="ig-auth__stage"
              variants={STAGE}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <h3 className="ig-section-label ig-auth__label">Account</h3>
              <div className="ig-glass-card ig-auth-card ig-auth-card--start">
                <div className="ig-auth__meta">
                  {user.name && (
                    <div className="ig-auth__row">
                      <span className="ig-auth__key">Name</span>
                      <span className="ig-auth__val">{user.name}</span>
                    </div>
                  )}
                  <div className="ig-auth__row">
                    <span className="ig-auth__key">Email</span>
                    <span className="ig-auth__val">{user.email}</span>
                  </div>
                  <div className="ig-auth__row">
                    <span className="ig-auth__key">Status</span>
                    <span
                      className={
                        user.subscriptionStatus === "subscribed"
                          ? "ig-auth__val ig-auth__val--cap ig-auth__val--ok"
                          : "ig-auth__val ig-auth__val--cap"
                      }
                    >
                      {user.subscriptionStatus}
                    </span>
                  </div>
                  <div className="ig-auth__row">
                    <span className="ig-auth__key">Credits</span>
                    <span className="ig-auth__val">
                      <i
                        className="fa-solid fa-coins ig-auth__coin"
                        aria-hidden="true"
                      />
                      {user.subscriptionStatus === "trial"
                        ? `${user.credits} remaining`
                        : "Unlimited"}
                    </span>
                  </div>
                  <div className="ig-auth__row">
                    <span className="ig-auth__key">Device ID</span>
                    <span className="ig-auth__val ig-auth__val--faint">
                      {hardwareId}
                    </span>
                  </div>
                </div>
              </div>
              {/* Account actions only. The upgrade CTA lives in
                  MonetizationOnboarding — one authoritative Pro button on the
                  Profile tab, never a second one competing with it here. */}
              <div className="ig-auth__actions">
                <button className="ig-btn" onClick={() => void logout()}>
                  <i className="fa-solid fa-right-from-bracket" aria-hidden="true" />
                  Log Out
                </button>
              </div>
            </motion.div>
          ) : browserPrompt ? (
            <motion.div
              key="waiting"
              className="ig-auth__stage"
              variants={STAGE}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="ig-glass-card ig-auth-card">
                <h3 className="ig-section-label ig-auth__label">
                  Finish signing in
                </h3>
                <p
                  className={
                    browserPrompt.browserOpenFailed
                      ? "ig-auth-card__lede ig-auth-card__lede--error"
                      : "ig-auth-card__lede"
                  }
                >
                  {browserPrompt.browserOpenFailed
                    ? "We couldn't open your browser. Open this link manually to approve:"
                    : "A browser window opened. Approve there and you'll land back here — nothing to type."}
                </p>
                {/* Copyable URL — the manual fallback path. Read-only input so
                    the user can select/copy it (plain text isn't selectable
                    reliably), paired with a Copy button using the OS clipboard. */}
                <div className="ig-auth__copyrow">
                  <input
                    className="ig-input"
                    readOnly
                    value={browserPrompt.authorizeUrl}
                    aria-label="Sign-in link"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button className="ig-btn" onClick={() => void copyLink()}>
                    <i className="fa-solid fa-copy" aria-hidden="true" />
                    Copy
                  </button>
                </div>
                <div className="ig-auth__wait" role="status">
                  <span className="ig-working__dot" aria-hidden="true" />
                  Waiting for approval…
                </div>
              </div>
              <button className="ig-btn" onClick={cancelSignIn}>
                Cancel
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="signin"
              className="ig-auth__stage"
              variants={STAGE}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <div className="ig-glass-card ig-auth-card">
                <p className="ig-auth-card__lede">
                  Sign in securely in your browser — with Google, your
                  organization&apos;s SSO, or a one-time email code. No
                  password needed.
                </p>
                <AnimatePresence initial={false}>
                  {error && (
                    <motion.div
                      key="error"
                      className="ig-auth__error"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
                <button
                  className="ig-btn ig-btn--primary ig-auth__cta"
                  disabled={isLoading}
                  onClick={() => void signInWithBrowser()}
                >
                  {isLoading ? "Starting…" : "Sign in with browser"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
