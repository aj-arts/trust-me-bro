"use client";

import { heatmap, type PromptModeId } from "@/lib/dashboard/mock-data";
import { riskFill, riskInk } from "@/lib/dashboard/scale";
import { pct, useTooltip } from "@/components/dashboard/ui";

export function ScenarioHeatmap({ mode }: { mode: PromptModeId }) {
  const rows = heatmap(mode);
  const tip = useTooltip();
  const scenarios = rows[0]?.cells.map((c) => c.scenario) ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-[0.78rem]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel text-left align-bottom" />
            {scenarios.map((s) => (
              <th
                key={s.id}
                scope="col"
                title={s.title}
                className="px-1 pb-2 align-bottom text-[0.68rem] font-medium leading-tight text-muted-strong"
              >
                {s.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.model.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 whitespace-nowrap bg-panel py-1 pr-3 text-right align-middle font-medium"
              >
                <span className="text-foreground">{row.model.name}</span>
              </th>
              {row.cells.map((cell) => (
                <td
                  key={cell.scenario.id}
                  className="h-10 rounded-md text-center align-middle tnum font-medium tabular-nums transition-transform duration-150 hover:scale-[1.06]"
                  style={{
                    background: riskFill(cell.rate),
                    color: riskInk(cell.rate),
                  }}
                  onMouseMove={(e) =>
                    tip.show(e, (
                      <div className="flex flex-col gap-1">
                        <span className="font-semibold">{row.model.name}</span>
                        <span className="text-muted">{cell.scenario.title}</span>
                        <span className="tnum">
                          Trigger rate{" "}
                          <span className="font-semibold">{pct(cell.rate, 1)}</span>
                        </span>
                        <span className="tnum text-muted">
                          {cell.runs} runs
                        </span>
                      </div>
                    ))
                  }
                  onMouseLeave={tip.hide}
                >
                  {pct(cell.rate)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
