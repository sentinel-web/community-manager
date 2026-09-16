import assert from 'node:assert';
import buildSquadMemberRows from '../../../imports/helpers/squads/buildSquadMemberRows';

const ranks = [
  { _id: 'pvt', name: 'Private', abbreviation: 'Pvt', color: '#00ff00', nextRankId: 'sgt' },
  { _id: 'sgt', name: 'Sergeant', previousRankId: 'pvt', nextRankId: 'cpt' },
  { _id: 'cpt', name: 'Captain', abbreviation: 'Capt', previousRankId: 'sgt' },
];

const positions = [
  { _id: 'lead', name: 'Squad Leader', color: '#ff0000', order: 1 },
  { _id: 'medic', name: 'Medic', order: 2 },
  { _id: 'misc', name: 'Misc' },
];

describe('buildSquadMemberRows', () => {
  it('returns structured rows with nullable placeholders for missing values', () => {
    const rows = buildSquadMemberRows([{ _id: 'm1', profile: { id: 1001, name: 'Alpha' } }], ranks, positions);
    assert.deepStrictEqual(rows, [
      {
        memberId: 'm1',
        memberNumber: 1001,
        memberName: 'Alpha',
        positionName: null,
        positionColor: null,
        rankName: null,
        rankAbbreviation: null,
        rankColor: null,
      },
    ]);
  });

  it('resolves rank and position fields, including the abbreviation', () => {
    const [row] = buildSquadMemberRows([{ _id: 'm1', profile: { id: 1001, name: 'Alpha', rankId: 'pvt', positionId: 'lead' } }], ranks, positions);
    assert.strictEqual(row.rankName, 'Private');
    assert.strictEqual(row.rankAbbreviation, 'Pvt');
    assert.strictEqual(row.rankColor, '#00ff00');
    assert.strictEqual(row.positionName, 'Squad Leader');
    assert.strictEqual(row.positionColor, '#ff0000');
  });

  it('treats dangling rank/position references as missing', () => {
    const [row] = buildSquadMemberRows([{ _id: 'm1', profile: { rankId: 'gone', positionId: 'gone' } }], ranks, positions);
    assert.strictEqual(row.rankName, null);
    assert.strictEqual(row.positionName, null);
    assert.strictEqual(row.memberName, null);
    assert.strictEqual(row.memberNumber, null);
  });

  it('sorts by position order (missing last), then rank seniority (missing last), then name', () => {
    const rows = buildSquadMemberRows(
      [
        { _id: 'no-position-captain', profile: { name: 'Zulu', rankId: 'cpt' } },
        { _id: 'medic-private', profile: { name: 'Bravo', rankId: 'pvt', positionId: 'medic' } },
        { _id: 'medic-sergeant', profile: { name: 'Yankee', rankId: 'sgt', positionId: 'medic' } },
        { _id: 'lead', profile: { name: 'Xray', rankId: 'pvt', positionId: 'lead' } },
        { _id: 'misc-unranked', profile: { name: 'Alpha', positionId: 'misc' } },
        { _id: 'no-position-private-b', profile: { name: 'Delta', rankId: 'pvt' } },
        { _id: 'no-position-private-a', profile: { name: 'Charlie', rankId: 'pvt' } },
      ],
      ranks,
      positions
    );
    assert.deepStrictEqual(
      rows.map(r => r.memberId),
      ['lead', 'medic-sergeant', 'medic-private', 'no-position-captain', 'no-position-private-a', 'no-position-private-b', 'misc-unranked']
    );
  });

  it('sorts a member holding a rank outside the chain last, not first', () => {
    const withLoner = [...ranks, { _id: 'lone', name: 'Unlinked' }];
    const rows = buildSquadMemberRows(
      [
        { _id: 'unlinked', profile: { name: 'Alpha', rankId: 'lone' } },
        { _id: 'private', profile: { name: 'Bravo', rankId: 'pvt' } },
        { _id: 'captain', profile: { name: 'Charlie', rankId: 'cpt' } },
      ],
      withLoner,
      positions
    );
    assert.deepStrictEqual(
      rows.map(r => r.memberId),
      ['captain', 'private', 'unlinked']
    );
  });

  it('falls back to name order when ranks form a cycle', () => {
    const cyclic = [
      { _id: 'a', name: 'A', nextRankId: 'b' },
      { _id: 'b', name: 'B', nextRankId: 'a' },
    ];
    const rows = buildSquadMemberRows(
      [
        { _id: 'm2', profile: { name: 'Mike', rankId: 'a' } },
        { _id: 'm1', profile: { name: 'Kilo', rankId: 'b' } },
      ],
      cyclic,
      []
    );
    assert.deepStrictEqual(
      rows.map(r => r.memberId),
      ['m1', 'm2']
    );
  });
});
