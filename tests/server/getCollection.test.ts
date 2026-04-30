import assert from 'node:assert';
import type { Meteor } from 'meteor/meteor';
import type { getCollection as getCollectionType } from '../../server/crud.lib';
import type { CrudCollectionName } from '/imports/api/types';

// Use require() instead of import to avoid circular dependency issues
// between crud.lib.ts and main.ts during module initialization.
// By the time tests run, all modules are fully initialized.
function loadGetCollection(): typeof getCollectionType {
  return require('../../server/crud.lib').getCollection;
}

const VALID_COLLECTIONS: CrudCollectionName[] = [
  'attendances',
  'discoveryTypes',
  'events',
  'eventTypes',
  'logs',
  'medals',
  'members',
  'positions',
  'profilePictures',
  'questionnaires',
  'questionnaireResponses',
  'ranks',
  'registrations',
  'roles',
  'specializations',
  'squads',
  'tasks',
  'taskStatus',
];

describe('getCollection', () => {
  for (const name of VALID_COLLECTIONS) {
    it(`returns a collection for '${name}'`, () => {
      const getCollection = loadGetCollection();
      const collection = getCollection(name);
      assert.ok(collection, `Expected a collection for '${name}'`);
      assert.strictEqual(typeof collection.find, 'function', `Collection '${name}' should have a find method`);
    });
  }

  it('throws Meteor.Error(400) for null input', () => {
    const getCollection = loadGetCollection();
    assert.throws(() => getCollection(null as unknown as CrudCollectionName), (error: unknown) => (error as Meteor.Error).error === 400);
  });

  it('throws Meteor.Error(400) for undefined input', () => {
    const getCollection = loadGetCollection();
    assert.throws(() => getCollection(undefined as unknown as CrudCollectionName), (error: unknown) => (error as Meteor.Error).error === 400);
  });

  it('throws Meteor.Error(400) for empty string', () => {
    const getCollection = loadGetCollection();
    assert.throws(() => getCollection('' as CrudCollectionName), (error: unknown) => (error as Meteor.Error).error === 400);
  });

  it('throws Meteor.Error(404) for unknown collection name', () => {
    const getCollection = loadGetCollection();
    assert.throws(() => getCollection('nonExistent' as CrudCollectionName), (error: unknown) => (error as Meteor.Error).error === 404);
  });
});
