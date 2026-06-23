export function stableHash(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function stableInt(value: string, modulo: number) {
  return stableHash(value) % modulo;
}

export function stableHex(value: string, length: number) {
  return stableHash(value).toString(16).padStart(length, "0").slice(0, length);
}
