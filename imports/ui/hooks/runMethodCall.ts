import type { Meteor } from 'meteor/meteor';

/**
 * Pure policy core of the MethodCall seam (see CONTEXT.md → MethodCall).
 *
 * Owns the decisions — error narrowing, when to notify, when to show success,
 * and the discriminated outcome — with no React and no antd, so it is fully
 * testable without a DOM. The `useMethod` hook is a thin adapter that wires
 * React state and `App.useApp()` feedback onto this function.
 */

/**
 * Discriminated outcome. Never a bare `T | undefined`, so a method that
 * legitimately resolves to nothing (e.g. a `*.remove`) is an unambiguous
 * `{ ok: true }` rather than indistinguishable from a failure.
 */
export type MethodResult<T> = { ok: true; data: T } | { ok: false; error: Meteor.Error };

export interface MethodCallPolicy<T> {
  /** Success toast text — a string, or a function of the result (for
   *  create-vs-update message divergence). Omit for reads / silent calls. */
  success?: string | ((data: T) => string);
  /** When true (default), a failure invokes `feedback.notifyError`. Set false
   *  for callers that fold failures into their own state (field validators). */
  notify?: boolean;
}

/** Side-effect sink. The hook maps these onto antd's contextual message/notification. */
export interface MethodCallFeedback {
  notifySuccess: (content: string) => void;
  notifyError: (content: { message: string; description: string }) => void;
}

export async function runMethodCall<T>(
  invoke: () => Promise<unknown>,
  policy: MethodCallPolicy<T>,
  feedback: MethodCallFeedback
): Promise<MethodResult<T>> {
  const { success, notify = true } = policy;
  try {
    const data = (await invoke()) as T;
    if (success !== undefined) {
      feedback.notifySuccess(typeof success === 'function' ? success(data) : success);
    }
    return { ok: true, data };
  } catch (caught) {
    // The single place the unsafe Meteor.Error narrowing lives.
    const error = caught as Meteor.Error;
    if (notify) {
      // Prefer the clean reason; fall back to the full message (which Meteor
      // formats as "<reason> [<code>]") for errors that carry no reason.
      feedback.notifyError({ message: error.error as string, description: error.reason || error.message });
    }
    return { ok: false, error };
  }
}
