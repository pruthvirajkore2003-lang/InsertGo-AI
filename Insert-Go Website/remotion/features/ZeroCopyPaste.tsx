import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { AppWindow, Caption, DocLines, Keycap, Palette, Scene, clamp } from "../ui";

const ENTER = 46; // frame Enter is pressed

// canvas geometry (1280x720)
const SRC = { x: 392, y: 462 }; // palette input row
const DST = { x: 330, y: 218 }; // doc insertion point

export const ZeroCopyPaste: React.FC = () => {
  const frame = useCurrentFrame();

  const enter = clamp(frame, [0, 14], [0, 1]);
  const pressed = clamp(frame, [ENTER - 4, ENTER], [0, 1]);

  const flight = clamp(frame, [ENTER + 2, ENTER + 26], [0, 1], Easing.inOut(Easing.cubic));
  const pillX = SRC.x + (DST.x - SRC.x) * flight;
  // slight arc: lift the midpoint
  const pillY = SRC.y + (DST.y - SRC.y) * flight - Math.sin(flight * Math.PI) * 60;
  const pillVisible = frame > ENTER + 2 && flight < 1;

  const paletteOut = clamp(frame, [ENTER + 6, ENTER + 30], [0, 1]);
  const insertProgress = clamp(frame, [ENTER + 24, ENTER + 54], [0, 1]);

  return (
    <Scene>
      {/* host document */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 48,
          transform: "translateX(-50%)",
          opacity: enter,
        }}
      >
        <AppWindow title="quarterly-update.docx — Microsoft Word" width={720}>
          <DocLines
            widths={[42, 92, 86, 60, 88, 74]}
            insertFrom={4}
            insertProgress={insertProgress}
            caret={insertProgress >= 1}
          />
        </AppWindow>
      </div>

      {/* the response, mid-flight */}
      {pillVisible ? (
        <span
          style={{
            position: "absolute",
            left: pillX,
            top: pillY,
            transform: `scale(${1 - flight * 0.35})`,
            fontSize: 13,
            fontWeight: 500,
            color: T.ink,
            background: T.accent,
            borderRadius: 999,
            padding: "7px 14px",
            boxShadow: `0 0 24px ${T.accentGlow}`,
            whiteSpace: "nowrap",
          }}
        >
          Here’s a clearer version of your paragraph…
        </span>
      ) : null}

      {/* palette below, slides away after Enter */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 398,
          transform: `translateX(-50%) translateY(${(1 - enter) * 24 + paletteOut * 40}px)`,
          opacity: enter * (1 - paletteOut),
        }}
      >
        <Palette
          width={560}
          typedText="Rewrite this paragraph to be clearer"
          footerLeft="Response inserts into Microsoft Word"
          footerRight="Enter ↵ to insert"
          glow={0.35 + pressed * 0.4}
        />
      </div>

      {/* Enter keycap beside the palette */}
      <div
        style={{
          position: "absolute",
          left: 962,
          top: 470,
          opacity: enter * (1 - paletteOut),
        }}
      >
        <Keycap label="Enter ↵" pressed={pressed} size={1.2} />
      </div>

      {/* "no clipboard" note once inserted */}
      <div
        style={{
          position: "absolute",
          right: 64,
          bottom: 56,
          fontSize: 15,
          color: T.muted,
          opacity: clamp(frame, [ENTER + 44, ENTER + 60], [0, 1]),
        }}
      >
        <span style={{ color: T.success, fontWeight: 600 }}>✓</span> Inserted at your cursor —
        clipboard untouched
      </div>

      <Caption kicker="Why InsertGo" title="Zero copy-paste" />
    </Scene>
  );
};
