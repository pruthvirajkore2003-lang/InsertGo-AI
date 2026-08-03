import React from "react";
import { Easing, interpolate, useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Scene, clamp } from "../ui";

const APPS = [
  "Chrome", "VS Code", "Word", "Slack",
  "Notion", "Outlook", "Teams", "Discord",
  "Google Docs", "IntelliJ", "Firefox", "Excel",
];

// grid geometry
const COLS = 4;
const CHIP_W = 220;
const CHIP_H = 64;
const GAP = 18;
const X0 = (1280 - (COLS * CHIP_W + (COLS - 1) * GAP)) / 2;
const Y0 = 118;

const center = (i: number) => ({
  x: X0 + (i % COLS) * (CHIP_W + GAP) + CHIP_W / 2,
  y: Y0 + Math.floor(i / COLS) * (CHIP_H + GAP) + CHIP_H / 2,
});

// the InsertGo badge hops across apps
const VISITS = [0, 5, 10, 7, 2, 9];
const HOP_START = 36;
const HOP_EVERY = 17;
const HOP_LEN = 12;

const arrival = (j: number) => (j === 0 ? HOP_START : HOP_START + j * HOP_EVERY + HOP_LEN);

export const UniversalCompat: React.FC = () => {
  const frame = useCurrentFrame();

  // badge position along the visit path
  const k = Math.min(
    Math.max(Math.floor((frame - HOP_START) / HOP_EVERY), 0),
    VISITS.length - 2
  );
  const t = clamp(
    frame,
    [HOP_START + k * HOP_EVERY, HOP_START + k * HOP_EVERY + HOP_LEN],
    [0, 1],
    Easing.inOut(Easing.cubic)
  );
  const from = center(VISITS[k]);
  const to = center(VISITS[k + 1]);
  const bx = interpolate(t, [0, 1], [from.x, to.x]);
  const by = interpolate(t, [0, 1], [from.y, to.y]) - Math.sin(t * Math.PI) * 34;
  const badgeIn = clamp(frame, [HOP_START - 10, HOP_START], [0, 1]);

  return (
    <Scene>
      {APPS.map((name, i) => {
        const inAt = 6 + i * 2.5;
        const o = clamp(frame, [inAt, inAt + 12], [0, 1]);
        const y = clamp(frame, [inAt, inAt + 12], [14, 0]);
        const j = VISITS.indexOf(i);
        const visited = j >= 0 && frame >= arrival(j);
        const c = center(i);
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: c.x - CHIP_W / 2,
              top: c.y - CHIP_H / 2 + y,
              width: CHIP_W,
              height: CHIP_H,
              opacity: o,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 18px",
              borderRadius: T.radiusCard,
              background: T.card,
              border: `1px solid ${visited ? T.accent : T.line}`,
              boxShadow: visited ? `0 0 20px ${T.accentTint}` : "0 1px 3px rgba(0,0,0,0.18)",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: visited ? T.accent : T.surface,
                border: `1px solid ${T.line}`,
              }}
            />
            <span style={{ fontSize: 16, fontWeight: 500, color: T.ink }}>{name}</span>
            {visited ? (
              <span style={{ marginLeft: "auto", color: T.success, fontSize: 15, fontWeight: 700 }}>
                ✓
              </span>
            ) : null}
          </div>
        );
      })}

      {/* hopping InsertGo badge */}
      <div
        style={{
          position: "absolute",
          left: bx - 19,
          top: by - 19 - 44,
          width: 38,
          height: 38,
          borderRadius: 11,
          background: T.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 28px ${T.accentGlow}, ${T.shadowCardMd}`,
          opacity: badgeIn,
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z" fill={T.ink} />
        </svg>
      </div>

      <div
        style={{
          position: "absolute",
          right: 64,
          bottom: 56,
          fontSize: 15,
          color: T.muted,
          opacity: clamp(frame, [120, 136], [0, 1]),
        }}
      >
        If it can paste, it works.
      </div>

      <Caption kicker="Why InsertGo" title="Universally compatible" />
    </Scene>
  );
};
