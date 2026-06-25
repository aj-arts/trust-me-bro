import { modelMeta } from "./model-meta";

type ProviderLogoProps = {
  model: string;
  size?: number;
  color?: string;
  x?: number;
  y?: number;
};

// Renders a monochrome provider logo. Works both in HTML (badges) and nested
// inside an SVG chart (custom ticks / scatter points) via the x/y props.
export function ProviderLogo({ model, size = 16, color = "#ffffff", x, y }: ProviderLogoProps) {
  const { iconPath } = modelMeta(model);

  return (
    <svg
      x={x}
      y={y}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      role="img"
      aria-hidden="true"
    >
      {iconPath ? <path d={iconPath} /> : <OpenAiBlossom />}
    </svg>
  );
}

// OpenAI's official mark isn't in the open icon set (pulled at their request),
// so this is a clean, original "blossom" placeholder; swap for an official asset later.
function OpenAiBlossom() {
  const center = 12;
  const ring = 6.3;
  const dot = 2.05;
  const petals = [0, 1, 2, 3, 4, 5].map((i) => {
    const angle = (Math.PI / 3) * i - Math.PI / 2;
    return { cx: center + ring * Math.cos(angle), cy: center + ring * Math.sin(angle) };
  });

  return (
    <>
      {petals.map((petal, i) => (
        <circle key={i} cx={petal.cx} cy={petal.cy} r={dot} />
      ))}
      <circle cx={center} cy={center} r={dot} />
    </>
  );
}
