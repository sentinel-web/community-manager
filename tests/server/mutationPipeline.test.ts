import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { runMutation } from '../../server/mutation-pipeline';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import {
  assertRejectsWithCode,
  callAs,
  cleanupFixtures,
  createTestRole,
  createTestUser,
  findLatestAuditLog,
  TEST_PREFIX,
} from './fixtures';

// The wrapper's seam mechanics are exercised against a fake collection name
// (`__pipeline_test`) so denial logs and success-via-custom-audit logs can
// be cleaned up by action prefix without polluting the real Logs ranges.
const FAKE_COLLECTION = '__pipeline_test';

async function cleanPipelineLogs(): Promise<void> {
  await LogsCollection.removeAsync({ action: { $regex: `^${FAKE_COLLECTION}\\.` } });
}

async function findLatestPipelineLog(action: string): Promise<{ action: string; payload: Record<string, unknown> } | undefined> {
  return (await LogsCollection.findOneAsync(
    { action },
    { sort: { createdAt: -1 } },
  )) as { action: string; payload: Record<string, unknown> } | undefined;
}

describe('mutation-pipeline — runMutation seam mechanics', () => {
  let adminUserId: string;
  let readerUserId: string;

  before(async () => {
    const [adminRoleId, readerRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ medals: { read: true, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, readerUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: readerRoleId }),
    ]);
  });

  afterEach(async () => {
    await cleanPipelineLogs();
  });

  after(async () => {
    await cleanupFixtures([MedalsCollection]);
  });

  it('permission denied — body never invoked', async () => {
    let bodyRan = false;
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: readerUserId },
          {
            collection: FAKE_COLLECTION,
            operation: 'create',
            permissionModule: 'medals',
          },
          [],
          async () => {
            bodyRan = true;
            return null;
          },
        ),
      403,
    );
    assert.strictEqual(bodyRan, false, 'Body must not run when permission denied');
  });

  it('permission denied — emits <collection>.<op>.denied audit entry with userId', async () => {
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: readerUserId },
          {
            collection: FAKE_COLLECTION,
            operation: 'create',
            permissionModule: 'medals',
          },
          [],
          async () => null,
        ),
      403,
    );
    const log = await findLatestPipelineLog(`${FAKE_COLLECTION}.insert.denied`);
    assert.ok(log, 'Expected denial audit entry');
    assert.strictEqual(log.payload.userId, readerUserId);
  });

  it('missing userId — 401, body skipped, denial audit entry written', async () => {
    let bodyRan = false;
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: null },
          {
            collection: FAKE_COLLECTION,
            operation: 'update',
            permissionModule: 'medals',
          },
          [],
          async () => {
            bodyRan = true;
            return null;
          },
        ),
      401,
    );
    assert.strictEqual(bodyRan, false);
    const log = await findLatestPipelineLog(`${FAKE_COLLECTION}.update.denied`);
    assert.ok(log, 'Expected denial audit entry on missing userId');
    assert.strictEqual(log.payload.userId, null);
  });

  it('permission allowed — body invoked and return value passed through', async () => {
    const result = await runMutation(
      { userId: adminUserId },
      {
        collection: FAKE_COLLECTION,
        operation: 'read',
        permissionModule: 'medals',
      },
      [],
      async () => 'sentinel-value',
    );
    assert.strictEqual(result, 'sentinel-value');
  });

  it('body throws — no audit entry, original error code preserved', async () => {
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: adminUserId },
          {
            collection: FAKE_COLLECTION,
            operation: 'create',
            action: `${FAKE_COLLECTION}.created`,
            auditShape: 'insert',
            permissionModule: 'medals',
          },
          [{ name: 'irrelevant' }] as const,
          async () => {
            throw new Meteor.Error('original-code', 'body failed');
          },
        ),
      'original-code',
    );
    const successLog = await findLatestPipelineLog(`${FAKE_COLLECTION}.created`);
    assert.strictEqual(successLog, undefined, 'Body throw must not emit a success audit entry');
  });

  it('body succeeds — standard insert audit shape: { id, ...payload }', async () => {
    const fakeId = await runMutation(
      { userId: adminUserId },
      {
        collection: FAKE_COLLECTION,
        operation: 'create',
        action: `${FAKE_COLLECTION}.created`,
        auditShape: 'insert',
        permissionModule: 'medals',
      },
      [{ name: 'alpha', color: '#fff' }] as const,
      async () => 'inserted-id',
    );
    assert.strictEqual(fakeId, 'inserted-id');
    const log = await findLatestPipelineLog(`${FAKE_COLLECTION}.created`);
    assert.ok(log, 'Expected success audit entry');
    assert.deepStrictEqual(log.payload, { id: 'inserted-id', name: 'alpha', color: '#fff' });
  });

  it('body succeeds — standard update audit shape: { id, changes }', async () => {
    await runMutation(
      { userId: adminUserId },
      {
        collection: FAKE_COLLECTION,
        operation: 'update',
        action: `${FAKE_COLLECTION}.updated`,
        auditShape: 'update',
        permissionModule: 'medals',
      },
      ['target-id', { color: '#000' }] as const,
      async () => 1,
    );
    const log = await findLatestPipelineLog(`${FAKE_COLLECTION}.updated`);
    assert.ok(log);
    assert.deepStrictEqual(log.payload, { id: 'target-id', changes: { color: '#000' } });
  });

  it('body succeeds — standard remove audit shape: { id }', async () => {
    await runMutation(
      { userId: adminUserId },
      {
        collection: FAKE_COLLECTION,
        operation: 'delete',
        action: `${FAKE_COLLECTION}.deleted`,
        auditShape: 'remove',
        permissionModule: 'medals',
      },
      ['gone-id'] as const,
      async () => 1,
    );
    const log = await findLatestPipelineLog(`${FAKE_COLLECTION}.deleted`);
    assert.ok(log);
    assert.deepStrictEqual(log.payload, { id: 'gone-id' });
  });

  it('descriptor-level audit function overrides the standard shape', async () => {
    await runMutation(
      { userId: adminUserId },
      {
        collection: FAKE_COLLECTION,
        operation: 'create',
        action: `${FAKE_COLLECTION}.custom`,
        auditShape: 'insert',
        audit: (_args, result) => ({ customKey: 'customValue', result }),
        permissionModule: 'medals',
      },
      [{ name: 'should-be-ignored' }] as const,
      async () => 'r',
    );
    const log = await findLatestPipelineLog(`${FAKE_COLLECTION}.custom`);
    assert.ok(log);
    assert.deepStrictEqual(log.payload, { customKey: 'customValue', result: 'r' });
  });

  it('unconditional fallback flag permits an op when the main permission is denied', async () => {
    const fallbackRoleId = await createTestRole({
      medals: { read: false, create: false, update: false, delete: false },
      __testFallbackFlag: true,
    });
    const fallbackUserId = await createTestUser({ roleId: fallbackRoleId });

    let bodyRan = false;
    await runMutation(
      { userId: fallbackUserId },
      {
        collection: FAKE_COLLECTION,
        operation: 'create',
        permissionModule: 'medals',
        fallbackFlag: '__testFallbackFlag',
      },
      [],
      async () => {
        bodyRan = true;
        return null;
      },
    );
    assert.strictEqual(bodyRan, true, 'Body must run when fallback flag is set despite denied main permission');
  });

  it('allowAnonymous permits an op when userId is null', async () => {
    let bodyRan = false;
    const result = await runMutation(
      { userId: null },
      {
        collection: FAKE_COLLECTION,
        operation: 'create',
        permissionModule: 'medals',
        allowAnonymous: true,
      },
      [],
      async () => {
        bodyRan = true;
        return 'anonymous-result';
      },
    );
    assert.strictEqual(bodyRan, true);
    assert.strictEqual(result, 'anonymous-result');
  });

  it('validation failure — emits denial entry and propagates the validator error', async () => {
    let bodyRan = false;
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: adminUserId },
          {
            collection: FAKE_COLLECTION,
            operation: 'create',
            permissionModule: 'medals',
            validate: () => {
              throw new Meteor.Error('validate-shape', 'bad shape');
            },
          },
          [],
          async () => {
            bodyRan = true;
            return null;
          },
        ),
      'validate-shape',
    );
    assert.strictEqual(bodyRan, false);
    const log = await findLatestPipelineLog(`${FAKE_COLLECTION}.insert.denied`);
    assert.ok(log, 'Expected denial entry on validation failure');
  });
});

