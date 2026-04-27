import React from "react";
import { useCurrentFrame, interpolate, interpolateColors, Easing } from "remotion";
import { PaneScript } from "./scripts";

type Props = PaneScript & {
  glowProgress: number;
  monoFontFamily: string;
  borderRight: boolean;
  borderBottom: boolean;
};

const TEXT_COLOR = "#e6e6ea";
const DIM_COLOR = "#6a6f80";
const PROMPT_ACCENT = "#a78bfa";
const TOOL_ACCENT = "#7dd3fc";

export const Pane: React.FC<Props> = ({
  cwd,
  prompt,
  response,
  startFrame,
  cps,
  finishFrame,
  glowProgress,
  monoFontFamily,
  borderRight,
  borderBottom,
}) => {
  const frame = useCurrentFrame();

  const elapsedFrames = Math.max(0, frame - startFrame);
  const charsToShow = Math.min(
    response.length,
    Math.floor((elapsedFrames / 30) * cps),
  );
  const visibleResponse = response.slice(0, charsToShow);
  const isFinished =
    finishFrame !== undefined ? frame >= finishFrame : false;
  const cursorVisible = !isFinished && Math.floor(frame / 14) % 2 === 0;

  const showPrompt = frame >= startFrame - 4;

  // Background color: transparent → indigo tint
  const bgColor = interpolateColors(
    glowProgress,
    [0, 1],
    ["rgba(58, 42, 64, 0)", "rgba(58, 42, 64, 0.85)"],
  );

  // Soft inner radial highlight on the glowing pane
  const innerGlowOpacity = interpolate(
    glowProgress,
    [0, 1],
    [0, 0.5],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "relative",
        padding: "30px 34px",
        fontFamily: monoFontFamily,
        fontSize: 18,
        lineHeight: 1.55,
        color: TEXT_COLOR,
        backgroundColor: bgColor,
        borderRight: borderRight ? "1px solid rgba(255,255,255,0.05)" : "none",
        borderBottom: borderBottom ? "1px solid rgba(255,255,255,0.05)" : "none",
        overflow: "hidden",
      }}
    >
      {/* Inner soft glow */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 45%, rgba(167, 139, 250, ${0.18 * innerGlowOpacity}) 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      {/* cwd */}
      <div
        style={{
          color: DIM_COLOR,
          fontSize: 13,
          letterSpacing: 0.3,
          marginBottom: 10,
        }}
      >
        {cwd}
      </div>

      {/* prompt */}
      {showPrompt && (
        <div style={{ color: "#c8cad6" }}>
          <span style={{ color: PROMPT_ACCENT, marginRight: 8 }}>›</span>
          {prompt}
        </div>
      )}

      {/* response */}
      <div
        style={{
          marginTop: 14,
          whiteSpace: "pre-wrap",
          color: TEXT_COLOR,
        }}
      >
        {renderResponseWithAccents(visibleResponse)}
        {cursorVisible && (
          <span
            style={{
              display: "inline-block",
              width: "0.55em",
              height: "1.05em",
              background: TEXT_COLOR,
              verticalAlign: "text-bottom",
              marginLeft: 1,
            }}
          />
        )}
      </div>
    </div>
  );
};

// Color the bullet markers (●) used as tool indicators
function renderResponseWithAccents(text: string): React.ReactNode {
  const parts = text.split(/(●)/);
  return parts.map((part, i) =>
    part === "●" ? (
      <span key={i} style={{ color: TOOL_ACCENT }}>
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}
