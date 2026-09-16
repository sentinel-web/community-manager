import assert from 'node:assert';
import TasksCollection from '../../imports/api/collections/tasks.collection';
import { callAs, cleanupFixtures, createTestRole, createTestUser } from './fixtures';

describe('tasks createdAt — server-owned creation timestamp (#377)', () => {
  let editorUserId: string;

  before(async () => {
    const roleId = await createTestRole({ tasks: { read: true, create: true, update: true, delete: false } });
    editorUserId = await createTestUser({ roleId });
  });

  after(async () => {
    await cleanupFixtures([TasksCollection]);
  });

  async function insertTask(name: string, extra: Record<string, unknown> = {}): Promise<string> {
    return (await callAs(editorUserId, 'tasks.insert', { name, ...extra })) as string;
  }

  it('stamps createdAt on insert', async () => {
    const before = Date.now();
    const id = await insertTask('__test_task_created');
    const doc = await TasksCollection.findOneAsync(id);
    assert.ok(doc?.createdAt instanceof Date, 'createdAt must be a server-set Date');
    assert.ok(doc.createdAt.getTime() >= before && doc.createdAt.getTime() <= Date.now(), 'createdAt must be the insert time');
  });

  it('ignores a client-supplied createdAt on insert', async () => {
    const before = Date.now();
    const id = await insertTask('__test_task_spoofed', { createdAt: new Date('2000-01-01T00:00:00Z') });
    const doc = await TasksCollection.findOneAsync(id);
    assert.ok(doc?.createdAt instanceof Date);
    assert.ok(doc.createdAt.getTime() >= before, 'A client-supplied createdAt must be overwritten by the server');
  });

  it('does not let an update overwrite createdAt', async () => {
    const id = await insertTask('__test_task_update_spoof');
    const original = (await TasksCollection.findOneAsync(id))?.createdAt;
    await callAs(editorUserId, 'tasks.update', id, { description: 'edited', createdAt: new Date('2000-01-01T00:00:00Z') });
    const doc = await TasksCollection.findOneAsync(id);
    assert.strictEqual(doc?.description, 'edited', 'The rest of the update must still apply');
    assert.deepStrictEqual(doc?.createdAt, original, 'createdAt must be immutable through update');
  });
});
