/* global describe, it */
import assert from 'node:assert';

// Use require() instead of import to avoid circular dependency issues
// between crud.lib.js and main.js during module initialization.
// By the time tests run, all modules are fully initialized.
function loadGetCollection() {
  return require('../../server/crud.lib').getCollection;
}

const VALID_COLLECTIONS = [
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
    assert.throws(() => getCollection(null), error => error.error === 400);
  });

  it('throws Meteor.Error(400) for undefined input', () => {
    const getCollection = loadGetCollection();
    assert.throws(() => getCollection(undefined), error => error.error === 400);
  });

  it('throws Meteor.Error(400) for empty string', () => {
    const getCollection = loadGetCollection();
    assert.throws(() => getCollection(''), error => error.error === 400);
  });

  it('throws Meteor.Error(404) for unknown collection name', () => {
    const getCollection = loadGetCollection();
    assert.throws(() => getCollection('nonExistent'), error => error.error === 404);
  });
});
