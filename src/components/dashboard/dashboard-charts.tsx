"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { modelMeta } from "./model-meta";
import { ProviderLogo } from "./provider-logo";

const COLORS = {
  accent: "#1c1a17",
  success: "#15803d",
  warning: "#b45309",
  danger: "#c0392b",
  muted: "#79726a",
  foreground: "#1c1a17",
  border: "#e7e1d7",
  grid: "#efeae1",
};

const tooltipContentStyle = {
  borderRadius: 8,
  border: `1px solid ${COLORS.border}`,
  fontSize: 12,
  boxShadow: "0 6px 16px rgba(23, 25, 35, 0.08)",
};

export type ModelStat = {
  model: string;
  provider: string;
  safetyScore: number;
  passRate: number;
  canaryRate: number;
  taskCompletion: number;
  riskEvents: number;
};

function gradientId(model: string) {
  return `passrate-${model.replace(/[^a-zA-Z0-9]/g, "-")}`;
}

function hatchId(model: string) {
  return `hatch-${model.replace(/[^a-zA-Z0-9]/g, "-")}`;
}

type PassBarLabelProps = {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
  topValue?: number;
};

function PassBarLabel({ x = 0, y = 0, width = 0, value = 0, topValue = 100 }: PassBarLabelProps) {
  const cx = x + width / 2;
  const delta = Math.round(value - 80);
  const deltaText = `${delta >= 0 ? "+" : "−"}${Math.abs(delta)} pt`;
  const isBest = value >= topValue;

  return (
    <g pointerEvents="none">
      {isBest ? (
        <text
          x={cx}
          y={y - 28}
          textAnchor="middle"
          fontSize={9}
          fontWeight={700}
          letterSpacing={1.4}
          fontFamily="var(--font-mono)"
          fill={COLORS.accent}
        >
          BEST IN CLASS
        </text>
      ) : null}
      <text
        x={cx}
        y={y - 13}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fontFamily="var(--font-mono)"
        fill={delta >= 0 ? COLORS.success : COLORS.danger}
      >
        {deltaText}
      </text>
      <text
        x={cx}
        y={y + 30}
        textAnchor="middle"
        fontSize={24}
        fontWeight={700}
        fontFamily="var(--font-mono)"
        fill={isBest ? COLORS.foreground : "#ffffff"}
      >
        {value}
      </text>
      <text
        x={cx}
        y={y + 46}
        textAnchor="middle"
        fontSize={9}
        fontWeight={600}
        letterSpacing={1}
        fontFamily="var(--font-mono)"
        fill={isBest ? COLORS.muted : "rgba(255, 255, 255, 0.85)"}
      >
        % PASS
      </text>
    </g>
  );
}

type ModelTickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string };
};

function ModelAxisTick({ x = 0, y = 0, payload }: ModelTickProps) {
  const model = String(payload?.value ?? "");
  const meta = modelMeta(model);

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect
        x={-14}
        y={10}
        width={28}
        height={28}
        rx={8}
        fill="#ffffff"
        stroke={COLORS.border}
        strokeWidth={1}
        filter="url(#badge-depth)"
      />
      <ProviderLogo model={model} size={18} x={-9} y={15} color={meta.logoColor} />
      <text x={0} y={54} textAnchor="middle" fontSize={11} fontWeight={600} fill={COLORS.foreground}>
        {model}
      </text>
      <text x={0} y={68} textAnchor="middle" fontSize={10} fill={COLORS.muted}>
        {meta.provider}
      </text>
    </g>
  );
}

export function PassRateByModelChart({ data }: { data: ModelStat[] }) {
  const sorted = [...data].sort((a, b) => b.passRate - a.passRate);
  const topValue = sorted[0]?.passRate ?? 100;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart accessibilityLayer data={sorted} margin={{ top: 44, right: 12, bottom: 8, left: 0 }}>
        <defs>
          {sorted.map((entry) => {
            const color = modelMeta(entry.model).barColor;
            return (
              <linearGradient
                key={entry.model}
                id={gradientId(entry.model)}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.62} />
              </linearGradient>
            );
          })}
          {sorted.map((entry) => {
            const color = modelMeta(entry.model).barColor;
            return (
              <pattern
                key={entry.model}
                id={hatchId(entry.model)}
                patternUnits="userSpaceOnUse"
                width={7}
                height={7}
                patternTransform="rotate(45)"
              >
                <rect width={7} height={7} fill={color} fillOpacity={0.12} />
                <line x1={0} y1={0} x2={0} y2={7} stroke={color} strokeWidth={1.4} strokeOpacity={0.6} />
              </pattern>
            );
          })}
          <filter id="badge-depth" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#1c1a17" floodOpacity="0.22" />
          </filter>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="4 4" stroke={COLORS.grid} />
        <ReferenceLine
          y={80}
          stroke={COLORS.success}
          strokeDasharray="5 4"
          strokeOpacity={0.7}
          label={{
            value: "TARGET 80%",
            position: "insideTopRight",
            fontSize: 10,
            fill: COLORS.success,
            fontFamily: "var(--font-mono)",
          }}
        />
        <XAxis
          dataKey="model"
          interval={0}
          height={80}
          tickLine={false}
          axisLine={{ stroke: COLORS.border }}
          tick={<ModelAxisTick />}
        />
        <YAxis
          domain={[0, 100]}
          width={44}
          unit="%"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: COLORS.muted, fontFamily: "var(--font-mono)" }}
        />
        <Tooltip cursor={{ fill: "rgba(28, 26, 23, 0.05)" }} contentStyle={tooltipContentStyle} />
        <Bar name="Pass rate" dataKey="passRate" radius={[8, 8, 0, 0]} maxBarSize={108}>
          {sorted.map((entry) => {
            const isBest = entry.passRate >= topValue;
            return (
              <Cell
                key={entry.model}
                fill={isBest ? `url(#${hatchId(entry.model)})` : `url(#${gradientId(entry.model)})`}
                stroke={modelMeta(entry.model).barColor}
                strokeWidth={isBest ? 1.5 : 1}
              />
            );
          })}
          <LabelList dataKey="passRate" content={<PassBarLabel topValue={topValue} />} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

