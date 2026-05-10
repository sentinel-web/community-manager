// Type/runtime asymmetry warning: `${infer P}` matches any string between `{{`
// and `}}` (including hyphens, spaces, empty interior), but the runtime
// extractParams() helper only matches \w+. Use assertValidPlaceholders() to
// fence translations against placeholder names that ExtractParams<S> would
// happily infer but extractParams() would silently ignore at render time.
export type ExtractParams<S extends string> = {
  [K in ExtractParamNames<S>]: string | number;
};

type ExtractParamNames<S extends string> = S extends `${string}{{${infer P}}}${infer Rest}` ? P | ExtractParamNames<Rest> : never;

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;
const ANY_PLACEHOLDER_PATTERN = /\{\{([^}]*)\}\}/g;
const VALID_PLACEHOLDER_NAME = /^\w+$/;

export function extractParams(source: string): Set<string> {
  const names = new Set<string>();
  for (const match of source.matchAll(PLACEHOLDER_PATTERN)) {
    names.add(match[1]);
  }
  return names;
}

export function assertValidPlaceholders(source: string, key: string): void {
  const invalid: string[] = [];
  for (const match of source.matchAll(ANY_PLACEHOLDER_PATTERN)) {
    const inner = match[1];
    if (!VALID_PLACEHOLDER_NAME.test(inner)) {
      invalid.push(inner);
    }
  }
  if (invalid.length > 0) {
    const list = invalid.map(p => `"{{${p}}}"`).join(', ');
    throw new Error(
      `Invalid placeholder${invalid.length > 1 ? 's' : ''} ${list} in translation key "${key}". ` +
        `Placeholder names must match /^\\w+$/ (letters, digits, underscore).`,
    );
  }
}
