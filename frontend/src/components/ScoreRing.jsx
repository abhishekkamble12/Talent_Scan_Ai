import React from "react";

export const getScoreColor = (score) => {
  if (score >= 75) return { text: "text-emerald-400", stroke: "#34d399", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
  if (score >= 50) return { text: "text-amber-400", stroke: "#fbbf24", bg: "bg-amber-500/10", border: "border-amber-500/30" };
  return { text: "text-rose-400", stroke: "#f87171", bg: "bg-rose-500/10", border: "border-rose-500/30" };
};

export const ScoreRing = ({ score = 0, size = "md", showLabel = true, className = "" }) => {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)));
  const colors = getScoreColor(safeScore);

  const dim = size === "sm" ? 32 : size === "lg" ? 64 : 44;
  const strokeWidth = size === "sm" ? 3 : size === "lg" ? 5 : 4;
  const radius = (dim - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (safeScore / 100) * circumference;

  const textSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-lg font-bold" : "text-xs font-semibold";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="transform -rotate-90">
          {/* Background Track */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-subtle/60"
            fill="transparent"
          />
          {/* Progress Stroke */}
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
            fill="transparent"
          />
        </svg>
        <span className={`absolute tabular-nums font-mono ${textSize} ${colors.text}`}>
          {safeScore}
        </span>
      </div>
      {showLabel && (
        <span className="sr-only">Score: {safeScore} out of 100</span>
      )}
    </div>
  );
};

export default ScoreRing;
