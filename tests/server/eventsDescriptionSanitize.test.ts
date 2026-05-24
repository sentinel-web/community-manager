import assert from 'node:assert';
import EventsCollection from '../../imports/api/collections/events.collection';
import { callAs, cleanupFixtures, createTestRole, createTestUser } from './fixtures';

// Event descriptions became rich text in the Briefing Editor feature; like
// briefing-template content they must be sanitized on the server write path
// (ADR 0001). These tests assert the events.description sanitize-on-write.

describe('crud.lib — events description sanitize-on-write', () => {
  let adminUserId: string;
  let insertedId: string;

  before(async () => {
    const adminRoleId = await createTestRole({ roles: true });
    adminUserId = await createTestUser({ roleId: adminRoleId });
  });

  after(async () => {
    await cleanupFixtures([EventsCollection]);
  });

  it('sanitizes description HTML on insert', async () => {
    insertedId = (await callAs(adminUserId, 'events.insert', {
      name: '__test_event_xss',
      start: new Date('2026-01-01T10:00:00Z'),
      end: new Date('2026-01-01T12:00:00Z'),
      description: '<p>briefing</p><script>alert(1)</script>',
    })) as string;
    const doc = await EventsCollection.findOneAsync(insertedId);
    assert.ok(doc, 'Expected event to be persisted');
    assert.ok(!/<script/i.test(doc.description || ''), `script survived insert: ${doc.description}`);
    assert.ok((doc.description || '').includes('<p>briefing</p>'), 'benign markup should survive');
  });

  it('sanitizes description HTML on update', async () => {
    await callAs(adminUserId, 'events.update', insertedId, {
      description: '<p>updated</p><img src=x onerror="hack()">',
    });
    const doc = await EventsCollection.findOneAsync(insertedId);
    assert.ok(doc);
    assert.ok(!/onerror/i.test(doc.description || ''), `onerror survived update: ${doc.description}`);
    assert.ok((doc.description || '').includes('<p>updated</p>'));
  });
});
