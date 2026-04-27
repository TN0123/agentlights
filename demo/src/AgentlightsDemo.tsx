import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadSans } from "@remotion/google-fonts/Inter";
import { Pane } from "./Pane";
import { PANES, GLOW_PANE_INDEX } from "./scripts";

export const FPS = 30;
export const WIDTH = 1600;
export const HEIGHT = 1000;
export const DURATION_FRAMES = 240; // 8.0s

const { fontFamily: MONO_FAMILY } = loadMono("normal", {
  weights: ["400", "500"],
});
const { fontFamily: SANS_FAMILY } = loadSans("normal", {
  weights: ["400", "500", "600"],
});

const WINDOW_FADE_END = 18;
const GLOW_START = 138; // ~4.6s
const GLOW_END = 160; // ~5.3s
const CAPTION_FADE_IN = 158;
const CAPTION_HOLD_END = 215;
const CAPTION_FADE_OUT_END = 230;

export const AgentlightsDemo: React.FC = () => {
  const frame = useCurrentFrame();

  // Window slide up + fade in
  const windowOpacity = interpolate(frame, [0, WINDOW_FADE_END], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const windowTranslateY = interpolate(
    frame,
    [0, WINDOW_FADE_END],
    [16, 0],
    { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );

  // Glow on pane index = GLOW_PANE_INDEX
  const glowProgress = interpolate(frame, [GLOW_START, GLOW_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  // Caption opacity
  const captionOpacity = interpolate(
    frame,
    [
      CAPTION_FADE_IN,
      CAPTION_FADE_IN + 14,
      CAPTION_HOLD_END,
      CAPTION_FADE_OUT_END,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const captionTranslateY = interpolate(
    frame,
    [CAPTION_FADE_IN, CAPTION_FADE_IN + 14],
    [8, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) },
  );

  // Outer pane glow that escapes the window slightly (sells the "lit up" feel)
  const outerGlowOpacity = interpolate(glowProgress, [0, 1], [0, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at 50% 30%, #14141f 0%, #08080d 70%)",
      }}
    >
      {/* Subtle vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* Window */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: 80,
          right: 80,
          bottom: 200,
          opacity: windowOpacity,
          transform: `translateY(${windowTranslateY}px)`,
          borderRadius: 14,
          background: "#0b0d14",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow:
            "0 50px 120px rgba(0,0,0,0.55), 0 12px 30px rgba(0,0,0,0.4)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            height: 38,
            background: "#11141d",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            alignItems: "center",
            paddingLeft: 16,
            position: "relative",
            flexShrink: 0,
          }}
        >
          <TrafficLight color="#ff5f56" />
          <TrafficLight color="#ffbd2e" />
          <TrafficLight color="#27c93f" />
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: SANS_FAMILY,
              color: "#7a7f90",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: 0.3,
              pointerEvents: "none",
            }}
          >
            claude — split view
          </div>
        </div>

        {/* Pane grid */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gridTemplateRows: "1fr 1fr",
            position: "relative",
          }}
        >
          {PANES.map((pane, idx) => {
            const isGlowPane = idx === GLOW_PANE_INDEX;
            return (
              <Pane
                key={idx}
                {...pane}
                glowProgress={isGlowPane ? glowProgress : 0}
                monoFontFamily={MONO_FAMILY}
                borderRight={idx % 2 === 0}
                borderBottom={idx < 2}
              />
            );
          })}
        </div>
      </div>

      {/* Outer glow leaking around the lit pane (top-right of window) */}
      <div
        style={{
          position: "absolute",
          top: 80,
          left: "50%",
          width: "50%",
          height: "calc(50% - 50px)",
          opacity: outerGlowOpacity,
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(167, 139, 250, 0.35) 0%, transparent 65%)",
          filter: "blur(40px)",
          pointerEvents: "none",
          mixBlendMode: "screen",
        }}
      />

      {/* Caption */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 90,
          textAlign: "center",
          opacity: captionOpacity,
          transform: `translateY(${captionTranslateY}px)`,
          fontFamily: SANS_FAMILY,
          color: "rgba(255,255,255,0.92)",
          fontSize: 30,
          fontWeight: 500,
          letterSpacing: 0.2,
        }}
      >
        the idle pane glows — so you know which Claude is waiting on you
      </div>
    </AbsoluteFill>
  );
};

const TrafficLight: React.FC<{ color: string }> = ({ color }) => (
  <div
    style={{
      width: 12,
      height: 12,
      borderRadius: "50%",
      background: color,
      marginRight: 8,
      boxShadow: "inset 0 0 1px rgba(0,0,0,0.4)",
    }}
  />
);