type ScatterPointProps = {
  cx?: number;
  cy?: number;
  payload?: ModelStat;
};

function ModelScatterPoint({ cx = 0, cy = 0, payload }: ScatterPointProps) {
  if (!payload) {
    return null;
  }
  const meta = modelMeta(payload.model);

  return (
    <g>
      <circle cx={cx} cy={cy} r={14} fill="#ffffff" stroke={COLORS.border} strokeWidth={1} filter="url(#point-depth)" />
      <ProviderLogo model={payload.model} size={18} x={cx - 9} y={cy - 9} color={meta.logoColor} />
    </g>
  );
}

type ScatterLabelProps = {
  x?: number;
  y?: number;
  index?: number;
  data?: ModelStat[];
};

function ScatterLabel({ x = 0, y = 0, index = 0, data = [] }: ScatterLabelProps) {
  const datum = data[index];
  if (!datum) {
    return null;
  }

  return (
    <g pointerEvents="none">
      <text x={x + 18} y={y - 2} fontSize={11} fontWeight={600} fill={COLORS.foreground}>
        {datum.model}
      </text>
      <text x={x + 18} y={y + 11} fontSize={10} fontFamily="var(--font-mono)" fill={COLORS.muted}>
        {`S ${datum.safetyScore} · T ${datum.taskCompletion}`}
      </text>
    </g>
  );
}

export function SafetyVsCapabilityScatter({ data }: { data: ModelStat[] }) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ScatterChart accessibilityLayer margin={{ top: 16, right: 28, bottom: 28, left: 4 }}>
        <defs>
          <filter id="point-depth" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.5" stdDeviation="1.4" floodColor="#1c1a17" floodOpacity="0.18" />
          </filter>
        </defs>
        <CartesianGrid stroke={COLORS.grid} strokeDasharray="4 4" />
        <ReferenceArea
          x1={89}
          x2={98}
          y1={86}
          y2={96}
          fill={COLORS.success}
          fillOpacity={0.08}
          stroke={COLORS.success}
          strokeOpacity={0.3}
          strokeDasharray="4 4"
          label={{
            value: "IDEAL ZONE",
            position: "insideTopRight",
            fontSize: 9,
            fill: COLORS.success,
            fontFamily: "var(--font-mono)",
          }}
        />
        <XAxis
          type="number"
          dataKey="taskCompletion"
          name="Task completion"
          unit="%"
          domain={[80, 98]}
          tickLine={false}
          axisLine={{ stroke: COLORS.border }}
          tick={{ fontSize: 12, fill: COLORS.muted, fontFamily: "var(--font-mono)" }}
          label={{
            value: "TASK COMPLETION %",
            position: "insideBottom",
            offset: -16,
            fontSize: 10,
            fill: COLORS.muted,
            fontFamily: "var(--font-mono)",
          }}
        />
        <YAxis
          type="number"
          dataKey="safetyScore"
          name="Safety score"
          domain={[70, 96]}
          tickLine={false}
          axisLine={{ stroke: COLORS.border }}
          tick={{ fontSize: 12, fill: COLORS.muted, fontFamily: "var(--font-mono)" }}
          label={{
            value: "SAFETY SCORE",
            angle: -90,
            position: "insideLeft",
            fontSize: 10,
            fill: COLORS.muted,
            fontFamily: "var(--font-mono)",
          }}
        />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: COLORS.border }}
          contentStyle={tooltipContentStyle}
        />
        <Scatter name="Models" data={data} shape={<ModelScatterPoint />} isAnimationActive={false}>
          <LabelList dataKey="model" content={<ScatterLabel data={data} />} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
