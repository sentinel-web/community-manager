interface FormValuesWithColor {
  color?: unknown;
}

export function getColorFromValues(values?: FormValuesWithColor): string | undefined {
  const color = values?.color;
  if (!color) return undefined;
  return (color as { toHexString?: () => string })?.toHexString?.() || (color as string);
}
