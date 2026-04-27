import React from "react";
import { Composition } from "remotion";
import {
  AgentlightsDemo,
  FPS,
  DURATION_FRAMES,
  WIDTH,
  HEIGHT,
} from "./AgentlightsDemo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="AgentlightsDemo"
      component={AgentlightsDemo}
      durationInFrames={DURATION_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
