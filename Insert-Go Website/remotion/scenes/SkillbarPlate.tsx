import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Palette, clamp, typed, usePop } from "../ui";
import { PlateScene } from "../Plate";

/**
 * Scene 3 — The Skillbar Dock. Plate: skillbar-wall, held left so the plate's
 * six-tile wall sits under the dock. The plate cascades its tiles top-to-bottom
 * then fires a violet beam rightward; the dock lights in the same order and the
 * result panel arrives on the beam, so plate and UI are one gesture.
 */

const DOCK = 12; // first tile lights
const STEP = 7; // frames between tiles
const FIRE = 96; // third skill runs
const SKILLS = ["Refine", "Summarize", "Fix grammar", "Translate", "Explain", "Shorten"];
const RUN = 2; // index that fires (matches the plate's third tile)

export const SkillbarPlate: React.FC = () => {
  const frame = useCurrentFrame();
  const panel = usePop(FIRE + 6);

  return (
    <PlateScene
      plate={{ id: "skillbar-wall", startAt: 2, scrim: 0.62 }}
    >
      {/* the dock */}
      <div
        style={{
          position: "absolute",
          left: 96,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 10,
          borderRadius: T.radiusGlass,
          background: T.dark,
          border: `1px solid ${T.line}`,
          boxShadow: T.shadowOverlay,
        }}
      >
        {SKILLS.map((s, i) => {
          const lit = clamp(frame, [DOCK + i * STEP, DOCK + i * STEP + 8], [0, 1]);
          const running = i === RUN ? clamp(frame, [FIRE, FIRE + 8], [0, 1]) : 0;
          return (
            <span
              key={s}
              style={{
                fontSize: 14,
                fontWeight: 500,
                width: 168,
                padding: "10px 14px",
                borderRadius: T.radiusCard,
                color: running > 0.5 ? T.ink : T.muted,
                background: running > 0.5 ? T.accent : T.dark2,
                border: `1px solid ${running > 0.5 ? T.accent : T.lineSubtle}`,
                boxShadow: running > 0.5 ? `0 0 22px ${T.accentGlow}` : "none",
                opacity: 0.25 + lit * 0.75,
                transform: `translateX(${(1 - lit) * -12}px)`,
              }}
            >
              {s}
            </span>
          );
        })}
      </div>

      {/* result rides in from the dock side, where the plate's beam points */}
      <div
        style={{
          position: "absolute",
          right: 88,
          top: "50%",
          transform: `translateY(-50%) scale(${0.94 + panel * 0.06}) translateX(${(1 - panel) * -28}px)`,
          opacity: frame < FIRE + 6 ? 0 : panel,
        }}
      >
        <Palette
          width={540}
          typedText={typed(
            "Three sentences, same meaning, half the length.",
            frame,
            FIRE + 16,
          )}
          caret
          footerLeft={`${SKILLS[RUN]} · gpt-class provider`}
          footerRight="Enter ↵ to insert"
          glow={0.45}
        />
      </div>

      <Caption kicker="Skillbar" title="Every skill one keystroke away" />
    </PlateScene>
  );
};
