import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Keycap, clamp } from "../ui";
import { PlateScene } from "../Plate";
import { HOTKEYS } from "../../lib/constants/hotkeys";

/**
 * Scene 5 — Inline In-Place Improve. Plate: inline-slab (16:9 native).
 *
 * The plate strikes the slab with two cyan pulses like keystrokes registering,
 * then its foreground capsule runs cyan and flashes green. The UI honours that
 * beat exactly: hotkey lands on the pulses, the field rewrites itself, and the
 * done state flashes green with the capsule. No palette in this scene — the
 * whole point of Inline Improve is that nothing opens.
 */

const PRESS = 44;
const WIPE = [PRESS + 6, PRESS + 44] as const;

const DRAFT = "hey so i think we should maybe push the deadline if thats ok";
const IMPROVED = "I'd like to propose moving the deadline — does that work for you?";

export const InlinePlate: React.FC = () => {
  const frame = useCurrentFrame();
  const enter = clamp(frame, [0, 14], [0, 1]);
  const pressed = clamp(frame, [PRESS - 4, PRESS], [0, 1]);
  const wipe = clamp(frame, [WIPE[0], WIPE[1]], [0, 1]);
  const done = clamp(frame, [WIPE[1], WIPE[1] + 14], [0, 1]);

  return (
    <PlateScene plate={{ id: "inline-slab", startAt: 1.5, scrim: 0.56 }}>
      {/* the focused field, in place — this is the only surface in the scene */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 246,
          width: 780,
          marginLeft: -390,
          padding: "22px 26px",
          borderRadius: T.radiusGlass,
          background: T.dark,
          border: `1px solid ${wipe > 0 && wipe < 1 ? T.accent : T.line}`,
          boxShadow:
            wipe > 0 && wipe < 1
              ? `0 0 26px ${T.accentGlow}, ${T.shadowOverlay}`
              : T.shadowOverlay,
          opacity: enter,
          transform: `translateY(${(1 - enter) * 14}px)`,
        }}
      >
        <div style={{ fontSize: 12, color: T.faint, marginBottom: 12 }}>
          Reply to Priya · Outlook
        </div>

        {/* both drafts stacked, the improved one revealed by a left-to-right
            clip — the text is replaced in place, never retyped */}
        <div style={{ position: "relative", fontSize: 19, lineHeight: 1.5 }}>
          <span style={{ color: T.muted, opacity: 1 - wipe }}>{DRAFT}</span>
          <span
            style={{
              position: "absolute",
              inset: 0,
              color: T.ink,
              clipPath: `inset(0 ${100 - wipe * 100}% 0 0)`,
            }}
          >
            {IMPROVED}
          </span>
          {wipe > 0 && wipe < 1 ? (
            <span
              style={{
                position: "absolute",
                top: -4,
                bottom: -4,
                left: `${wipe * 100}%`,
                width: 2,
                background: T.accent,
                boxShadow: `0 0 14px ${T.accentGlow}`,
              }}
            />
          ) : null}
        </div>
      </div>

      {/* the hotkey, and nothing else, does the work */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 400,
          transform: "translateX(-50%)",
          display: "flex",
          gap: 10,
          opacity: enter * clamp(frame, [WIPE[1], WIPE[1] + 16], [1, 0]),
        }}
      >
        {HOTKEYS.improve.keys.map((k) => (
          <Keycap key={k} label={k} pressed={pressed} size={1.2} />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 400,
          transform: "translateX(-50%)",
          fontSize: 15,
          whiteSpace: "nowrap",
          opacity: done,
        }}
      >
        <span style={{ color: T.success, fontWeight: 600 }}>✓</span> Improved in place ·{" "}
        <span style={{ color: T.muted }}>{HOTKEYS.undo.label} restores the draft</span>
      </div>

      <Caption kicker={HOTKEYS.improve.name} title="Rewrites the field you're in" />
    </PlateScene>
  );
};
