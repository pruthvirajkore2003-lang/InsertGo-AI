import React from "react";
import { useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { Caption, Palette, Scene, clamp, typed, usePop } from "../ui";

const PROMPT = "Translate this reply into French";
const LISTEN_START = 24;
const LISTEN_END = 112;
const BARS = 26;

const Mic: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = T.ink }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);

export const VoiceInput: React.FC = () => {
  const frame = useCurrentFrame();
  const pop = usePop(4);

  const listening = clamp(frame, [LISTEN_START, LISTEN_START + 8], [0, 1]) *
    clamp(frame, [LISTEN_END, LISTEN_END + 10], [1, 0]);
  const ringPhase = ((frame - LISTEN_START) % 36) / 36;
  const transcript = typed(PROMPT, frame, 44, 0.55);

  return (
    <Scene>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 150,
          transform: `translateX(-50%) scale(${0.92 + pop * 0.08})`,
          opacity: pop,
        }}
      >
        <Palette
          width={600}
          glow={0.35 + listening * 0.35}
          footerLeft="Voice input"
          footerRight={transcript.length >= PROMPT.length ? "Enter ↵ to run" : "Listening…"}
          inputSlot={
            <>
              {/* mic with pulse rings */}
              <span style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
                {listening > 0
                  ? [0, 0.5].map((offset) => {
                      const p = (ringPhase + offset) % 1;
                      return (
                        <span
                          key={offset}
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderRadius: 999,
                            border: `1.5px solid ${T.accent}`,
                            transform: `scale(${1 + p * 0.9})`,
                            opacity: (1 - p) * 0.6 * listening,
                          }}
                        />
                      );
                    })
                  : null}
                <span
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 999,
                    background: listening > 0.5 ? T.accent : T.dark2,
                    border: `1px solid ${listening > 0.5 ? T.accent : T.line}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Mic />
                </span>
              </span>

              {/* live waveform */}
              <span style={{ display: "flex", alignItems: "center", gap: 3, height: 40, flexShrink: 0 }}>
                {Array.from({ length: BARS }).map((_, i) => {
                  const h =
                    4 +
                    listening *
                      (10 +
                        10 * Math.abs(Math.sin(frame * 0.45 + i * 0.9)) +
                        6 * Math.abs(Math.sin(frame * 0.21 + i * 1.7)));
                  return (
                    <span
                      key={i}
                      style={{
                        width: 3,
                        height: h,
                        borderRadius: 2,
                        background: listening > 0 ? T.accent : T.line,
                        opacity: 0.5 + 0.5 * Math.abs(Math.sin(i * 0.7 + frame * 0.1)),
                      }}
                    />
                  );
                })}
              </span>
            </>
          }
        >
          {/* transcription lands below the waveform */}
          <div style={{ padding: "0 16px 16px", minHeight: 30 }}>
            <span style={{ fontSize: 16, color: transcript.length >= PROMPT.length ? T.ink : T.muted }}>
              {transcript}
              {transcript.length > 0 && transcript.length < PROMPT.length ? (
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
          </div>
        </Palette>
      </div>

      <Caption kicker="Why InsertGo" title="Voice input" />
    </Scene>
  );
};
