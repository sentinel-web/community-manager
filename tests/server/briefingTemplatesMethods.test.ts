import assert from 'node:assert';
import BriefingTemplatesCollection from '../../imports/api/collections/briefingTemplates.collection';
import { assertRejectsWithCode, callAs, cleanupFixtures, createTestRole, createTestUser, findLatestAuditLog } from './fixtures';

// Briefing templates are a plain CRUD collection that additionally sanitizes its
// rich-text `content` field on every write (ADR 0001). These tests cover the
// permission gating shared by all crud.lib collections plus the sanitize-on-write
// behaviour unique to rich-text collections.

describe('crud.lib — briefingTemplates permissions + sanitize-on-write', () => {
  let adminUserId: string;
  let readerUserId: string;
  let unauthorizedUserId: string;
  let insertedId: string;

  before(async () => {
    const [adminRoleId, readerRoleId, noPermRoleId] = await Promise.all([
      createTestRole({ roles: true }),
      createTestRole({ briefingTemplates: { read: true, create: false, update: false, delete: false } }),
      createTestRole({ briefingTemplates: { read: false, create: false, update: false, delete: false } }),
    ]);
    [adminUserId, readerUserId, unauthorizedUserId] = await Promise.all([
      createTestUser({ roleId: adminRoleId }),
      createTestUser({ roleId: readerRoleId }),
      createTestUser({ roleId: noPermRoleId }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([BriefingTemplatesCollection]);
  });

  it('rejects unauthenticated calls with 401', async () => {
    await assertRejectsWithCode(() => callAs(null, 'briefingTemplates.read', {}), 401);
  });

  it('non-privileged user cannot insert — 403', async () => {
    await assertRejectsWithCode(() => callAs(readerUserId, 'briefingTemplates.insert', { name: '__test_bt_denied' }), 403);
  });

  it('user without read permission is denied — 403', async () => {
    await assertRejectsWithCode(() => callAs(unauthorizedUserId, 'briefingTemplates.read', {}), 403);
  });

  it('admin can insert a template and receives a string id', async () => {
    insertedId = (await callAs(adminUserId, 'briefingTemplates.insert', {
      name: '__test_bt_alpha',
      color: '#00ff00',
      description: 'a note',
      content: '<h2>Mission</h2><p><strong>brief</strong></p>',
    })) as string;
    assert.strictEqual(typeof insertedId, 'string');
    const doc = await BriefingTemplatesCollection.findOneAsync(insertedId);
    assert.ok(doc, 'Expected briefing template to be persisted');
    assert.strictEqual(doc.name, '__test_bt_alpha');
  });

  it('insert writes an audit log entry', async () => {
    const log = await findLatestAuditLog('briefingTemplates.created', insertedId);
    assert.ok(log, 'Expected a briefingTemplates.created log entry');
  });

  it('sanitizes content HTML on insert (strips <script>)', async () => {
    const id = (await callAs(adminUserId, 'briefingTemplates.insert', {
      name: '__test_bt_xss',
      content: '<p>ok</p><script>alert(1)</script><img src=x onerror="hack()">',
    })) as string;
    const doc = await BriefingTemplatesCollection.findOneAsync(id);
    assert.ok(doc);
    assert.ok(!/<script/i.test(doc.content || ''), `script survived insert: ${doc.content}`);
    assert.ok(!/onerror/i.test(doc.content || ''), `onerror survived insert: ${doc.content}`);
    assert.ok((doc.content || '').includes('<p>ok</p>'), 'benign markup should survive');
  });

  it('sanitizes content HTML on update', async () => {
    await callAs(adminUserId, 'briefingTemplates.update', insertedId, {
      content: '<p>clean</p><script>evil()</script>',
    });
    const doc = await BriefingTemplatesCollection.findOneAsync(insertedId);
    assert.ok(doc);
    assert.ok(!/<script/i.test(doc.content || ''), `script survived update: ${doc.content}`);
    assert.ok((doc.content || '').includes('<p>clean</p>'));
  });

  it('reader can read templates', async () => {
    const docs = (await callAs(readerUserId, 'briefingTemplates.read', {})) as unknown[];
    assert.ok(Array.isArray(docs));
  });
});
