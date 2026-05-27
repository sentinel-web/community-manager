/**
 * Pure logic core of the EntityForm seam (see CONTEXT.md → EntityForm).
 *
 * Owns the create-vs-update decisions — the `isUpdate` rule, the method-name
 * derivation, the call-argument shaping, and the frame resolve value — with no
 * React, no antd, and no Meteor runtime, so it is fully testable without a DOM.
 * The `useEntityForm` hook is the thin adapter that wires `useDrawerFrame` and
 * `useMethod` onto these functions.
 */

/**
 * The single create-vs-update predicate. A model id alone is not enough: an
 * anonymous caller always inserts (load-bearing for the anonymous RegistrationForm).
 */
export function entityIsUpdate(hasUser: boolean, modelId: string | undefined): boolean {
  return hasUser && !!modelId;
}

/** Derives `<collection>.update` / `<collection>.insert` mechanically. */
export function entityMethodName(collection: string, isUpdate: boolean): string {
  return `${collection}.${isUpdate ? 'update' : 'insert'}`;
}

/** Shapes the method call arguments: `[id, payload]` to update, `[payload]` to insert. */
export function entityArgs(isUpdate: boolean, modelId: string | undefined, payload: unknown): unknown[] {
  return isUpdate ? [modelId, payload] : [payload];
}

/**
 * The value the drawer frame resolves with on success: the existing model id
 * (an update resolves the same doc) or, failing that, the data the insert returned.
 */
export function entityResolveValue(modelId: string | undefined, data: unknown): unknown {
  return modelId ?? data;
}
