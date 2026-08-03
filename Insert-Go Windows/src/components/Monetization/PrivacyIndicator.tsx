/**
 * Data-routing transparency micro-component (Monetization & Trust layer).
 * Draws the literal network path of a prompt so the user can SEE where it
 * goes instead of trusting copy:
 *
 *   [This device] ──●──→ [InsertGo relay] ──●──→ [Provider]
 *
 * The diagram IS the copy: the relay node states InsertGo's place in the path,
 * so the plan card doesn't repeat it in prose. `aria-label` is the ONLY text
 * form of the route — keep it complete when editing.
 */
import { motion, useReducedMotion } from "framer-motion";

/** One packet-dot sweep along a track segment. `delay` phases the managed
 *  mode's second segment so the dot appears to hand off at the relay. */
function Dot({ duration, delay = 0 }: { duration: number; delay?: number }) {
  return (
    <motion.span
      className="ig-route__dot"
      initial={{ left: "0%", opacity: 0 }}
      animate={{ left: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
      transition={{
        duration,
        delay,
        times: [0, 0.2, 0.8, 1],
        ease: "linear",
        repeat: Infinity,
        repeatDelay: 1.35,
      }}
    />
  );
}

export function PrivacyIndicator({
  providerLabel = "AI provider",
}: {
  providerLabel?: string;
}) {
  // Static diagram under reduced motion — the route stays fully legible
  // from the nodes alone.
  const reduce = useReducedMotion();

  return (
    <div
      className="ig-route__map"
      role="img"
      aria-label={`Data route: prompts go from this device through the InsertGo relay to ${providerLabel}.`}
    >
      <span className="ig-route__node">
        <i className="fa-solid fa-desktop" aria-hidden="true" />
        This device
      </span>
      <span className="ig-route__track" aria-hidden="true">
        {!reduce && <Dot duration={1.2} />}
      </span>
      <span className="ig-route__node ig-route__node--hub">
        <i className="fa-solid fa-cloud" aria-hidden="true" />
        InsertGo relay
      </span>
      <span className="ig-route__track" aria-hidden="true">
        {!reduce && <Dot duration={1.2} delay={1.2} />}
      </span>
      <span className="ig-route__node">
        <i className="fa-solid fa-microchip" aria-hidden="true" />
        {providerLabel}
      </span>
    </div>
  );
}
