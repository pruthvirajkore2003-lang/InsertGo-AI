import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Palette, clamp, typed, usePop } from "../ui";
import { PlateScene } from "../Plate";

/**
 * Scene 4 — Floating App Widget. Plate: bubble-sphere.
 *
 * The plate's halo blooms out of the sphere about 4s in; startAt 2 puts that
 * bloom at scene frame 60, which is exactly when the widget expands. The bubble
 * sits over the sphere, so the sphere IS the widget's glass.
 */

const BLOOM = 60; // plate's halo bloom, and the widget's expand
const BUBBLE = 10;

export const WidgetPlate: React.FC = () => {
  const frame = useCurrentFrame();
  const bubble = usePop(BUBBLE);
  const open = usePop(BLOOM);
  const collapsed = clamp(frame, [BLOOM, BLOOM + 12], [1, 0]);

  return (
    <PlateScene
      plate={{ id: "bubble-sphere", startAt: 2, scrim: 0.52 }}
    >
      {/* The always-on floating bubble, parked on the plate's sphere. The sphere
          spans roughly x 173-413 of 1280 through this window, so the widget
          centres on 293 and the panel clears 413. */}
      <div
        style={{
          position: "absolute",
          left: 255,
          top: "50%",
          width: 76,
          height: 76,
          marginTop: -38,
          borderRadius: 999,
          background: `radial-gradient(circle at 34% 28%, rgba(245,245,247,0.22), ${T.dark} 62%)`,
          border: `1px solid ${T.line}`,
          boxShadow: `0 0 ${26 + collapsed * 18}px ${T.accentGlow}, ${T.shadowOverlay}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: bubble,
          transform: `scale(${(0.7 + bubble * 0.3) * (1 - (1 - collapsed) * 0.25)})`,
        }}
      >
        <span
          style={{
            fontFamily: T.fontSerif,
            fontSize: 26,
            fontWeight: 600,
            color: T.accent,
          }}
        >
          I
        </span>
      </div>

      {/* panel unfolds toward the empty right side the plate leaves open */}
      <div
        style={{
          position: "absolute",
          left: 440,
          top: "50%",
          transform: `translateY(-50%) scale(${0.9 + open * 0.1}) translateX(${(1 - open) * -34}px)`,
          transformOrigin: "left center",
          opacity: frame < BLOOM ? 0 : open,
        }}
      >
        <Palette
          width={560}
          typedText={typed("Draft a reply that buys us two more days", frame, BLOOM + 20)}
          caret
          chips={["Rewrite politely", "Summarize", "Fix grammar"]}
          footerLeft="Always on top · click-through when idle"
          footerRight="Esc to dismiss"
          glow={0.4}
        />
      </div>

      <Caption kicker="Floating widget" title="Above every window, out of the way" />
    </PlateScene>
  );
};
