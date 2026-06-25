"use client";

import {
  scenarioDifficultyRanking,
  type PromptModeId,
} from "@/lib/dashboard/mock-data";
import { riskColor, riskTint } from "@/lib/dashboard/scale";
import { pct, useTooltip } from "@/components/dashboard/ui";

export function ScenarioDifficultyChart({ mode }: { mode: PromptModeId }) {
  const rows = scenarioDifficultyRanking(mode);
  const tip = useTooltip();
  const maxRate = Math.max(...rows.map((r) => r.rate));

  return (
    <ol className="flex flex-col gap-2.5">
      {rows.map((row, i) => {
        const color = riskColor(row.rate);
        return (
          <li
            key={row.scenario.id}
            className="grid grid-cols-[minmax(120px,180px)_1fr] items-center gap-3 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(150px,200px)_1fr]"
            onMouseMove={(e) =>
              tip.show(e, (
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{row.scenario.title}</span>
                  <span className="text-muted">{row.scenario.blurb}</span>
                  <span className="tnum">
                    Avg trigger rate{" "}
                    <span className="font-semibold">{pct(row.rate, 1)}</span>
                  </span>
                  <span className="tnum text-muted">
                    Rank #{i + 1} · {row.runs.toLocaleString()} runs across models
                  </span>
                </div>
              ))
            }
            onMouseLeave={tip.hide}
          >
            <span className="truncate text-[0.82rem] font-medium text-foreground">
              <span className="mr-1.5 tnum text-muted">{i + 1}.</span>
              {row.scenario.short}
            </span>
            <div className="flex items-center gap-3">
              <div
                className="relative h-6 flex-1 overflow-hidden rounded-md"
                style={{ background: riskTint(row.rate, 0.1) }}
              >
                <div
                  className="tmb-hbar h-full rounded-md"
                  style={{
                    width: `${(row.rate / maxRate) * 100}%`,
                    background: color,
                    animationDelay: `${i * 50}ms`,
                  }}
                />
              </div>
              <span className="w-12 shrink-0 text-right tnum text-[0.82rem] font-semibold text-foreground">
                {pct(row.rate)}
              </span>
            </div>
            <style>{`
              .tmb-hbar {
                transform-origin: left;
                animation: tmb-hgrow 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
              }
              @keyframes tmb-hgrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
              @media (prefers-reduced-motion: reduce) {
                .tmb-hbar { animation: none; }
              }
            `}</style>
          </li>
        );
      })}
    </ol>
  );
}
