import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { T } from "./tokens";
import { HOTKEYS } from "../lib/constants/hotkeys";

/* ---------- helpers ---------- */

export const clamp = (
  frame: number,
  range: [number, number],
  out: [number, number],
  easing: (t: number) => number = Easing.inOut(Easing.cubic)
) =>
  interpolate(frame, range, out, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });

/** Characters typed so far, ~`cps` chars per frame after `start`. */
export const typed = (text: string, frame: number, start: number, cps = 0.9) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

export const usePop = (start: number, durationInFrames = 24) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({
    frame: frame - start,
    fps,
    durationInFrames,
    config: { damping: 14, stiffness: 160, mass: 0.7 },
  });
};

/* ---------- scene shell ---------- */

export const Scene: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ background: T.bg, fontFamily: T.fontSans, color: T.ink }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(600px 380px at 50% 18%, ${T.surface}, transparent 70%)`,
      }}
    />
    {children}
  </AbsoluteFill>
);

/** Bottom-left kicker + serif title, fading up at `enter`. */
export const Caption: React.FC<{ kicker: string; title: string; enter?: number }> = ({
  kicker,
  title,
  enter = 8,
}) => {
  const frame = useCurrentFrame();
  const o = clamp(frame, [enter, enter + 18], [0, 1]);
  const y = clamp(frame, [enter, enter + 18], [16, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        bottom: 48,
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: T.brand,
          marginBottom: 10,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: T.fontSerif,
          fontSize: 40,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          color: T.ink,
        }}
      >
        {title}
      </div>
    </div>
  );
};

/* ---------- app window (host application mock) ---------- */

export const AppWindow: React.FC<{
  title: string;
  width?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ title, width = 760, style, children }) => (
  <div
    style={{
      width,
      borderRadius: T.radiusGlass,
      border: `1px solid ${T.line}`,
      background: T.card,
      boxShadow: T.shadowCardMd,
      overflow: "hidden",
      ...style,
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 16px",
        borderBottom: `1px solid ${T.line}`,
        background: T.surface,
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{ width: 10, height: 10, borderRadius: 999, background: T.line }}
        />
      ))}
      <span style={{ marginLeft: 10, fontSize: 13, color: T.muted }}>{title}</span>
    </div>
    {children}
  </div>
);

/** Grey skeleton paragraph lines; `insert` lines render in accent wash. */
export const DocLines: React.FC<{
  widths: number[];
  insertFrom?: number; // index where inserted (accent) lines start
  insertProgress?: number; // 0..1 grow-in of inserted lines
  caret?: boolean;
}> = ({ widths, insertFrom = Infinity, insertProgress = 1, caret }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "28px 40px 36px",
      }}
    >
      {widths.map((w, i) => {
        const inserted = i >= insertFrom;
        const pct = inserted ? w * insertProgress : w;
        if (inserted && insertProgress === 0) return <span key={i} style={{ height: 9 }} />;
        return (
          <span
            key={i}
            style={{
              height: i === 0 ? 12 : 9,
              width: `${pct}%`,
              borderRadius: 5,
              background: inserted
                ? T.accentSoft
                : i === 0
                  ? "rgba(245,245,247,0.30)"
                  : "rgba(245,245,247,0.15)",
              border: inserted ? `1px solid ${T.accent}` : "none",
            }}
          />
        );
      })}
      {caret ? (
        <span
          style={{
            width: 2,
            height: 16,
            background: T.accent,
            opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0,
          }}
        />
      ) : null}
    </div>
  );
};

/* ---------- keycap ---------- */

export const Keycap: React.FC<{
  label: string;
  pressed?: number; // 0..1
  size?: number;
}> = ({ label, pressed = 0, size = 1 }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      padding: `${8 * size}px ${16 * size}px`,
      fontSize: 18 * size,
      fontWeight: 600,
      color: T.ink,
      background: T.dark2,
      border: `1px solid ${T.line}`,
      borderBottomWidth: pressed > 0.5 ? 1 : 3,
      borderRadius: T.radiusBtn,
      transform: `translateY(${pressed * 3}px)`,
      boxShadow:
        pressed > 0.5
          ? `0 0 24px ${T.accentGlow}`
          : "0 1px 3px rgba(0,0,0,0.18)",
    }}
  >
    {label}
  </span>
);

/* ---------- InsertGo palette (the floating overlay) ---------- */

const Star: React.FC<{ size?: number; color?: string }> = ({
  size = 16,
  color = T.accent,
}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z"
      fill={color}
    />
  </svg>
);

export const Palette: React.FC<{
  width?: number;
  typedText?: string;
  caret?: boolean;
  chips?: string[];
  activeChip?: number; // ring highlight
  selectedChip?: number; // filled indigo
  footerLeft?: string;
  footerRight?: string;
  glow?: number; // 0..1 accent glow strength
  inputSlot?: React.ReactNode; // replaces the typed-text row content
  children?: React.ReactNode; // extra body below input
  style?: React.CSSProperties;
}> = ({
  width = 560,
  typedText,
  caret,
  chips,
  activeChip = -1,
  selectedChip = -1,
  footerLeft = "Response inserts into your app",
  footerRight = "Enter ↵ to insert",
  glow = 0.35,
  inputSlot,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width,
        borderRadius: T.radiusPanel,
        border: `1px solid ${T.line}`,
        background: T.dark,
        boxShadow: `0 0 ${32 + glow * 40}px rgba(127,166,196,${0.18 + glow * 0.25}), ${T.shadowOverlay}`,
        overflow: "hidden",
        textAlign: "left",
        ...style,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: `1px solid ${T.dark2}`,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 20,
              height: 20,
              borderRadius: 6,
              background: T.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Star size={12} color={T.ink} />
          </span>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>InsertGo</span>
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: T.muted,
            background: T.dark2,
            border: `1px solid ${T.line}`,
            borderRadius: 5,
            padding: "3px 8px",
          }}
        >
          {HOTKEYS.primary.label}
        </span>
      </div>

      {/* input row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 16, minHeight: 56 }}>
        {inputSlot ?? (
          <>
            <Star />
            <span style={{ fontSize: 16, color: T.ink, minHeight: 22 }}>
              {typedText}
              {caret ? (
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 17,
                    marginLeft: 2,
                    verticalAlign: -2,
                    background: T.accent,
                    opacity: Math.floor(frame / 15) % 2 === 0 ? 1 : 0,
                  }}
                />
              ) : null}
            </span>
          </>
        )}
      </div>

      {children}

      {/* chips */}
      {chips ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "0 16px 14px" }}>
          {chips.map((c, i) => {
            const active = i === activeChip;
            const selected = i === selectedChip;
            return (
              <span
                key={c}
                style={{
                  fontSize: 13,
                  padding: "6px 12px",
                  borderRadius: 999,
                  color: selected ? T.ink : T.muted,
                  background: selected ? T.accent : T.dark2,
                  border: `1px solid ${active || selected ? T.accent : T.line}`,
                  boxShadow: active ? `0 0 16px ${T.accentGlow}` : "none",
                  transform: selected ? "scale(1.06)" : "scale(1)",
                }}
              >
                {c}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderTop: `1px solid ${T.dark2}`,
        }}
      >
        <span style={{ fontSize: 11, color: T.muted }}>{footerLeft}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.accent }}>{footerRight}</span>
      </div>
    </div>
  );
};
