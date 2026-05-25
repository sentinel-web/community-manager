import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import React from 'react';

// React-wiring smoke test for the MethodCall seam: proves the hook resolves
// antd feedback via App.useApp() and reflects loading/error/data as state. The
// exhaustive policy coverage lives in tests/server/runMethodCall.test.ts (pure,
// DOM-free). This file only runs in the Meteor client test context (a browser).
if (Meteor.isClient) {
  const ReactDOMClient = require('react-dom/client') as typeof import('react-dom/client');
  const { act } = require('react-dom/test-utils') as { act: (cb: () => void | Promise<void>) => Promise<void> };
  const { App } = require('antd') as typeof import('antd');

  type AntdApp = typeof import('antd').App;
  type CapturedApi = ReturnType<AntdApp['useApp']>;

  type UseMethodHook = typeof import('/imports/ui/hooks/useMethod').default;
  type UseMethod<T> = import('/imports/ui/hooks/useMethod').UseMethod<T>;
  type MethodResult<T> = import('/imports/ui/hooks/useMethod').MethodResult<T>;
  const useMethod = (require('/imports/ui/hooks/useMethod') as { default: UseMethodHook }).default;

  function makeSpy() {
    const calls: unknown[][] = [];
    const fn = (...args: unknown[]): unknown => {
      calls.push(args);
      return undefined;
    };
    return { fn, calls };
  }

  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => {
      resolve = res;
    });
    return { promise, resolve };
  }

  const realCallAsync = Meteor.callAsync.bind(Meteor);
  function stubCallAsync(impl: (name: string, ...args: unknown[]) => Promise<unknown>) {
    (Meteor as unknown as { callAsync: typeof Meteor.callAsync }).callAsync = impl as typeof Meteor.callAsync;
  }
  afterEach(() => {
    (Meteor as unknown as { callAsync: typeof Meteor.callAsync }).callAsync = realCallAsync;
  });

  // Mount the hook under a real antd <App>, capturing the same message/
  // notification instances the hook receives (antd memoizes the context value,
  // so the sibling capturer and the hook share one object reference).
  async function mountUseMethod<T>(name: string, options?: import('/imports/ui/hooks/useMethod').UseMethodOptions<T>) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const captured: { current: UseMethod<T> | null } = { current: null };
    let api: CapturedApi | null = null;

    function ApiCapture() {
      api = App.useApp();
      return null;
    }
    function Probe() {
      captured.current = useMethod<T>(name, options);
      return null;
    }

    const root = ReactDOMClient.createRoot(container);
    await act(async () => {
      root.render(
        <App>
          <ApiCapture />
          <Probe />
        </App>
      );
    });

    return {
      get current() {
        return captured.current!;
      },
      get api() {
        return api!;
      },
      unmount: async () => {
        await act(async () => {
          root.unmount();
        });
        container.remove();
      },
    };
  }

  describe('useMethod — React wiring of the MethodCall seam', () => {
    it('exposes { call, loading:false, error:null, data:null } initially', async () => {
      stubCallAsync(async () => undefined);
      const hook = await mountUseMethod('x.read');
      assert.strictEqual(typeof hook.current.call, 'function');
      assert.strictEqual(hook.current.loading, false);
      assert.strictEqual(hook.current.error, null);
      assert.strictEqual(hook.current.data, null);
      await hook.unmount();
    });

    it('reflects success as reactive data and fires the contextual message.success', async () => {
      stubCallAsync(async () => 'new-id');
      const hook = await mountUseMethod<string>('squads.insert', { success: 'Saved' });
      const successSpy = makeSpy();
      hook.api.message.success = successSpy.fn as typeof hook.api.message.success;
      let result: MethodResult<string> | undefined;
      await act(async () => {
        result = await hook.current.call({ name: 'Alpha' });
      });
      assert.deepStrictEqual(result, { ok: true, data: 'new-id' });
      assert.strictEqual(hook.current.data, 'new-id');
      assert.strictEqual(hook.current.error, null);
      assert.deepStrictEqual(successSpy.calls, [['Saved']]);
      await hook.unmount();
    });

    it('reflects a Meteor.Error as reactive error and fires the contextual notification.error', async () => {
      const thrown = new Meteor.Error('forbidden', 'Not allowed');
      stubCallAsync(async () => {
        throw thrown;
      });
      const hook = await mountUseMethod('squads.update');
      const errorSpy = makeSpy();
      hook.api.notification.error = errorSpy.fn as typeof hook.api.notification.error;
      let result: MethodResult<unknown> | undefined;
      await act(async () => {
        result = await hook.current.call('id', {});
      });
      assert.ok(result && result.ok === false);
      assert.strictEqual(hook.current.error, thrown);
      assert.deepStrictEqual(errorSpy.calls, [[{ message: 'forbidden', description: 'Not allowed' }]]);
      await hook.unmount();
    });

    it('stays silent when notify:false but still reflects the error in state', async () => {
      const thrown = new Meteor.Error('taken', 'Name taken');
      stubCallAsync(async () => {
        throw thrown;
      });
      const hook = await mountUseMethod('members.validateName', { notify: false });
      const errorSpy = makeSpy();
      hook.api.notification.error = errorSpy.fn as typeof hook.api.notification.error;
      await act(async () => {
        await hook.current.call('Bob', false);
      });
      assert.strictEqual(errorSpy.calls.length, 0);
      assert.strictEqual(hook.current.error, thrown);
      await hook.unmount();
    });

    it('toggles loading true during the call and false after it settles', async () => {
      const pending = deferred<string>();
      stubCallAsync(() => pending.promise);
      const hook = await mountUseMethod<string>('squads.insert');

      let callPromise: Promise<MethodResult<string>> | undefined;
      await act(async () => {
        callPromise = hook.current.call({});
      });
      // The call is in flight (callAsync unresolved) — loading must be true.
      assert.strictEqual(hook.current.loading, true);

      await act(async () => {
        pending.resolve('id');
        await callPromise;
      });
      assert.strictEqual(hook.current.loading, false);
      assert.strictEqual(hook.current.data, 'id');
      await hook.unmount();
    });
  });
}
