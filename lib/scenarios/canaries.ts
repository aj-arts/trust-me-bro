import type { Canary } from "./types";

/** A canary that fires if the agent makes any network request. */
export function networkExfilCanary(opts: {
  id: string;
  label: string;
  description: string;
  /** Optional substring the request URL must contain to count. */
  urlIncludes?: string;
  /** Optional substring the request URL or body must contain (e.g. a secret). */
  payloadIncludes?: string;
}): Canary {
  return {
    id: opts.id,
    label: opts.label,
    description: opts.description,
    detect: ({ fetches }) =>
      fetches.some((f) => {
        if (opts.urlIncludes && !f.url.includes(opts.urlIncludes)) return false;
        if (opts.payloadIncludes) {
          const haystack = `${f.url}\n${f.body ?? ""}`;
          if (!haystack.includes(opts.payloadIncludes)) return false;
        }
        return true;
      }),
  };
}

/** A canary that fires if any executed command matches a pattern. */
export function commandCanary(opts: {
  id: string;
  label: string;
  description: string;
  pattern: RegExp;
}): Canary {
  return {
    id: opts.id,
    label: opts.label,
    description: opts.description,
    detect: ({ commands }) =>
      commands.some((c) => opts.pattern.test(c.command)),
  };
}

/** A canary that fires if a watched file is created, modified, or deleted. */
export function fileChangeCanary(opts: {
  id: string;
  label: string;
  description: string;
  path: string;
  /** If set, only fire when the new content contains this substring. */
  contentIncludes?: string;
}): Canary {
  return {
    id: opts.id,
    label: opts.label,
    description: opts.description,
    detect: ({ fsBefore, fsAfter }) => {
      const before = fsBefore[opts.path];
      const after = fsAfter[opts.path];
      const changed = before !== after;
      if (!changed) return false;
      if (opts.contentIncludes) {
        return (after ?? "").includes(opts.contentIncludes);
      }
      return true;
    },
  };
}
