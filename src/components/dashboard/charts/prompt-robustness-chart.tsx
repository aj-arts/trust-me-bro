"use client";

import { useState } from "react";
import {
  promptModes,
  robustnessSeries,
  type RobustnessSeries,
} from "@/lib/dashboard/mock-data";
import { riskColor, riskGlow } from "@/lib/dashboard/scale";
import { pct, useTooltip } from "@/components/dashboard/ui";

const W = 880;
const H = 420;
const PAD = { top: 28, right: 176, bottom: 44, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function PromptRobustnessChart({
  series: inputSeries = robustnessSeries(),
}: {
  series?: RobustnessSeries[];
}) {
  const series = inputSeries;
  const tip = useTooltip();
  const [hovered, setHovered] = useState<string | null>(null);

  const all = series.flatMap((s) =>
    s.points.flatMap((p) => (p.score === null ? [] : [p.score])),
  );

  if (all.length === 0) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted">
        Save runs across prompt modes to draw robustness lines.
      </div>
    );
  }

  const min = Math.max(0, Math.min(...all) - 0.04);
  const max = Math.min(1, Math.max(...all) + 0.04);

  const x = (i: number) => PAD.left + (PLOT_W * i) / (promptModes.length - 1);
  const y = (v: number) =>
    PAD.top + PLOT_H * (1 - (v - min) / (max - min || 1));

  const ticks = gridTicks(min, max);

  // De-overlap right-edge labels.
  const labels = series
    .flatMap((s) => {
      const lastPoint = [...s.points].reverse().find((p) => p.score !== null);
      const neutralScore =
        s.points.find((p) => p.mode === "neutral")?.score ?? lastPoint?.score ?? 0;

      if (!lastPoint || lastPoint.score === null) return [];

      return [
        {
          id: s.model.id,
          name: s.model.name,
          score: lastPoint.score,
          color: riskColor(1 - neutralScore),
          y: y(lastPoint.score),
        },
      ];
    })
    .sort((a, b) => a.y - b.y);
  const MIN_GAP = 18;
  for (let i = 1; i < labels.length; i += 1) {
    if (labels[i].y - labels[i - 1].y < MIN_GAP) {
      labels[i].y = labels[i - 1].y + MIN_GAP;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      style={{ height: "auto" }}
      role="img"
      aria-label="Safety score across prompt modes, one line per model"
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--grid)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(t)}
            textAnchor="end"
            dominantBaseline="middle"
            className="tnum"
            fontSize={12}
            fill="var(--muted)"
          >
            {pct(t)}
          </text>
        </g>
      ))}

      {promptModes.map((m, i) => (
        <g key={m.id}>
          <line
            x1={x(i)}
            x2={x(i)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="3 4"
          />
          <text
            x={x(i)}
            y={PAD.top + PLOT_H + 22}
            textAnchor={i === 0 ? "start" : i === promptModes.length - 1 ? "middle" : "middle"}
            fontSize={13}
            fontWeight={600}
            fill="var(--muted-strong)"
          >
            {m.label}
          </text>
        </g>
      ))}

      {series.map((s) => {
        const neutralScore =
          s.points.find((p) => p.mode === "neutral")?.score ??
          s.points.find((p) => p.score !== null)?.score ??
          0;
        const color = riskColor(1 - neutralScore);
        const dim = hovered !== null && hovered !== s.model.id;
        const active = hovered === s.model.id;
        const points = s.points
          .map((p, i) => (p.score === null ? null : `${x(i)},${y(p.score)}`))
          .filter((point): point is string => point !== null);
        if (points.length === 0) return null;

        return (
          <g
            key={s.model.id}
            opacity={dim ? 0.18 : 1}
            style={{ transition: "opacity 0.15s ease" }}
            onMouseEnter={() => setHovered(s.model.id)}
            onMouseLeave={() => {
              setHovered(null);
              tip.hide();
            }}
            onMouseMove={(e) =>
              tip.show(e, (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{s.model.name}</span>
                  {s.points.map((p) => (
                    <span key={p.mode} className="tnum text-muted">
                      {promptModes.find((m) => m.id === p.mode)?.label}:{" "}
                      <span className="font-semibold text-foreground">
                        {p.score === null ? "No data" : pct(p.score, 1)}
                      </span>
                    </span>
                  ))}
                  {s.points[0].score !== null && s.points[2].score !== null ? (
                    <span className="tnum text-muted">
                      Safe → Unsafe drop{" "}
                      <span className="font-semibold text-danger">
                        {pct(s.points[0].score - s.points[2].score, 1)}
                      </span>
                    </span>
                  ) : null}
                </div>
              ))
            }
          >
            {points.length > 1 ? (
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={active ? 3.25 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                className="tmb-line"
                style={{
                  filter: `drop-shadow(0 0 ${active ? 7 : 4}px ${riskGlow(
                    1 - neutralScore,
                    active ? 0.75 : 0.4,
                  )})`,
                }}
              />
            ) : null}
            {s.points.flatMap((p, i) => p.score === null ? [] : [(
              <circle
                key={p.mode}
                cx={x(i)}
                cy={y(p.score)}
                r={active ? 4.5 : 3.25}
                fill="var(--panel)"
                stroke={color}
                strokeWidth={2}
              />
            )])}
          </g>
        );
      })}

      {labels.map((l) => (
        <text
          key={l.id}
          x={x(promptModes.length - 1) + 12}
          y={l.y}
          dominantBaseline="middle"
          fontSize={13}
          fontWeight={500}
          fill={hovered === null || hovered === l.id ? "var(--foreground)" : "var(--muted)"}
          opacity={hovered === null || hovered === l.id ? 1 : 0.4}
          style={{ transition: "opacity 0.15s ease" }}
        >
          <tspan>{l.name}</tspan>
          <tspan className="tnum" fill="var(--muted)" dx={6}>
            {pct(l.score)}
          </tspan>
        </text>
      ))}

      <style>{`
        .tmb-line {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
          animation: tmb-draw 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes tmb-draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .tmb-line { stroke-dasharray: none; stroke-dashoffset: 0; animation: none; }
        }
      `}</style>
    </svg>
  );
}

function gridTicks(min: number, max: number): number[] {
  const step = 0.1;
  const start = Math.ceil(min / step) * step;
  const out: number[] = [];
  for (let v = start; v <= max + 1e-9; v += step) {
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}
