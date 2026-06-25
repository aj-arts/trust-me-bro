"use client";

import { useState } from "react";
import { promptModes, robustnessSeries } from "@/lib/dashboard/mock-data";
import { riskColor } from "@/lib/dashboard/scale";
import { pct, useTooltip } from "@/components/dashboard/ui";

const W = 880;
const H = 420;
const PAD = { top: 28, right: 176, bottom: 44, left: 44 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

export function PromptRobustnessChart() {
  const series = robustnessSeries();
  const tip = useTooltip();
  const [hovered, setHovered] = useState<string | null>(null);

  const all = series.flatMap((s) => s.points.map((p) => p.score));
  const min = Math.max(0, Math.min(...all) - 0.04);
  const max = Math.min(1, Math.max(...all) + 0.04);

  const x = (i: number) => PAD.left + (PLOT_W * i) / (promptModes.length - 1);
  const y = (v: number) =>
    PAD.top + PLOT_H * (1 - (v - min) / (max - min || 1));

  const ticks = gridTicks(min, max);

  // De-overlap right-edge labels.
  const labels = series
    .map((s) => ({
      id: s.model.id,
      name: s.model.name,
      score: s.points[s.points.length - 1].score,
      color: riskColor(1 - s.points[1].score),
      y: y(s.points[s.points.length - 1].score),
    }))
    .sort((a, b) => a.y - b.y);
  const MIN_GAP = 15;
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
            fontSize={11}
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
            fontSize={12}
            fontWeight={600}
            fill="var(--muted-strong)"
          >
            {m.label}
          </text>
        </g>
      ))}

      {series.map((s) => {
        const color = riskColor(1 - s.points[1].score);
        const dim = hovered !== null && hovered !== s.model.id;
        const active = hovered === s.model.id;
        const d = s.points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ");
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
                        {pct(p.score, 1)}
                      </span>
                    </span>
                  ))}
                  <span className="tnum text-muted">
                    Safe → Permissive drop{" "}
                    <span className="font-semibold text-danger">
                      {pct(s.points[0].score - s.points[2].score, 1)}
                    </span>
                  </span>
                </div>
              ))
            }
          >
            <polyline
              points={d}
              fill="none"
              stroke={color}
              strokeWidth={active ? 3.25 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="tmb-line"
            />
            {s.points.map((p, i) => (
              <circle
                key={p.mode}
                cx={x(i)}
                cy={y(p.score)}
                r={active ? 4.5 : 3.25}
                fill="var(--panel)"
                stroke={color}
                strokeWidth={2}
              />
            ))}
          </g>
        );
      })}

      {labels.map((l) => (
        <text
          key={l.id}
          x={x(promptModes.length - 1) + 12}
          y={l.y}
          dominantBaseline="middle"
          fontSize={11}
          fontWeight={hovered === l.id ? 700 : 500}
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
