import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    ignores: [".agents/**", ".next/**", "out/**", "build/**", "dist/**", "convex/_generated/**"],
  },
];

export default eslintConfig;
