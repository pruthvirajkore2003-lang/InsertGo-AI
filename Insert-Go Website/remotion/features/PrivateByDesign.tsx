import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Scene, clamp } from "../ui";

const NODE_Y = 268;

const Node: React.FC<{ x: number; label: string; sub: string; enter: number }> = ({
  x,
  label,
  sub,
  enter,
}) => {
  const frame = useCurrentFrame();
  const o = clamp(frame, [enter, enter + 14], [0, 1]);
  return (
    <div
      style={{
        position: "absolute",
        left: x - 110,
        top: NODE_Y - 44,
        width: 220,
        borderRadius: T.radiusCard,
        border: `1px solid ${T.line}`,
        background: T.card,
        boxShadow: T.shadowCardMd,
        padding: "16px 18px",
        opacity: o,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>{label}</div>
      <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>{sub}</div>
    </div>
  );
};

export const PrivateByDesign: React.FC = () => {
  const frame = useCurrentFrame();

  const shieldDraw = clamp(frame, [8, 46], [0, 1]);
  const tickDraw = clamp(frame, [48, 64], [0, 1]);
  const lineDraw = clamp(frame, [66, 84], [0, 1]);
  const glow = 0.2 + 0.15 * Math.sin(frame * 0.08);

  // two packets travel straight from you to your provider
  const packets = [clamp(frame, [84, 112], [0, 1]), clamp(frame, [100, 128], [0, 1])];

  const PILLS = ["Not stored", "Not logged", "Never trained on"];

  return (
    <Scene>
      <Node x={210} label="Your prompt" sub="This machine" enter={4} />
      <Node x={1070} label="Your AI provider" sub="Direct connection" enter={4} />

      {/* direct line, drawn left to right */}
      <div
        style={{
          position: "absolute",
          left: 320,
          top: NODE_Y - 1,
          width: 640 * lineDraw,
          height: 2,
          background: `linear-gradient(90deg, ${T.accentSoft}, ${T.accent})`,
        }}
      />

      {/* packets */}
      {packets.map((p, i) =>
        p > 0 && p < 1 ? (
          <span
            key={i}
            style={{
              position: "absolute",
              left: 320 + 640 * p - 5,
              top: NODE_Y - 6,
              width: 10,
              height: 10,
              borderRadius: 999,
              background: T.accent,
              boxShadow: `0 0 16px ${T.accentGlow}`,
            }}
          />
        ) : null
      )}

      {/* shield over the line's midpoint */}
      <div
        style={{
          position: "absolute",
          left: 640 - 70,
          top: NODE_Y - 70,
          width: 140,
          height: 140,
          borderRadius: 999,
          background: T.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${40 + glow * 60}px rgba(47,107,255,${glow})`,
        }}
      >
        <svg width={96} height={96} viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2l8 3.5V12c0 4.8-3.4 8.6-8 10-4.6-1.4-8-5.2-8-10V5.5L12 2z"
            stroke={T.accent}
            strokeWidth={1.6}
            strokeLinejoin="round"
            fill={T.accentTint}
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - shieldDraw}
          />
          <path
            d="M8.4 12.2l2.6 2.6 4.8-5.4"
            stroke={T.ink}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={1 - tickDraw}
          />
        </svg>
      </div>

      {/* what never happens */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 420,
          display: "flex",
          justifyContent: "center",
          gap: 14,
        }}
      >
        {PILLS.map((p, i) => {
          const at = 96 + i * 12;
          const o = clamp(frame, [at, at + 12], [0, 1]);
          const y = clamp(frame, [at, at + 12], [10, 0]);
          return (
            <span
              key={p}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 16px",
                borderRadius: 999,
                border: `1px solid ${T.line}`,
                background: T.surface,
                fontSize: 14,
                fontWeight: 500,
                color: T.ink,
                opacity: o,
                transform: `translateY(${y}px)`,
              }}
            >
              <span style={{ color: T.danger, fontWeight: 700 }}>✕</span>
              {p}
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
          opacity: clamp(frame, [126, 142], [0, 1]),
        }}
      >
        Templates stay on your machine.
      </div>

      <Caption kicker="Why InsertGo" title="Private by design" />
    </Scene>
  );
};
