import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Palette, Scene, clamp, usePop } from "../ui";

const CHIPS = ["Rewrite politely", "Summarize", "Fix grammar", "Translate"];
const SELECT = 62; // frame the "Summarize" chip is clicked

export const PromptTemplates: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop(4);

  // highlight ring walks Rewrite → Summarize, then click
  const activeChip = frame < 30 ? -1 : frame < 48 ? 0 : frame < SELECT ? 1 : -1;
  const selectedChip = frame >= SELECT ? 1 : -1;

  const respProgress = clamp(frame, [SELECT + 12, SELECT + 46], [0, 1]);
  const glow = 0.35 + clamp(frame, [SELECT, SELECT + 8], [0, 0.4]);

  return (
    <Scene>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 140,
          transform: `translateX(-50%) scale(${0.92 + pop * 0.08})`,
          opacity: pop,
        }}
      >
        <Palette
          width={600}
          typedText={selectedChip >= 0 ? "Summarize the selected paragraph" : ""}
          caret={selectedChip < 0}
          chips={CHIPS}
          activeChip={activeChip}
          selectedChip={selectedChip}
          glow={glow}
          footerRight={respProgress >= 1 ? "Enter ↵ to insert" : "Templates run on your selection"}
        >
          {/* response draws in after the template runs */}
          {frame > SELECT + 8 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 16px 16px" }}>
              {[88, 72, 40].map((w, i) => {
                const p = clamp(respProgress, [i * 0.28, i * 0.28 + 0.44], [0, 1]);
                return (
                  <span
                    key={i}
                    style={{
                      height: 9,
                      width: `${w * p}%`,
                      borderRadius: 5,
                      background: T.accentSoft,
                      border: p > 0 ? `1px solid ${T.accent}` : "none",
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </Palette>
      </div>

      <Caption kicker="Why InsertGo" title="Prompt templates" />
    </Scene>
  );
};
