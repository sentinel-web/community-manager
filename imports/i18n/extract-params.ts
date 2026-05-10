export type ExtractParams<S extends string> = {
  [K in ExtractParamNames<S>]: string | number;
};

type ExtractParamNames<S extends string> = S extends `${string}{{${infer P}}}${infer Rest}` ? P | ExtractParamNames<Rest> : never;

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

export function extractParams(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(PLACEHOLDER_PATTERN)) {
    names.add(match[1]);
  }
  return names;
}
