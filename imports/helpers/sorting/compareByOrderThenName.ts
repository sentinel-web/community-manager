export interface OrderedNamed {
  order?: number | null;
  name?: string | null;
}

/** Ascending comparator for optional numbers; `null`/`undefined` sort after every number. */
export function compareOptionalNumbers(a: number | null | undefined, b: number | null | undefined): number {
  const aMissing = typeof a !== 'number' || Number.isNaN(a);
  const bMissing = typeof b !== 'number' || Number.isNaN(b);
  if (aMissing || bMissing) return Number(aMissing) - Number(bMissing);
  return a - b;
}

/** Sorts by `order` ascending (missing last), then by `name`. */
export default function compareByOrderThenName(a: OrderedNamed, b: OrderedNamed): number {
  return compareOptionalNumbers(a.order, b.order) || (a.name ?? '').localeCompare(b.name ?? '');
}
