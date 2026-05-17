import assert from 'node:assert';
import React, { type ComponentType } from 'react';
import { createDrawerStackStore } from '/imports/ui/drawer-stack/drawerStackStore';

const Noop: ComponentType<unknown> = () => null;

function basePush(store: ReturnType<typeof createDrawerStackStore>, title = 'frame') {
  return store.push<string, Record<string, unknown>>({
    title,
    Component: Noop,
    model: {},
  });
}

// Drains microtasks so we can surface a clear failure if a promise we expect
// to remain pending has already resolved, rather than blocking the test
// runner forever waiting on a promise that will never settle.
async function expectStillPending(promise: Promise<unknown>): Promise<void> {
  let resolved = false;
  promise.then(() => {
    resolved = true;
  });
  await new Promise(r => setImmediate(r));
  await new Promise(r => setImmediate(r));
  assert.strictEqual(resolved, false, 'expected promise to remain pending');
}

describe('drawerStackStore — pure state machine for the DrawerStack', () => {
  it('push() returns a promise; resolveFrame(id, value) fulfils it with value', async () => {
    const store = createDrawerStackStore();
    const pending = basePush(store);
    const [frame] = store.getSnapshot();
    store.resolveFrame(frame.id, 'inserted-id');
    assert.strictEqual(await pending, 'inserted-id');
  });

  it('push() returns a promise; user-initiated close fulfils it with undefined', async () => {
    const store = createDrawerStackStore();
    const pending = basePush(store);
    const [frame] = store.getSnapshot();
    await store.tryClose(frame.id);
    assert.strictEqual(await pending, undefined);
  });

  it('confirmClose returning false aborts the close; the promise stays pending', async () => {
    const store = createDrawerStackStore();
    const pending = basePush(store);
    const [frame] = store.getSnapshot();
    frame.confirmCloseRef.current = () => false;
    await store.tryClose(frame.id);
    assert.strictEqual(store.getSnapshot().length, 1, 'frame should still be on the stack');
    await expectStillPending(pending);
    // Resolve to clean up
    store.resolveFrame(frame.id, 'done');
    await pending;
  });

  it('confirmClose returning Promise<false> aborts; awaited correctly', async () => {
    const store = createDrawerStackStore();
    const pending = basePush(store);
    const [frame] = store.getSnapshot();
    frame.confirmCloseRef.current = async () => false;
    await store.tryClose(frame.id);
    assert.strictEqual(store.getSnapshot().length, 1);
    await expectStillPending(pending);
    store.cancelFrame(frame.id);
    assert.strictEqual(await pending, undefined);
  });

  it('pushing N frames produces N frames on the snapshot (renderer maps 1:1)', () => {
    const store = createDrawerStackStore();
    void basePush(store, 'a');
    void basePush(store, 'b');
    void basePush(store, 'c');
    const snapshot = store.getSnapshot();
    assert.strictEqual(snapshot.length, 3);
    assert.deepStrictEqual(
      snapshot.map(f => f.title),
      ['a', 'b', 'c']
    );
  });

  it('cascade-down: resolving frame K causes K+1..N to fulfil with undefined before K settles', async () => {
    const store = createDrawerStackStore();
    const pA = basePush(store, 'a');
    const pB = basePush(store, 'b');
    const pC = basePush(store, 'c');
    const settleOrder: string[] = [];
    pA.then(v => settleOrder.push(`a:${String(v)}`));
    pB.then(v => settleOrder.push(`b:${String(v)}`));
    pC.then(v => settleOrder.push(`c:${String(v)}`));
    const [frameA] = store.getSnapshot();
    store.resolveFrame(frameA.id, 'a-value');
    const [vA, vB, vC] = await Promise.all([pA, pB, pC]);
    assert.strictEqual(vA, 'a-value');
    assert.strictEqual(vB, undefined);
    assert.strictEqual(vC, undefined);
    // C and B fulfilled before A — top-to-bottom cascade
    assert.deepStrictEqual(settleOrder, ['c:undefined', 'b:undefined', 'a:a-value']);
    assert.strictEqual(store.getSnapshot().length, 0);
  });

  it('frame isolation: each frame retains its own model on the snapshot', () => {
    const store = createDrawerStackStore();
    void store.push({ title: 't1', Component: Noop, model: { kind: 'first' } });
    void store.push({ title: 't2', Component: Noop, model: { kind: 'second' } });
    const [f1, f2] = store.getSnapshot();
    assert.deepStrictEqual(f1.model, { kind: 'first' });
    assert.deepStrictEqual(f2.model, { kind: 'second' });
    assert.notStrictEqual(f1.resolveFn, f2.resolveFn);
    assert.notStrictEqual(f1.confirmCloseRef, f2.confirmCloseRef);
  });

  it('cancelFrame(id) is equivalent to resolveFrame(id, undefined)', async () => {
    const store = createDrawerStackStore();
    const pending = basePush(store);
    const [frame] = store.getSnapshot();
    store.cancelFrame(frame.id);
    assert.strictEqual(await pending, undefined);
    assert.strictEqual(store.getSnapshot().length, 0);
  });

  it('tryClose ignores non-top frames (defensive — antd UX only allows closing the top)', async () => {
    const store = createDrawerStackStore();
    const pA = basePush(store, 'a');
    const pB = basePush(store, 'b');
    const [frameA] = store.getSnapshot();
    await store.tryClose(frameA.id);
    // Nothing changes — frame A is not the top.
    assert.strictEqual(store.getSnapshot().length, 2);
    await expectStillPending(pA);
    await expectStillPending(pB);
    store.resolveFrame(frameA.id, 'cleanup');
    await Promise.all([pA, pB]);
  });

  it('settling is idempotent: resolveFrame on an already-removed frame is a no-op', async () => {
    const store = createDrawerStackStore();
    const pending = basePush(store);
    const [frame] = store.getSnapshot();
    store.resolveFrame(frame.id, 'first');
    store.resolveFrame(frame.id, 'second');
    assert.strictEqual(await pending, 'first');
  });

  it('subscribe() notifies listeners on push, resolve, and cancel', () => {
    const store = createDrawerStackStore();
    let calls = 0;
    const unsubscribe = store.subscribe(() => {
      calls++;
    });
    void basePush(store);
    const [frame] = store.getSnapshot();
    store.resolveFrame(frame.id, 'x');
    unsubscribe();
    void basePush(store);
    // 2 calls before unsubscribe (push + resolve), nothing after.
    assert.strictEqual(calls, 2);
  });
});

describe('drawerStackStore — guards', () => {
  it('Noop component is a valid Component option', () => {
    // Sanity: the test fixture renders to null without error.
    const element = React.createElement(Noop);
    assert.ok(element !== null);
  });
});
