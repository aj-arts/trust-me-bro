// Shared color encoding for the dashboard — tuned for the dark "Instrument
// Deck" theme, where saturated thermal colors glow against a near-black canvas.
//
// Everything is framed around "risk" in [0, 1]: 0 = safe (low canary trigger
// rate / high safety score), 1 = dangerous (high trigger rate). The same ramp
// drives the safety-score bars, the heatmap, and the difficulty chart so the
// reader learns one color language across the page.

type Rgb = [number, number, number];

// Luminous green -> amber -> red, tuned to read as a thermal readout on a
// near-black panel.
const SAFE: Rgb = [62, 201, 122]; // emerald
const MID: Rgb = [245, 184, 30]; // amber
const RISK: Rgb = [240, 84, 74]; // red

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

/** Glow halo color for thermal bars/lines on the dark canvas. */
export function riskGlow(risk: number, alpha = 0.5): string {
  return rgbString(toRgb(risk), alpha);
}

/** Readable ink to sit on top of a solid riskColor fill. */
export function riskInk(risk: number): string {
  return luminance(toRgb(risk)) > 0.5 ? "#0d0c0a" : "#edeee9";
}

/**
 * Heatmap cell fill for the dark deck. Low risk recedes toward the canvas
 * (dim green), high risk advances and glows (bright red), so the eye is pulled
 * to the failures without losing the grid.
 */
export function riskCell(risk: number): string {
  const t = clamp01(risk);
  const [r, g, b] = toRgb(t);
  // Darken low-risk cells toward the canvas so they recede.
  const k = 0.34 + t * 0.66;
  const base: Rgb = [22, 21, 16];
  return rgbString([
    Math.round(lerp(base[0], r, k)),
    Math.round(lerp(base[1], g, k)),
    Math.round(lerp(base[2], b, k)),
  ]);
}

/** Readable ink on top of a riskCell fill. */
export function riskCellInk(risk: number): string {
  const t = clamp01(risk);
  const [r, g, b] = toRgb(t);
  const k = 0.34 + t * 0.66;
  const base: Rgb = [22, 21, 16];
  const composited: Rgb = [
    Math.round(lerp(base[0], r, k)),
    Math.round(lerp(base[1], g, k)),
    Math.round(lerp(base[2], b, k)),
  ];
  return luminance(composited) > 0.45 ? "#0d0c0a" : "#edeee9";
}

/** Soft tint for backgrounds / tracks behind a risk value. */
export function riskTint(risk: number, alpha = 0.16): string {
  return rgbString(toRgb(risk), alpha);
}
