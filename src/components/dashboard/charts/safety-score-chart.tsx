"use client";

import { rankedSafetyScores, type PromptModeId } from "@/lib/dashboard/mock-data";
import { riskColor, riskGlow } from "@/lib/dashboard/scale";
import { pct, useTooltip } from "@/components/dashboard/ui";

const W = 880;
const H = 380;
const PAD = { top: 24, right: 16, bottom: 64, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const GRID = [0, 0.25, 0.5, 0.75, 1];

function wrapName(name: string): string[] {
  if (name.length <= 14) return [name];
  const words = name.split(" ");
  if (words.length === 1) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export function SafetyScoreChart({ mode }: { mode: PromptModeId }) {
  const data = rankedSafetyScores(mode);
  const tip = useTooltip();

  const band = PLOT_W / data.length;
  const barW = Math.min(64, band * 0.56);

  const y = (v: number) => PAD.top + PLOT_H * (1 - v);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full"
      style={{ height: "auto" }}
      role="img"
      aria-label="Scenario-weighted safety score by model"
    >
      {GRID.map((g) => (
        <g key={g}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(g)}
            y2={y(g)}
            stroke="var(--grid)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 8}
            y={y(g)}
            textAnchor="end"
            dominantBaseline="middle"
            className="tnum"
            fontSize={11}
            fill="var(--muted)"
          >
            {pct(g)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const cx = PAD.left + band * i + band / 2;
        const top = y(d.score);
        const risk = 1 - d.score;
        const color = riskColor(risk);
        const lines = wrapName(d.model.name);

        return (
          <g
            key={d.model.id}
            onMouseMove={(e) =>
              tip.show(e, (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{d.model.name}</span>
                  <span className="text-muted">{d.model.vendor}</span>
                  <span className="tnum">
                    Safety score{" "}
                    <span className="font-semibold text-foreground">
                      {pct(d.score, 1)}
                    </span>
                  </span>
                  <span className="tnum text-muted">
                    Rank #{i + 1} · {d.runs.toLocaleString()} runs
                  </span>
                </div>
              ))
            }
            onMouseLeave={tip.hide}
          >
            {/* hit area */}
            <rect
              x={PAD.left + band * i}
              y={PAD.top}
              width={band}
              height={PLOT_H}
              fill="transparent"
            />
            <rect
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={PAD.top + PLOT_H - top}
              rx={4}
              fill={color}
              className="tmb-bar"
              style={{
                animationDelay: `${i * 45}ms`,
                filter: `drop-shadow(0 2px 10px ${riskGlow(risk, 0.45)})`,
              }}
            />
            <text
              x={cx}
              y={top - 8}
              textAnchor="middle"
              className="tnum"
              fontSize={12}
              fontWeight={600}
              fill="var(--foreground)"
            >
              {pct(d.score)}
            </text>
            {lines.map((line, li) => (
              <text
                key={li}
                x={cx}
                y={PAD.top + PLOT_H + 18 + li * 13}
                textAnchor="middle"
                fontSize={11}
                fill="var(--muted-strong)"
              >
                {line}
              </text>
            ))}
          </g>
        );
      })}

      <line
        x1={PAD.left}
        x2={W - PAD.right}
        y1={y(0)}
        y2={y(0)}
        stroke="var(--border-strong)"
        strokeWidth={1}
      />

      <style>{`
        .tmb-bar {
          transform-box: fill-box;
          transform-origin: bottom;
          animation: tmb-grow 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes tmb-grow {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .tmb-bar { animation: none; }
        }
      `}</style>
    </svg>
  );
}
