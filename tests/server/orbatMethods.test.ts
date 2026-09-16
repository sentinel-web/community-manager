import assert from 'node:assert';
import MembersCollection from '../../imports/api/collections/members.collection';
import PositionsCollection from '../../imports/api/collections/positions.collection';
import RanksCollection from '../../imports/api/collections/ranks.collection';
import SquadsCollection from '../../imports/api/collections/squads.collection';
import type { OrbatSquad, SquadMemberRow } from '/imports/api/types';
import { callAs, cleanupFixtures, createTestUser, TEST_PREFIX } from './fixtures';

const id = (suffix: string) => `${TEST_PREFIX}orbat_${suffix}`;

describe('ORBAT / squad member methods (#362, #369, #371, #373)', () => {
  let userId: string;

  before(async () => {
    userId = await createTestUser();
    await Promise.all([
      SquadsCollection.insertAsync({ _id: id('hq'), name: 'HQ' }),
      SquadsCollection.insertAsync({ _id: id('charlie'), name: 'Charlie', parentSquadId: id('hq'), order: 1 }),
      SquadsCollection.insertAsync({ _id: id('alpha'), name: 'Alpha', parentSquadId: id('hq'), order: 2 }),
      SquadsCollection.insertAsync({ _id: id('bravo'), name: 'Bravo', parentSquadId: id('hq'), order: 1 }),
      SquadsCollection.insertAsync({ _id: id('hidden'), name: 'Hidden', excludeFromOrbat: true }),
      RanksCollection.insertAsync({ _id: id('pvt'), name: 'Private', abbreviation: 'Pvt', type: 'player', nextRankId: id('sgt') }),
      RanksCollection.insertAsync({ _id: id('sgt'), name: 'Sergeant', type: 'player', previousRankId: id('pvt') }),
      PositionsCollection.insertAsync({ _id: id('lead'), name: 'Lead', color: '#ff0000', order: 1 }),
    ]);
    await Promise.all([
      createTestUser({ _id: id('m_pvt'), profile: { id: 1001, name: 'Private Member', squadId: id('bravo'), rankId: id('pvt') } }),
      createTestUser({ _id: id('m_sgt'), profile: { id: 1002, name: 'Sergeant Member', squadId: id('bravo'), rankId: id('sgt') } }),
      createTestUser({
        _id: id('m_lead'),
        profile: { id: 1003, name: 'Lead Member', squadId: id('bravo'), rankId: id('pvt'), positionId: id('lead') },
      }),
      createTestUser({ _id: id('m_hq'), profile: { id: 1004, name: 'HQ Member', squadId: id('hq') } }),
    ]);
  });

  after(async () => {
    await cleanupFixtures([MembersCollection, PositionsCollection, RanksCollection, SquadsCollection]);
  });

  describe('orbat.squads', () => {
    it('sorts squads by order (missing last), then name', async () => {
      const squads = (await callAs(userId, 'orbat.squads')) as OrbatSquad[];
      const ours = squads.filter(s => s._id!.startsWith(id(''))).map(s => s.name);
      assert.deepStrictEqual(ours, ['Bravo', 'Charlie', 'Alpha', 'HQ']);
    });

    it('excludes squads flagged excludeFromOrbat', async () => {
      const squads = (await callAs(userId, 'orbat.squads')) as OrbatSquad[];
      assert.ok(!squads.some(s => s._id === id('hidden')));
    });

    it('returns the direct member count per squad (sub-squads not included)', async () => {
      const squads = (await callAs(userId, 'orbat.squads')) as OrbatSquad[];
      const countById = Object.fromEntries(squads.filter(s => s._id!.startsWith(id(''))).map(s => [s._id, s.memberCount]));
      assert.deepStrictEqual(countById, { [id('bravo')]: 3, [id('charlie')]: 0, [id('alpha')]: 0, [id('hq')]: 1 });
    });

    it('rejects anonymous callers', async () => {
      await assert.rejects(() => callAs(null, 'orbat.squads'));
    });
  });

  describe('orbat.popover.items', () => {
    it('returns structured rows sorted by position order, rank seniority, then name', async () => {
      const rows = (await callAs(userId, 'orbat.popover.items', id('bravo'))) as SquadMemberRow[];
      assert.deepStrictEqual(rows, [
        {
          memberId: id('m_lead'),
          memberNumber: 1003,
          memberName: 'Lead Member',
          positionName: 'Lead',
          positionColor: '#ff0000',
          rankName: 'Private',
          rankAbbreviation: 'Pvt',
          rankColor: null,
        },
        {
          memberId: id('m_sgt'),
          memberNumber: 1002,
          memberName: 'Sergeant Member',
          positionName: null,
          positionColor: null,
          rankName: 'Sergeant',
          rankAbbreviation: null,
          rankColor: null,
        },
        {
          memberId: id('m_pvt'),
          memberNumber: 1001,
          memberName: 'Private Member',
          positionName: null,
          positionColor: null,
          rankName: 'Private',
          rankAbbreviation: 'Pvt',
          rankColor: null,
        },
      ]);
    });

    it('rejects anonymous callers', async () => {
      await assert.rejects(() => callAs(null, 'orbat.popover.items', id('bravo')));
    });
  });

  describe('squads.members', () => {
    it('returns the same sorted rows as the ORBAT', async () => {
      const rows = (await callAs(userId, 'squads.members', id('bravo'))) as SquadMemberRow[];
      assert.deepStrictEqual(
        rows.map(r => [r.memberId, r.rankAbbreviation]),
        [
          [id('m_lead'), 'Pvt'],
          [id('m_sgt'), null],
          [id('m_pvt'), 'Pvt'],
        ]
      );
    });

    it('returns an empty list for a squad without members', async () => {
      assert.deepStrictEqual(await callAs(userId, 'squads.members', id('alpha')), []);
    });
  });
});
