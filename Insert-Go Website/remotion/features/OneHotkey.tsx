import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { T } from "../tokens";
import { AppWindow, Caption, DocLines, Keycap, Palette, Scene, clamp, usePop } from "../ui";
import { HOTKEYS } from "../../lib/constants/hotkeys";

const APPS = [
  "quarterly-update.docx — Microsoft Word",
  "main.tsx — Visual Studio Code",
  "Inbox — Outlook",
];

const PRESS = 32; // frame the hotkey lands
const OPEN = 38; // palette springs in

export const OneHotkey: React.FC = () => {
  const frame = useCurrentFrame();

  const windowIn = clamp(frame, [0, 16], [0, 1]);
  const pressed = clamp(frame, [PRESS - 4, PRESS], [0, 1]);
  const keysOpacity =
    clamp(frame, [12, 20], [0, 1]) * clamp(frame, [OPEN + 10, OPEN + 24], [1, 0]);
  const flash = clamp(frame, [PRESS, PRESS + 10], [0.5, 0]);
  const pop = usePop(OPEN);

  // cycle host app title to sell "everywhere"
  const appIdx = frame < 80 ? 0 : frame < 118 ? 1 : 2;
  const swapFade = Math.min(
    clamp(frame, [76, 84], [1, 0]) + clamp(frame, [80, 88], [0, 1]),
    clamp(frame, [114, 122], [1, 0]) + clamp(frame, [118, 126], [0, 1])
  );

  return (
    <Scene>
      <AbsoluteFill style={{ background: T.accentTint, opacity: flash }} />

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 64,
          transform: `translateX(-50%) scale(${0.96 + windowIn * 0.04})`,
          opacity: windowIn * swapFade,
        }}
      >
        <AppWindow title={APPS[appIdx]}>
          <DocLines widths={[42, 92, 86, 94, 60, 88]} />
        </AppWindow>
      </div>

      {/* hotkey keycaps */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 300,
          transform: "translateX(-50%)",
          display: "flex",
          gap: 12,
          opacity: keysOpacity,
        }}
      >
        {HOTKEYS.primary.keys.map((k) => (
          <Keycap key={k} label={k} pressed={pressed} size={1.4} />
        ))}
      </div>

      {/* palette pops over everything */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 218,
          transform: `translateX(-50%) scale(${0.9 + pop * 0.1}) translateY(${(1 - pop) * 24}px)`,
          opacity: frame < OPEN ? 0 : pop,
        }}
      >
        <Palette
          typedText="Rewrite this email to sound more confident"
          caret
          chips={["Rewrite politely", "Summarize", "Fix grammar", "Translate"]}
          footerLeft={`Response inserts into ${APPS[appIdx].split("— ")[1]}`}
        />
      </div>

      <Caption kicker="Why InsertGo" title="One hotkey, everywhere" />
    </Scene>
  );
};
