import assert from 'node:assert';
import LogsCollection from '../../imports/api/collections/logs.collection';
import { ensureLogRetentionIndex, LOG_TTL_INDEX_NAME } from '../../server/main';
import { LOGS } from '../../server/config';

interface MongoIndexSpec {
  name: string;
  key: Record<string, number>;
  expireAfterSeconds?: number;
}

async function findTtlIndex(): Promise<MongoIndexSpec | undefined> {
  const indexes = (await LogsCollection.rawCollection().indexes()) as MongoIndexSpec[];
  return indexes.find(index => index.name === LOG_TTL_INDEX_NAME);
}

describe('logs retention — TTL index', () => {
  it('configures a TTL index on the log timestamp field with the configured retention window', async () => {
    await ensureLogRetentionIndex();

    const ttlIndex = await findTtlIndex();
    assert.ok(ttlIndex, `Expected a TTL index named "${LOG_TTL_INDEX_NAME}" on the Logs collection`);
    assert.deepStrictEqual(ttlIndex.key, { createdAt: 1 }, 'TTL index must key on the log timestamp field (createdAt)');
    assert.strictEqual(
      ttlIndex.expireAfterSeconds,
      LOGS.retentionSeconds,
      'TTL expireAfterSeconds must match the configured retention window',
    );
    assert.ok((ttlIndex.expireAfterSeconds ?? 0) > 0, 'Default retention window must be a positive number of seconds');
  });
});
