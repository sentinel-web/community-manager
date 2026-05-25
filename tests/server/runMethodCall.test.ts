import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { runMethodCall, type MethodCallFeedback } from '/imports/ui/hooks/runMethodCall';

// Pure policy core of the MethodCall seam — no React, no DOM, so it runs in the
// server test context (unlike the browser-only useMethod hook wiring test).

function makeSpy() {
  const calls: unknown[][] = [];
  const fn = (...args: unknown[]): void => {
    calls.push(args);
  };
  return { fn, calls };
}

function makeFeedback() {
  const success = makeSpy();
  const error = makeSpy();
  const feedback: MethodCallFeedback = {
    notifySuccess: content => success.fn(content),
    notifyError: content => error.fn(content),
  };
  return { feedback, success, error };
}

describe('runMethodCall — the MethodCall policy core', () => {
  it('resolves { ok:true, data } on success', async () => {
    const { feedback } = makeFeedback();
    const result = await runMethodCall<string>(async () => 'new-id', {}, feedback);
    assert.deepStrictEqual(result, { ok: true, data: 'new-id' });
  });

  it('treats a method resolving to undefined as ok (void method, not a failure)', async () => {
    const { feedback } = makeFeedback();
    const result = await runMethodCall(async () => undefined, {}, feedback);
    // The discriminated shape is the whole point: void success !== failure.
    assert.deepStrictEqual(result, { ok: true, data: undefined });
  });

  it('notifies success with a static string', async () => {
    const { feedback, success } = makeFeedback();
    await runMethodCall(async () => 'id', { success: 'Saved' }, feedback);
    assert.deepStrictEqual(success.calls, [['Saved']]);
  });

  it('notifies success with a (data)=>string function of the result', async () => {
    const { feedback, success } = makeFeedback();
    await runMethodCall<string>(async () => 'created-id', { success: data => `made ${data}` }, feedback);
    assert.deepStrictEqual(success.calls, [['made created-id']]);
  });

  it('does not notify success when no success option is given (reads)', async () => {
    const { feedback, success } = makeFeedback();
    await runMethodCall(async () => [{ value: 'a' }], {}, feedback);
    assert.strictEqual(success.calls.length, 0);
  });

  it('resolves { ok:false, error } WITHOUT throwing on a Meteor.Error', async () => {
    const { feedback } = makeFeedback();
    const thrown = new Meteor.Error('forbidden', 'Not allowed');
    const result = await runMethodCall(
      async () => {
        throw thrown;
      },
      {},
      feedback
    );
    assert.ok(result.ok === false);
    assert.strictEqual(result.error, thrown);
  });

  it('notifies error with err.error as message and the clean err.reason as description', async () => {
    const { feedback, error } = makeFeedback();
    const thrown = new Meteor.Error('forbidden', 'Not allowed');
    await runMethodCall(
      async () => {
        throw thrown;
      },
      {},
      feedback
    );
    // One canonical extraction: message = err.error (the code); description =
    // the clean reason, dropping the "[<code>]" suffix Meteor appends to .message.
    assert.deepStrictEqual(error.calls, [[{ message: 'forbidden', description: 'Not allowed' }]]);
  });

  it('falls back to err.message for the description when the error carries no reason', async () => {
    const { feedback, error } = makeFeedback();
    const thrown = new Meteor.Error('boom');
    await runMethodCall(
      async () => {
        throw thrown;
      },
      {},
      feedback
    );
    assert.deepStrictEqual(error.calls, [[{ message: 'boom', description: thrown.message }]]);
  });

  it('stays silent when notify:false, but still returns { ok:false, error }', async () => {
    const { feedback, error } = makeFeedback();
    const thrown = new Meteor.Error('taken', 'Name taken');
    const result = await runMethodCall(
      async () => {
        throw thrown;
      },
      { notify: false },
      feedback
    );
    assert.strictEqual(error.calls.length, 0);
    assert.ok(result.ok === false);
    assert.strictEqual(result.error, thrown);
  });

  it('does not notify success on failure, nor error on success', async () => {
    const ok = makeFeedback();
    await runMethodCall(async () => 'id', { success: 'Saved' }, ok.feedback);
    assert.strictEqual(ok.error.calls.length, 0);

    const bad = makeFeedback();
    await runMethodCall(
      async () => {
        throw new Meteor.Error('x', 'y');
      },
      { success: 'Saved' },
      bad.feedback
    );
    assert.strictEqual(bad.success.calls.length, 0);
  });
});
