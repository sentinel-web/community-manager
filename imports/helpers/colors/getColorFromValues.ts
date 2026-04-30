interface FormValuesWithColor {
  color?: unknown;
  [key: string]: unknown;
}

export function getColorFromValues(values: FormValuesWithColor): string | null | undefined {
  const color = values?.color;
  if (!color) return color as null | undefined;
  return (color as { toHexString?: () => string })?.toHexString?.() || (color as string);
}
