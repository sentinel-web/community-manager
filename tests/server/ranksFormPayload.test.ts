import assert from 'node:assert';
import toRankPayload from '/imports/ui/members/ranks/ranksFormPayload';

// DOM-free payload mapper of RanksForm — no React, no antd, so it runs in the server test context.

describe('toRankPayload', () => {
  it('passes a filled-in abbreviation through', () => {
    const payload = toRankPayload({ name: 'Sergeant', abbreviation: 'Sgt', type: 'player' });
    assert.strictEqual(payload.abbreviation, 'Sgt');
  });

  it('clears an emptied abbreviation to null instead of writing an empty string', () => {
    assert.strictEqual(toRankPayload({ name: 'Sergeant', abbreviation: '', type: 'player' }).abbreviation, null);
    assert.strictEqual(toRankPayload({ name: 'Sergeant', abbreviation: '   ', type: 'player' }).abbreviation, null);
  });

  it('sends null when the abbreviation field was never touched', () => {
    assert.strictEqual(toRankPayload({ name: 'Sergeant', type: 'player' }).abbreviation, null);
  });

  it('trims the stored abbreviation', () => {
    assert.strictEqual(toRankPayload({ name: 'Sergeant', abbreviation: ' Sgt ', type: 'player' }).abbreviation, 'Sgt');
  });

  it('extracts the colour from an antd ColorPicker value and keeps the remaining fields', () => {
    const payload = toRankPayload({
      name: 'Captain',
      type: 'zeus',
      description: 'Zeus rank',
      color: { toHexString: () => '#ff0000' },
      previousRankId: 'sgt',
      nextRankId: 'maj',
    });
    assert.deepStrictEqual(payload, {
      name: 'Captain',
      abbreviation: null,
      color: '#ff0000',
      description: 'Zeus rank',
      previousRankId: 'sgt',
      nextRankId: 'maj',
      type: 'zeus',
    });
  });
});
