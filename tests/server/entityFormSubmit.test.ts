import assert from 'node:assert';
import { entityArgs, entityIsUpdate, entityMethodName, entityResolveValue } from '/imports/ui/hooks/entityFormSubmit';

// Pure DOM-free core of the EntityForm seam — the create-vs-update logic (see
// CONTEXT.md → EntityForm). No React, no antd, no Meteor runtime, so it runs in
// the server test context; the hook's React wiring is the browser-only smoke test.

describe('entityFormSubmit — the EntityForm logic core', () => {
  describe('entityIsUpdate', () => {
    it('is true only when there is a user AND a model id', () => {
      assert.strictEqual(entityIsUpdate(true, 'abc'), true);
    });

    it('is false when there is a model id but no user (anonymous always inserts)', () => {
      assert.strictEqual(entityIsUpdate(false, 'abc'), false);
    });

    it('is false when there is a user but no model id (create)', () => {
      assert.strictEqual(entityIsUpdate(true, undefined), false);
    });

    it('is false when there is neither a user nor a model id', () => {
      assert.strictEqual(entityIsUpdate(false, undefined), false);
    });
  });

  describe('entityMethodName', () => {
    it('derives <collection>.update when updating', () => {
      assert.strictEqual(entityMethodName('squads', true), 'squads.update');
    });

    it('derives <collection>.insert when creating', () => {
      assert.strictEqual(entityMethodName('squads', false), 'squads.insert');
    });
  });

  describe('entityArgs', () => {
    it('shapes [modelId, payload] when updating', () => {
      assert.deepStrictEqual(entityArgs(true, 'abc', { name: 'Alpha' }), ['abc', { name: 'Alpha' }]);
    });

    it('shapes [payload] when creating', () => {
      assert.deepStrictEqual(entityArgs(false, undefined, { name: 'Alpha' }), [{ name: 'Alpha' }]);
    });

    it('omits the id when inserting even if a stale id is passed', () => {
      assert.deepStrictEqual(entityArgs(false, 'abc', { name: 'Alpha' }), [{ name: 'Alpha' }]);
    });
  });

  describe('entityResolveValue', () => {
    it('prefers the existing model id (update resolves the same doc)', () => {
      assert.strictEqual(entityResolveValue('abc', 'new-id'), 'abc');
    });

    it('falls back to the returned data (insert resolves the new id)', () => {
      assert.strictEqual(entityResolveValue(undefined, 'new-id'), 'new-id');
    });

    it('falls back to the returned data when both are absent', () => {
      assert.strictEqual(entityResolveValue(undefined, undefined), undefined);
    });
  });
});
