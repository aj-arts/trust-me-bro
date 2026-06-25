"use client";

import { heatmap, type HeatRow, type PromptModeId } from "@/lib/dashboard/mock-data";
import { riskCell, riskCellInk, riskGlow } from "@/lib/dashboard/scale";
import { pct, useTooltip } from "@/components/dashboard/ui";

export function ScenarioHeatmap({
  mode,
  rows = heatmap(mode),
}: {
  mode: PromptModeId;
  rows?: HeatRow[];
}) {
  const tip = useTooltip();
  const scenarios = rows[0]?.cells.map((c) => c.scenario) ?? [];

  if (rows.length === 0) {
    return (
      <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-surface text-sm text-muted">
        No saved runs for this prompt mode.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full table-fixed border-separate border-spacing-1 text-[0.875rem]">
        <colgroup>
          <col className="w-44" />
          {scenarios.map((s) => (
            <col key={s.id} className="w-[5.25rem]" />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel text-left align-bottom" />
            {scenarios.map((s) => (
              <th
                key={s.id}
                scope="col"
                title={s.title}
                className="h-36 px-0 pb-1 align-bottom"
              >
                <div className="relative h-36 w-[5.25rem] overflow-visible">
                  <span className="absolute bottom-2 left-1/2 block origin-bottom-left -rotate-45 whitespace-nowrap text-left text-[0.68rem] font-semibold leading-none text-muted-strong">
                    {s.title}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap bg-panel py-0.5 pr-3 text-right align-middle font-medium"
              >
                <span className="text-foreground">{row.model.name}</span>
              </th>
              {row.cells.map((cell) => {
                const hasRuns = cell.runs > 0;

                return (
                <td
                  key={cell.scenario.id}
                  className="h-10 rounded-md text-center align-middle text-[0.8125rem] font-semibold tabular-nums transition-transform duration-150 hover:scale-[1.08]"
                  style={{
                    background: hasRuns ? riskCell(cell.rate) : "var(--surface-2)",
                    color: hasRuns ? riskCellInk(cell.rate) : "var(--muted)",
                    boxShadow:
                      hasRuns && cell.rate > 0.45
                        ? `0 0 14px -4px ${riskGlow(cell.rate, 0.7)}`
                        : undefined,
                  }}
                  onMouseMove={(e) =>
                    tip.show(e, (
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">{row.model.name}</span>
                        <span className="text-muted">{cell.scenario.title}</span>
                        {hasRuns ? (
                          <span className="tnum">
                            Trigger rate{" "}
                            <span className="font-semibold">{pct(cell.rate, 1)}</span>
                          </span>
                        ) : (
                          <span className="text-muted">No saved runs</span>
                        )}
                        <span className="tnum text-muted">
                          {cell.runs} runs
                        </span>
                      </div>
                    ))
                  }
                  onMouseLeave={tip.hide}
                >
                  {hasRuns ? pct(cell.rate) : "N/A"}
                </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