describe('mutation-pipeline — factory and direct call paths produce equivalent audit emissions', () => {
  // Asserts the "exactly one implementation" invariant: a Meteor method
  // generated by createCollectionMethods and a hand-rolled runMutation call
  // with the equivalent descriptor must write the same audit shape.
  let adminUserId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([MedalsCollection]);
  });

  it('factory-generated medals.insert and direct runMutation produce equivalent audit shapes', async () => {
    const factoryId = (await callAs(adminUserId, 'medals.insert', {
      name: `${TEST_PREFIX}contract_factory`,
      color: '#abcdef',
    })) as string;

    const directId = (await runMutation(
      { userId: adminUserId },
      {
        collection: 'medals',
        operation: 'create',
        action: 'medals.created',
        auditShape: 'insert',
        permissionModule: 'medals',
      },
      [{ name: `${TEST_PREFIX}contract_direct`, color: '#abcdef' }] as const,
      async ([payload]) => MedalsCollection.insertAsync(payload as never),
    )) as string;

    const factoryLog = await findLatestAuditLog('medals.created', factoryId);
    const directLog = await findLatestAuditLog('medals.created', directId);

    assert.ok(factoryLog, 'Factory-generated method must write audit log');
    assert.ok(directLog, 'Direct runMutation call must write audit log');
    assert.strictEqual(factoryLog.action, directLog.action);

    // Strip the differing ids and compare structural shape.
    const factoryShape = { ...factoryLog.payload };
    const directShape = { ...directLog.payload };
    delete factoryShape.id;
    delete factoryShape.name;
    delete directShape.id;
    delete directShape.name;
    assert.deepStrictEqual(
      Object.keys(factoryShape).sort(),
      Object.keys(directShape).sort(),
      'Factory and direct payloads must have identical key sets',
    );
    assert.strictEqual(factoryShape.color, directShape.color);
  });
});
