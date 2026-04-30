import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import RolesCollection from '../../imports/api/collections/roles.collection';
import LogsCollection from '../../imports/api/collections/logs.collection';
import { clearRoleCache } from '../../server/main';

// Fixture _ids start with this prefix so cleanupFixtures can scope a range
// query on the indexed _id field (IXSCAN, not COLLSCAN).
export const TEST_PREFIX = 'test_';
const TEST_PREFIX_END = 'test`'; // next char after '_' (0x5F) is '`' (0x60)
const prefixFilter = { _id: { $gte: TEST_PREFIX, $lt: TEST_PREFIX_END } };

function prefixedId() {
  return `${TEST_PREFIX}${Random.id()}`;
}

export async function createTestRole(permissions = {}) {
  const _id = prefixedId();
  await RolesCollection.insertAsync({ _id, name: `Test Role ${_id}`, ...permissions });
  return _id;
}

export async function createTestUser({ roleId, profile = {} } = {}) {
  const _id = prefixedId();
  await Meteor.users.insertAsync({
    _id,
    username: _id,
    profile: { name: `Test ${_id}`, roleId, ...profile },
  });
  return _id;
}

export async function createTestDoc(Collection, data = {}) {
  const _id = prefixedId();
  await Collection.insertAsync({ _id, ...data });
  return _id;
}

// Invokes a Meteor method handler directly with a synthetic `this.userId`
// context — bypasses DDP so tests don't need a logged-in connection.
export async function callAs(userId, methodName, ...args) {
  const handler = Meteor.server.method_handlers[methodName];
  if (!handler) throw new Error(`Method "${methodName}" is not registered`);
  return handler.apply({ userId }, args);
}

export async function assertRejectsWithCode(fn, code) {
  await assert.rejects(fn, error => error.error === code);
}

export async function findLatestAuditLog(action, payloadId) {
  return LogsCollection.findOneAsync(
    { action, 'payload.id': payloadId },
    { sort: { createdAt: -1 }, limit: 1 },
  );
}

// Removes fixture-created docs across users, roles, audit logs, and any
// extra collections the caller passes in. The `extraCollections` param
// keeps cleanup scoped — callers declare what they touched rather than
// wiping every collection defensively.
export async function cleanupFixtures(extraCollections = []) {
  await Promise.all([
    Meteor.users.removeAsync(prefixFilter),
    RolesCollection.removeAsync(prefixFilter),
    LogsCollection.removeAsync({ 'payload.id': { $gte: TEST_PREFIX, $lt: TEST_PREFIX_END } }),
    ...extraCollections.map(Collection => Collection.removeAsync(prefixFilter)),
  ]);
  clearRoleCache();
}
