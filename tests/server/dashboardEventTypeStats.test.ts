import assert from 'node:assert';
import type { Mongo } from 'meteor/mongo';
import EventsCollection from '../../imports/api/collections/events.collection';
import EventTypesCollection from '../../imports/api/collections/eventTypes.collection';
import { cleanupFixtures, createTestDoc } from './fixtures';

// Regression guard for #264 (RULE-012): `dashboard.stats` grouped the
// "event count by event type" aggregation on the non-existent field
// `eventTypeId`, while Event documents store the reference in `eventType`
// (imports/api/types/event.ts). The stat was therefore always empty.
//
// We mirror the production helper `aggregateCountByField` (server/apis/
// dashboard.server.ts) exactly and assert, in a parallel-run style, that the
// old grouping field produces an empty result while the fixed grouping field
// produces correct, non-empty counts keyed by event-type name.

type AnyCollection = Mongo.Collection<any>;

async function aggregateCountByField(
  collection: AnyCollection,
  groupField: string,
  nameMap: Map<string | undefined, string>,
): Promise<Record<string, number>> {
  const pipeline = [{ $match: { [groupField]: { $ne: null } } }, { $group: { _id: `$${groupField}`, count: { $sum: 1 } } }];
  const rawCollection = collection.rawCollection();
  const aggregationResult = await (
    rawCollection as unknown as { aggregate(p: unknown[]): { toArray(): Promise<Array<{ _id: string; count: number }>> } }
  )
    .aggregate(pipeline)
    .toArray();
  const result: Record<string, number> = {};
  for (const item of aggregationResult) {
    const name = nameMap.get(item._id);
    if (name) result[name] = item.count;
  }
  return result;
}

describe('dashboard.stats — event count by event type groups on `eventType` (#264)', () => {
  let infantryTypeId: string;
  let armorTypeId: string;
  let eventTypeNameByIdMap: Map<string | undefined, string>;

  before(async () => {
    [infantryTypeId, armorTypeId] = await Promise.all([
      createTestDoc(EventTypesCollection as AnyCollection, { name: 'Infantry' }),
      createTestDoc(EventTypesCollection as AnyCollection, { name: 'Armor' }),
    ]);

    // Two Infantry events, one Armor event — all using the real `eventType` field.
    await Promise.all([
      createTestDoc(EventsCollection as AnyCollection, { name: 'Op Alpha', start: new Date(), end: new Date(), eventType: infantryTypeId }),
      createTestDoc(EventsCollection as AnyCollection, { name: 'Op Bravo', start: new Date(), end: new Date(), eventType: infantryTypeId }),
      createTestDoc(EventsCollection as AnyCollection, { name: 'Op Charlie', start: new Date(), end: new Date(), eventType: armorTypeId }),
    ]);

    const eventTypes = await EventTypesCollection.find().fetchAsync();
    eventTypeNameByIdMap = new Map(eventTypes.map(et => [et._id, et.name]));
  });

  after(async () => {
    await cleanupFixtures([EventsCollection as AnyCollection, EventTypesCollection as AnyCollection]);
  });

  it('the OLD grouping field `eventTypeId` matches nothing (the bug)', async () => {
    const buggy = await aggregateCountByField(EventsCollection as AnyCollection, 'eventTypeId', eventTypeNameByIdMap);
    assert.deepStrictEqual(buggy, {}, 'grouping on the non-existent `eventTypeId` field must yield an empty stat');
  });

  it('the FIXED grouping field `eventType` returns correct non-empty counts keyed by event-type name', async () => {
    const fixed = await aggregateCountByField(EventsCollection as AnyCollection, 'eventType', eventTypeNameByIdMap);
    assert.strictEqual(fixed.Infantry, 2, 'two seeded Infantry events must be counted');
    assert.strictEqual(fixed.Armor, 1, 'one seeded Armor event must be counted');
    assert.ok(Object.keys(fixed).length >= 2, 'the fixed stat must be non-empty');
  });
});
