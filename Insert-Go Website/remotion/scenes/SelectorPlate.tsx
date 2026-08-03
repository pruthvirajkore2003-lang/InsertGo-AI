import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { AppWindow, Caption, DocLines, clamp, usePop } from "../ui";
import { PlateScene } from "../Plate";

/**
 * Scene 2 — The Selector. Plate: selector-glass, centre-cropped per the queue
 * file's crop note. The plate's cyan scanner pass runs under the moment the
 * selection lands, so the sweep reads as the selection being recognised.
 */

const SELECT = 26; // selection highlight appears
const BAR = 40; // action bar springs above it
const PICK = 88; // "Summarize" is chosen

const SKILLS = ["Refine", "Summarize", "Translate", "Explain"];

export const SelectorPlate: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = clamp(frame, [0, 16], [0, 1]);
  const bar = usePop(BAR);
  const picked = frame >= PICK;

  return (
    <PlateScene
      plate={{ id: "selector-glass", startAt: 0.5, scrim: 0.58, zoom: 1.12 }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 152,
          transform: `translateX(-50%) translateY(${(1 - enter) * 14}px)`,
          opacity: enter,
        }}
      >
        <AppWindow title="release-notes.md — Visual Studio Code" width={700}>
          <DocLines
            widths={[40, 90, 84, 92, 58]}
            insertFrom={2}
            insertProgress={clamp(frame, [SELECT, SELECT + 10], [0, 1])}
          />
        </AppWindow>
      </div>

      {/* selection action bar — the contextual surface, not the palette */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 252,
          transform: `translateX(-50%) scale(${0.9 + bar * 0.1}) translateY(${(1 - bar) * 12}px)`,
          opacity: frame < BAR ? 0 : bar,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 6,
          borderRadius: 999,
          background: T.dark,
          border: `1px solid ${T.line}`,
          boxShadow: T.shadowOverlay,
        }}
      >
        {SKILLS.map((s, i) => {
          const active = picked && i === 1;
          return (
            <span
              key={s}
              style={{
                fontSize: 13,
                fontWeight: 500,
                padding: "7px 13px",
                borderRadius: 999,
                whiteSpace: "nowrap",
                color: active ? T.ink : T.muted,
                background: active ? T.accent : "transparent",
                border: `1px solid ${active ? T.accent : "transparent"}`,
                boxShadow: active ? `0 0 18px ${T.accentGlow}` : "none",
                transform: `scale(${active ? 1.06 : 1})`,
              }}
            >
              {s}
            </span>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          right: 64,
          bottom: 56,
          fontSize: 15,
          color: T.muted,
          opacity: clamp(frame, [PICK + 14, PICK + 30], [0, 1]),
        }}
      >
        Reviewed before it replaces your selection — never auto-applied
      </div>

      <Caption kicker="Selection actions" title="Act on the text in front of you" />
    </PlateScene>
  );
};
