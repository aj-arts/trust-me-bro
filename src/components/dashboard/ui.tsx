"use client";

import { Info } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { riskColor } from "@/lib/dashboard/scale";
import { promptModes, type PromptModeId } from "@/lib/dashboard/mock-data";

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

/* -------------------------------------------------------------------------- */
/* Panel — an "instrument" framed module                                      */
/* -------------------------------------------------------------------------- */

type ChartPanelProps = {
  title: string;
  subtitle: string;
  /** Short hint surfaced behind an info affordance in the header. */
  hint?: string;
  /** Right-aligned meta line (e.g. run counts / coverage). */
  meta?: ReactNode;
  /** Controls rendered in the panel header (e.g. a scoped toggle). */
  controls?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function ChartPanel({
  title,
  subtitle,
  hint,
  meta,
  controls,
  children,
  className,
  id,
}: ChartPanelProps) {
  return (
    <section
      id={id}
      className={`relative flex scroll-mt-4 flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-[0_1px_0_rgba(237,238,233,0.04)_inset,0_18px_40px_-28px_rgba(0,0,0,0.9)] ${
        className ?? ""
      }`}
    >
      <header className="flex flex-col gap-3 border-b border-border px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-mono text-[0.74rem] font-medium uppercase tracking-[0.12em] text-foreground">
              {title}
            </h2>
            {hint ? (
              <span title={hint} className="text-muted/70 transition-colors hover:text-accent">
                <Info size={13} aria-hidden />
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 max-w-prose text-[0.8rem] leading-5 text-muted">
            {subtitle}
          </p>
        </div>
        {controls ? <div className="shrink-0">{controls}</div> : null}
      </header>
      <div className="relative flex-1 px-5 py-5">{children}</div>
      {meta ? (
        <footer className="border-t border-border px-5 py-2.5 font-mono text-[0.68rem] tracking-[0.04em] text-muted">
          {meta}
        </footer>
      ) : null}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Prompt-mode segmented control                                              */
/* -------------------------------------------------------------------------- */

type PromptModeToggleProps = {
  value: PromptModeId;
  onChange: (mode: PromptModeId) => void;
  size?: "sm" | "md";
  idBase?: string;
};

export function PromptModeToggle({
  value,
  onChange,
  size = "md",
  idBase = "mode",
}: PromptModeToggleProps) {
  const pad =
    size === "sm" ? "px-2.5 py-1 text-[0.66rem]" : "px-3.5 py-1.5 text-[0.7rem]";
  return (
    <div
      role="tablist"
      aria-label="Prompt mode"
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
    >
      {promptModes.map((mode) => {
        const active = mode.id === value;
        return (
          <button
            key={mode.id}
            role="tab"
            id={`${idBase}-${mode.id}`}
            aria-selected={active}
            title={mode.description}
            onClick={() => onChange(mode.id)}
            className={`rounded-md font-mono uppercase tracking-[0.08em] transition-colors duration-150 ${pad} ${
              active
                ? "bg-accent-soft text-accent shadow-[0_0_0_1px_var(--accent-soft)]"
                : "text-muted hover:text-foreground"
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Risk legend                                                                */
/* -------------------------------------------------------------------------- */

export function RiskLegend({
  lowLabel,
  highLabel,
}: {
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.06em] text-muted">
      <span>{lowLabel}</span>
      <span
        aria-hidden
        className="h-2 w-24 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${riskColor(0)}, ${riskColor(
            0.5,
          )}, ${riskColor(1)})`,
          boxShadow: "0 0 10px -2px rgba(240,84,74,0.4)",
        }}
      />
      <span>{highLabel}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Floating tooltip                                                           */
/* -------------------------------------------------------------------------- */

type TooltipState = { x: number; y: number; content: ReactNode } | null;

type TooltipApi = {
  state: TooltipState;
  show: (event: { clientX: number; clientY: number }, content: ReactNode) => void;
  hide: () => void;
};

const TooltipContext = createContext<TooltipApi | null>(null);

export function TooltipBoundary({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TooltipState>(null);

  const show = useCallback(
    (event: { clientX: number; clientY: number }, content: ReactNode) => {
      setState({ x: event.clientX, y: event.clientY, content });
    },
    [],
  );
  const hide = useCallback(() => setState(null), []);

  return (
    <TooltipContext.Provider value={{ state, show, hide }}>
      {children}
      {state ? (
        <div
          className="pointer-events-none fixed z-50 max-w-[260px] -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-border-strong bg-surface-2 px-3 py-2 text-[0.78rem] leading-5 text-foreground shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
          style={{ left: state.x, top: state.y }}
        >
          {state.content}
        </div>
      ) : null}
    </TooltipContext.Provider>
  );
}

export function useTooltip(): TooltipApi {
  const ctx = useContext(TooltipContext);
  if (!ctx) {
    throw new Error("useTooltip must be used within a TooltipBoundary");
  }
  return ctx;
}
