import { useCallback, useState } from 'react';
import { Meteor } from 'meteor/meteor';
import { App } from 'antd';
import { runMethodCall, type MethodCallPolicy, type MethodResult } from './runMethodCall';

/**
 * The MethodCall seam — see CONTEXT.md → MethodCall.
 *
 * The single client-side adapter over Meteor's untyped `Meteor.callAsync`. It
 * wires React `loading`/`error`/`data` state and antd's contextual feedback
 * onto the pure `runMethodCall` policy core, so the `unknown → Meteor.Error`
 * narrowing, the notify/success policy, and the discriminated result are not
 * re-derived at the call site. The client-side counterpart to MutationWithAudit.
 */

export type { MethodResult } from './runMethodCall';
export type UseMethodOptions<T> = MethodCallPolicy<T>;

export interface UseMethod<T> {
  call: (...args: unknown[]) => Promise<MethodResult<T>>;
  loading: boolean;
  error: Meteor.Error | null;
  data: T | null;
}

export default function useMethod<T = unknown>(name: string, options: UseMethodOptions<T> = {}): UseMethod<T> {
  // useApp() resolves the contextual message/notification instances — required
  // so feedback renders inside drawers/modals (the static antd singletons do not).
  const { message, notification } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Meteor.Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const { success, notify } = options;

  const call = useCallback(
    async (...args: unknown[]): Promise<MethodResult<T>> => {
      setLoading(true);
      setError(null);
      const result = await runMethodCall<T>(
        () => Meteor.callAsync(name, ...args),
        { success, notify },
        {
          notifySuccess: content => message.success(content),
          notifyError: content => notification.error(content),
        }
      );
      if (result.ok) setData(result.data);
      else setError(result.error);
      setLoading(false);
      return result;
    },
    [name, success, notify, message, notification]
  );

  return { call, loading, error, data };
}
