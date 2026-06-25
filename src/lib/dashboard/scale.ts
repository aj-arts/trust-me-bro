// Shared color encoding for the dashboard.
//
// Everything is framed around "risk" in [0, 1]: 0 = safe (low canary trigger
// rate / high safety score), 1 = dangerous (high trigger rate). The same ramp
// drives the safety-score bars, the heatmap, and the difficulty chart so the
// reader learns one color language across the page.

type Rgb = [number, number, number];

// Green -> amber -> red, tuned to read clearly on a near-white panel.
const SAFE: Rgb = [22, 154, 90]; // emerald
const MID: Rgb = [232, 170, 12]; // amber
const RISK: Rgb = [205, 47, 44]; // red

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(lerp(a[0], b[0], t)),
    Math.round(lerp(a[1], b[1], t)),
    Math.round(lerp(a[2], b[2], t)),
  ];
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function toRgb(t: number): Rgb {
  const x = clamp01(t);
  return x < 0.5 ? mix(SAFE, MID, x / 0.5) : mix(MID, RISK, (x - 0.5) / 0.5);
}

function rgbString([r, g, b]: Rgb, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Relative luminance, for choosing readable text on a colored fill. */
function luminance([r, g, b]: Rgb): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Solid risk color (full saturation) for bars, dots, and strong accents. */
export function riskColor(risk: number): string {
  return rgbString(toRgb(risk));
}

/** Readable ink (white / near-black) to sit on top of a riskFill of `risk`. */
export function riskInk(risk: number): string {
  return luminance(toRgb(risk)) > 0.55 ? "#1a1d27" : "#ffffff";
}

/**
 * Heatmap cell fill. Low risk stays pale and recedes; high risk saturates and
 * advances, so the eye is pulled to the failures without losing the grid.
 */
export function riskFill(risk: number): string {
  const t = clamp01(risk);
  const alpha = 0.16 + t * 0.84;
  return rgbString(toRgb(t), alpha);
}

/** Soft tint for backgrounds / tracks behind a risk value. */
export function riskTint(risk: number, alpha = 0.14): string {
  return rgbString(toRgb(risk), alpha);
}
