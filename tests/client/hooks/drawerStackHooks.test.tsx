import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import React, { type ReactNode } from 'react';

// React rendering tests only run in the Meteor client test context where the
// browser supplies a DOM. The pure store covers the same behaviour without
// needing one.
if (Meteor.isClient) {
  const ReactDOMClient = require('react-dom/client') as typeof import('react-dom/client');
  const { act } = require('react-dom/test-utils') as { act: (cb: () => void | Promise<void>) => Promise<void> };

  type DrawerStackProviderModuleShape = typeof import('/imports/ui/drawer-stack/DrawerStackProvider');
  type UseDrawerStackHook = typeof import('/imports/ui/drawer-stack/useDrawerStack').default;
  type UseDrawerFrameHook = typeof import('/imports/ui/drawer-stack/useDrawerFrame').default;
  type UseConfirmCloseHook = typeof import('/imports/ui/drawer-stack/useConfirmClose').default;

  const DrawerStackProviderModule = require('/imports/ui/drawer-stack/DrawerStackProvider') as DrawerStackProviderModuleShape;
  const DrawerStackProvider = DrawerStackProviderModule.default;
  const { FrameContext } = DrawerStackProviderModule;
  const useDrawerStack = (require('/imports/ui/drawer-stack/useDrawerStack') as { default: UseDrawerStackHook }).default;
  const useDrawerFrame = (require('/imports/ui/drawer-stack/useDrawerFrame') as { default: UseDrawerFrameHook }).default;
  const useConfirmClose = (require('/imports/ui/drawer-stack/useConfirmClose') as { default: UseConfirmCloseHook }).default;

  type Captured<T> = { current: T | null; error: Error | null };

  async function renderHook<T>(useHook: () => T, wrapper?: (children: ReactNode) => ReactNode): Promise<Captured<T> & { unmount: () => Promise<void> }> {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const captured: Captured<T> = { current: null, error: null };

    function Probe() {
      try {
        // Test harness: the hook-under-test is invoked here to capture its
        // result/throw; the try/catch is intentional.
        // eslint-disable-next-line react-hooks/rules-of-hooks
        captured.current = useHook();
      } catch (error) {
        captured.error = error as Error;
      }
      return null;
    }

    const root = ReactDOMClient.createRoot(container);
    const element = wrapper ? wrapper(<Probe />) : <Probe />;
    await act(async () => {
      root.render(element as React.ReactElement);
    });
    return {
      ...captured,
      get current() {
        return captured.current;
      },
      get error() {
        return captured.error;
      },
      unmount: async () => {
        await act(async () => {
          root.unmount();
        });
        container.remove();
      },
    } as Captured<T> & { unmount: () => Promise<void> };
  }

  describe('useDrawerStack — opener hook', () => {
    it('returns { push } when used inside <DrawerStackProvider>', async () => {
      const result = await renderHook(useDrawerStack, children => <DrawerStackProvider>{children}</DrawerStackProvider>);
      assert.strictEqual(result.error, null);
      assert.ok(result.current);
      assert.strictEqual(typeof result.current!.push, 'function');
      await result.unmount();
    });

    it('throws a clear error when used outside a provider', async () => {
      const result = await renderHook(useDrawerStack);
      assert.ok(result.error instanceof Error);
      assert.match(result.error!.message, /DrawerStackProvider/);
      await result.unmount();
    });
  });

  describe('useDrawerFrame — form-side hook', () => {
    it('returns { model, resolve, cancel } from the nearest frame context', async () => {
      const fakeFrame = {
        model: { hello: 'world' },
        resolve: () => {},
        cancel: () => {},
        confirmCloseRef: { current: null },
        footerContainer: null,
      };
      const result = await renderHook(useDrawerFrame, children => (
        <FrameContext.Provider value={fakeFrame}>{children}</FrameContext.Provider>
      ));
      assert.strictEqual(result.error, null);
      assert.deepStrictEqual(result.current!.model, { hello: 'world' });
      assert.strictEqual(typeof result.current!.resolve, 'function');
      assert.strictEqual(typeof result.current!.cancel, 'function');
      await result.unmount();
    });

    it('throws a clear error when used outside any frame', async () => {
      const result = await renderHook(useDrawerFrame);
      assert.ok(result.error instanceof Error);
      assert.match(result.error!.message, /useDrawerFrame/);
      await result.unmount();
    });
  });

  describe('useConfirmClose — close-confirmation registration', () => {
    it('writes the predicate into the frame confirmCloseRef on every render', async () => {
      const ref: { current: null | (() => boolean | Promise<boolean>) } = { current: null };
      const fakeFrame = {
        model: {},
        resolve: () => {},
        cancel: () => {},
        confirmCloseRef: ref,
        footerContainer: null,
      };
      const predicate = () => false;
      await renderHook(() => useConfirmClose(predicate), children => (
        <FrameContext.Provider value={fakeFrame}>{children}</FrameContext.Provider>
      ));
      assert.strictEqual(ref.current, predicate);
    });

    it('throws a clear error when used outside any frame', async () => {
      const result = await renderHook(() => useConfirmClose(() => true));
      assert.ok(result.error instanceof Error);
      assert.match(result.error!.message, /useConfirmClose/);
      await result.unmount();
    });
  });
}
