import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Palette, clamp, typed, usePop } from "../ui";
import { PlateScene } from "../Plate";

/** Scene 1 — Main Product Hero. Plate: hero-glass (16:9 native). */

const PROMPT = "Rewrite this email to sound more confident";
const TYPE_AT = 52;
const OPEN = 34;

export const HeroPlate: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop(OPEN);
  const wordmark = clamp(frame, [6, 26], [0, 1]);

  return (
    <PlateScene plate={{ id: "hero-glass", startAt: 0.5, scrim: 0.5 }}>
      {/* wordmark rides up first, then hands off to the palette */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 132,
          transform: `translateX(-50%) translateY(${(1 - wordmark) * 18}px)`,
          opacity: wordmark * clamp(frame, [OPEN + 4, OPEN + 22], [1, 0.35]),
          fontFamily: T.fontSerif,
          fontSize: 54,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          whiteSpace: "nowrap",
        }}
      >
        InsertGo<span style={{ color: T.accent }}>.AI</span>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 268,
          transform: `translateX(-50%) scale(${0.92 + pop * 0.08}) translateY(${(1 - pop) * 28}px)`,
          opacity: frame < OPEN ? 0 : pop,
        }}
      >
        <Palette
          width={620}
          typedText={typed(PROMPT, frame, TYPE_AT)}
          caret
          chips={["Rewrite politely", "Summarize", "Fix grammar", "Translate"]}
          footerLeft="Response inserts into Microsoft Word"
          glow={0.3 + clamp(frame, [TYPE_AT, TYPE_AT + 40], [0, 0.4])}
        />
      </div>

      <Caption kicker="InsertGo for Windows" title="Floating AI prompt assistant" />
    </PlateScene>
  );
};
