import { EJSON } from 'meteor/ejson';
import { useRef } from 'react';

/**
 * Returns the previously returned value while `value` stays structurally equal
 * (EJSON, so `Date`s compare by time). Lets callers rebuild query objects
 * freely each render without handing a new identity to `useFind` deps or
 * effects, which would re-run them (or loop) on every render.
 */
export default function useStableValue<V>(value: V): V {
  const ref = useRef(value);
  if (ref.current !== value && !EJSON.equals(ref.current as unknown as EJSON, value as unknown as EJSON)) {
    ref.current = value;
  }
  return ref.current;
}
