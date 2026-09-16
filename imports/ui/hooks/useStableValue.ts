import { EJSON } from 'meteor/ejson';
import { Meteor } from 'meteor/meteor';
import { useRef } from 'react';

// Depth guard for the development-only scan below: query objects are shallow,
// and a cycle would otherwise hang the render.
const MAX_SCAN_DEPTH = 8;

/**
 * Finds the first value EJSON.equals cannot compare meaningfully, as a dotted
 * path. Exported for its test; the hook only uses it in development.
 *
 * - `RegExp`: EJSON serializes every RegExp to the same empty object, so two
 *   different patterns compare equal and the hook would freeze the stale one.
 * - `function`: EJSON never considers two functions equal, so the hook churns a
 *   new identity on every render — the opposite of what it is for.
 */
export function findUnstableValue(value: unknown, path = '', depth = 0): string | null {
  if (value instanceof RegExp) return `${path || 'value'} (RegExp)`;
  if (typeof value === 'function') return `${path || 'value'} (function)`;
  if (depth >= MAX_SCAN_DEPTH || value === null || typeof value !== 'object' || value instanceof Date) return null;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const found = findUnstableValue(child, path ? `${path}.${key}` : key, depth + 1);
    if (found) return found;
  }
  return null;
}

/**
 * Returns the previously returned value while `value` stays structurally equal
 * (EJSON, so `Date`s compare by time). Lets callers rebuild query objects
 * freely each render without handing a new identity to `useFind` deps or
 * effects, which would re-run them (or loop) on every render.
 *
 * **Contract:** the value must be EJSON-comparable — plain objects, arrays,
 * primitives and `Date`s. `RegExp`s (all equal to each other under EJSON, so a
 * changed pattern would be swallowed) and functions (never equal, so nothing is
 * ever stable) are not; use a `{ $regex: string }` selector instead of a
 * literal `RegExp`. Development throws on a violation, production does not
 * check.
 */
export default function useStableValue<V>(value: V): V {
  if (Meteor.isDevelopment) {
    const unstable = findUnstableValue(value);
    if (unstable) throw new Error(`useStableValue received a value EJSON cannot compare: ${unstable}. See the hook's contract.`);
  }

  const ref = useRef(value);
  if (ref.current !== value && !EJSON.equals(ref.current as unknown as EJSON, value as unknown as EJSON)) {
    ref.current = value;
  }
  return ref.current;
}
