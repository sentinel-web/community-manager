import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import React from 'react';

// React-wiring smoke test for the EntityForm seam: proves the hook self-sources
// the drawer frame, derives the method name via the pure core, shapes args, and
// resolves the frame on success. The exhaustive create-vs-update logic lives in
// tests/server/entityFormSubmit.test.ts (pure, DOM-free). This file only runs in
// the Meteor client test context (a browser).
if (Meteor.isClient) {
  const ReactDOMClient = require('react-dom/client') as typeof import('react-dom/client');
  const { act } = require('react-dom/test-utils') as { act: (cb: () => void | Promise<void>) => Promise<void> };
  const { App } = require('antd') as typeof import('antd');
  const { LanguageProvider } = require('/imports/i18n/LanguageContext') as typeof import('/imports/i18n/LanguageContext');
  const { FrameContext } = require('/imports/ui/drawer-stack/DrawerStackProvider') as typeof import('/imports/ui/drawer-stack/DrawerStackProvider');

  type UseEntityFormHook = typeof import('/imports/ui/hooks/useEntityForm').default;
  type UseEntityForm<V, M> = import('/imports/ui/hooks/useEntityForm').UseEntityForm<V, M>;
  type UseEntityFormOptions<V> = import('/imports/ui/hooks/useEntityForm').UseEntityFormOptions<V>;
  const useEntityForm = (require('/imports/ui/hooks/useEntityForm') as { default: UseEntityFormHook }).default;

  const realCallAsync = Meteor.callAsync.bind(Meteor);
  const realUser = Meteor.user.bind(Meteor);
  function stubCallAsync(impl: (name: string, ...args: unknown[]) => Promise<unknown>) {
    (Meteor as unknown as { callAsync: typeof Meteor.callAsync }).callAsync = impl as typeof Meteor.callAsync;
  }
  function stubUser(user: unknown) {
    (Meteor as unknown as { user: typeof Meteor.user }).user = (() => user) as typeof Meteor.user;
  }
  afterEach(() => {
    (Meteor as unknown as { callAsync: typeof Meteor.callAsync }).callAsync = realCallAsync;
    (Meteor as unknown as { user: typeof Meteor.user }).user = realUser;
  });

  async function mountUseEntityForm<V, M extends { _id?: string }>(model: M, options: UseEntityFormOptions<V>) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const captured: { current: UseEntityForm<V, M> | null } = { current: null };
    const resolved: unknown[] = [];

    const fakeFrame = {
      model,
      resolve: (value: unknown) => resolved.push(value),
      cancel: () => {},
      confirmCloseRef: { current: null },
      footerContainer: null,
    };

    function Probe() {
      captured.current = useEntityForm<V, M>(options);
      return null;
    }

    const root = ReactDOMClient.createRoot(container);
    await act(async () => {
      root.render(
        <App>
          <LanguageProvider>
            <FrameContext.Provider value={fakeFrame}>
              <Probe />
            </FrameContext.Provider>
          </LanguageProvider>
        </App>
      );
    });

    return {
      get current() {
        return captured.current!;
      },
      resolved,
      unmount: async () => {
        await act(async () => {
          root.unmount();
        });
        container.remove();
      },
    };
  }

  describe('useEntityForm — React wiring of the EntityForm seam', () => {
    it('returns { onFinish, loading:false, model, cancel } and re-exposes the frame model', async () => {
      stubUser(null);
      stubCallAsync(async () => undefined);
      const model = { _id: 'sq1', name: 'Alpha' };
      const hook = await mountUseEntityForm(model, {
        collection: 'squads',
        created: 'messages.squadCreated',
        updated: 'messages.squadUpdated',
      });
      assert.strictEqual(typeof hook.current.onFinish, 'function');
      assert.strictEqual(hook.current.loading, false);
      assert.strictEqual(typeof hook.current.cancel, 'function');
      assert.deepStrictEqual(hook.current.model, model);
      await hook.unmount();
    });

    it('updates (calls <c>.update with [id, payload]) and resolves the frame with the existing id when a user is present', async () => {
      stubUser({ _id: 'u1' });
      const seen: unknown[][] = [];
      stubCallAsync(async (name, ...args) => {
        seen.push([name, ...args]);
        return 'ignored-return';
      });
      const hook = await mountUseEntityForm(
        { _id: 'sq1', name: 'Alpha' },
        {
          collection: 'squads',
          created: 'messages.squadCreated',
          updated: 'messages.squadUpdated',
          toPayload: (v: { name?: string }) => ({ name: v.name }),
        }
      );
      await act(async () => {
        await hook.current.onFinish({ name: 'Bravo' });
      });
      assert.deepStrictEqual(seen, [['squads.update', 'sq1', { name: 'Bravo' }]]);
      assert.deepStrictEqual(hook.resolved, ['sq1']);
      await hook.unmount();
    });

    it('inserts (calls <c>.insert with [payload]) and resolves the frame with the returned id when anonymous (even with a model id)', async () => {
      stubUser(null);
      const seen: unknown[][] = [];
      stubCallAsync(async (name, ...args) => {
        seen.push([name, ...args]);
        return 'new-id';
      });
      const hook = await mountUseEntityForm(
        { _id: 'sq1' },
        {
          collection: 'squads',
          created: 'messages.squadCreated',
          updated: 'messages.squadUpdated',
          toPayload: (v: { name?: string }) => ({ name: v.name }),
        }
      );
      await act(async () => {
        await hook.current.onFinish({ name: 'Charlie' });
      });
      assert.deepStrictEqual(seen, [['squads.insert', { name: 'Charlie' }]]);
      // Anonymous always inserts, so the new id from the server is resolved.
      assert.deepStrictEqual(hook.resolved, ['new-id']);
      await hook.unmount();
    });

    it('does not resolve the frame on failure', async () => {
      stubUser({ _id: 'u1' });
      stubCallAsync(async () => {
        throw new Meteor.Error('forbidden', 'Not allowed');
      });
      const hook = await mountUseEntityForm(
        { _id: 'sq1' },
        { collection: 'squads', created: 'messages.squadCreated', updated: 'messages.squadUpdated' }
      );
      await act(async () => {
        await hook.current.onFinish({} as never);
      });
      assert.strictEqual(hook.resolved.length, 0);
      await hook.unmount();
    });
  });
}
