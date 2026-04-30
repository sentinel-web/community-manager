type ColorPickerValue = { toHexString?: () => string } | string | null | undefined;

interface FormValuesWithColor {
  color?: ColorPickerValue;
  [key: string]: unknown;
}

export function getColorFromValues(values: FormValuesWithColor): string | null | undefined {
  return values?.color ? (values.color as { toHexString?: () => string })?.toHexString?.() || (values.color as string) : values?.color;
}
