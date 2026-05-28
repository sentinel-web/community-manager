import assert from 'node:assert';
import { Meteor } from 'meteor/meteor';
import { runMutation } from '../../server/mutation-pipeline';
import {
  setTelemetryExporter,
  type TelemetryExporter,
  type TelemetryRecord,
} from '../../server/telemetry';
import LogsCollection from '../../imports/api/collections/logs.collection';
import MedalsCollection from '../../imports/api/collections/medals.collection';
import { assertRejectsWithCode, cleanupFixtures, createTestRole, createTestUser } from './fixtures';

const FAKE_COLLECTION = '__telemetry_test';

async function cleanTelemetryLogs(): Promise<void> {
  await LogsCollection.removeAsync({ action: { $regex: `^${FAKE_COLLECTION}\\.` } });
}

// Spy exporter: captures every emitted record so the test can assert the count
// and outcome. Installed per-test and restored in afterEach.
function makeSpy(): { records: TelemetryRecord[]; exporter: TelemetryExporter } {
  const records: TelemetryRecord[] = [];
  return { records, exporter: record => records.push(record) };
}

describe('telemetry — runMutation emits exactly one record per call', () => {
  let adminUserId: string;
  let readerUserId: string;
  let restoreExporter: TelemetryExporter;
  let records: TelemetryRecord[];

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

  beforeEach(() => {
    const spy = makeSpy();
    records = spy.records;
    restoreExporter = setTelemetryExporter(spy.exporter);
  });

  afterEach(async () => {
    setTelemetryExporter(restoreExporter);
    await cleanTelemetryLogs();
  });

  after(async () => {
    await cleanupFixtures([MedalsCollection]);
  });

  it("ok — exactly one record with outcome 'ok' and the method name", async () => {
    const result = await runMutation(
      { userId: adminUserId },
      { collection: FAKE_COLLECTION, operation: 'create', permissionModule: 'medals' },
      [],
      async () => 'sentinel',
    );

    assert.strictEqual(result, 'sentinel', 'return value must pass through unchanged');
    assert.strictEqual(records.length, 1, 'exactly one telemetry record per call');
    assert.strictEqual(records[0].outcome, 'ok');
    assert.strictEqual(records[0].method, `${FAKE_COLLECTION}.insert`);
    assert.ok(typeof records[0].durationMs === 'number' && records[0].durationMs >= 0);
    assert.ok(typeof records[0].timestamp === 'number');
  });

  it("denied — exactly one record with outcome 'denied' (permission denied, body never runs)", async () => {
    let bodyRan = false;
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: readerUserId },
          { collection: FAKE_COLLECTION, operation: 'create', permissionModule: 'medals' },
          [],
          async () => {
            bodyRan = true;
            return null;
          },
        ),
      403,
    );

    assert.strictEqual(bodyRan, false);
    assert.strictEqual(records.length, 1, 'exactly one telemetry record per call');
    assert.strictEqual(records[0].outcome, 'denied');
    assert.strictEqual(records[0].method, `${FAKE_COLLECTION}.insert`);
  });

  it("body-error — exactly one record with outcome 'error', original error preserved", async () => {
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: adminUserId },
          { collection: FAKE_COLLECTION, operation: 'create', permissionModule: 'medals' },
          [],
          async () => {
            throw new Meteor.Error('original-code', 'body failed');
          },
        ),
      'original-code',
    );

    assert.strictEqual(records.length, 1, 'exactly one telemetry record per call');
    assert.strictEqual(records[0].outcome, 'error');
    assert.strictEqual(records[0].method, `${FAKE_COLLECTION}.insert`);
  });

  it("denied — missing userId maps to 'denied' (401, pre-body)", async () => {
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: null },
          { collection: FAKE_COLLECTION, operation: 'update', permissionModule: 'medals' },
          [],
          async () => null,
        ),
      401,
    );

    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].outcome, 'denied');
    assert.strictEqual(records[0].method, `${FAKE_COLLECTION}.update`);
  });

  it("denied — validation failure maps to 'denied'", async () => {
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: adminUserId },
          {
            collection: FAKE_COLLECTION,
            operation: 'create',
            permissionModule: 'medals',
            validate: () => {
              throw new Meteor.Error('bad-shape', 'invalid');
            },
          },
          [],
          async () => null,
        ),
      'bad-shape',
    );

    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].outcome, 'denied');
  });
});

// Safety invariant of additive instrumentation: a THROWING exporter (e.g. a
// flaky OTLP endpoint) must be fully transparent to the mutation. The throw is
// swallowed at the telemetry boundary (recordTelemetry's try/catch) and must
// never surface as a return value, nor mask/replace a real body error.
describe('telemetry — a throwing exporter must not break the mutation', () => {
  let adminUserId: string;
  let restoreExporter: TelemetryExporter;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  beforeEach(() => {
    restoreExporter = setTelemetryExporter(() => {
      throw new Error('exporter down');
    });
  });

  afterEach(async () => {
    setTelemetryExporter(restoreExporter);
    await cleanTelemetryLogs();
  });

  after(async () => {
    await cleanupFixtures([MedalsCollection]);
  });

  it('ok — successful mutation still returns its normal result (exporter throw swallowed)', async () => {
    const result = await runMutation(
      { userId: adminUserId },
      { collection: FAKE_COLLECTION, operation: 'create', permissionModule: 'medals' },
      [],
      async () => 'sentinel',
    );

    assert.strictEqual(result, 'sentinel', 'exporter throw must not propagate; result passes through unchanged');
  });

  it('body-error — original Meteor.Error code still propagates (exporter throw does not mask it)', async () => {
    await assertRejectsWithCode(
      () =>
        runMutation(
          { userId: adminUserId },
          { collection: FAKE_COLLECTION, operation: 'create', permissionModule: 'medals' },
          [],
          async () => {
            throw new Meteor.Error('original-code', 'body failed');
          },
        ),
      'original-code',
    );
  });
});
