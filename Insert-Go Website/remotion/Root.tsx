import React from "react";
import { Composition, Folder, Series } from "remotion";
import { OneHotkey } from "./features/OneHotkey";
import { PromptTemplates } from "./features/PromptTemplates";
import { VoiceInput } from "./features/VoiceInput";
import { ZeroCopyPaste } from "./features/ZeroCopyPaste";
import { UniversalCompat } from "./features/UniversalCompat";
import { PrivateByDesign } from "./features/PrivateByDesign";
import { HeroPlate } from "./scenes/HeroPlate";
import { SelectorPlate } from "./scenes/SelectorPlate";
import { SkillbarPlate } from "./scenes/SkillbarPlate";
import { WidgetPlate } from "./scenes/WidgetPlate";
import { InlinePlate } from "./scenes/InlinePlate";

const FPS = 30;
const W = 1280;
const H = 720;
const DUR = 150; // 5s per feature

const FEATURES = [
  { id: "OneHotkey", component: OneHotkey },
  { id: "PromptTemplates", component: PromptTemplates },
  { id: "VoiceInput", component: VoiceInput },
  { id: "ZeroCopyPaste", component: ZeroCopyPaste },
  { id: "UniversallyCompatible", component: UniversalCompat },
  { id: "PrivateByDesign", component: PrivateByDesign },
] as const;

// Plate-backed scenes, in the order scripts/veo-plates.json declares them.
const SCENES = [
  { id: "S1MainHero", component: HeroPlate },
  { id: "S2Selector", component: SelectorPlate },
  { id: "S3Skillbar", component: SkillbarPlate },
  { id: "S4FloatingWidget", component: WidgetPlate },
  { id: "S5InlineImprove", component: InlinePlate },
] as const;

const reel = (
  entries: readonly { id: string; component: React.FC }[],
): React.FC => () => (
  <Series>
    {entries.map(({ id, component: C }) => (
      <Series.Sequence key={id} durationInFrames={DUR}>
        <C />
      </Series.Sequence>
    ))}
  </Series>
);

const FeatureReel = reel(FEATURES);
const PlateReel = reel(SCENES);

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Features">
      {FEATURES.map(({ id, component }) => (
        <Composition
          key={id}
          id={id}
          component={component}
          durationInFrames={DUR}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </Folder>
    <Folder name="Plates">
      {SCENES.map(({ id, component }) => (
        <Composition
          key={id}
          id={id}
          component={component}
          durationInFrames={DUR}
          fps={FPS}
          width={W}
          height={H}
        />
      ))}
    </Folder>
    <Composition
      id="FeatureReel"
      component={FeatureReel}
      durationInFrames={DUR * FEATURES.length}
      fps={FPS}
      width={W}
      height={H}
    />
    <Composition
      id="PlateReel"
      component={PlateReel}
      durationInFrames={DUR * SCENES.length}
      fps={FPS}
      width={W}
      height={H}
    />
  </>
);
