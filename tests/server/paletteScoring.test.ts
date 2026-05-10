import assert from 'node:assert';
import { scoreItems } from '../../imports/ui/palette/palette.scoring';
import type { PaletteItem } from '../../imports/ui/palette/palette.types';

function makeItem(label: string, key: string = label, kind: PaletteItem['kind'] = 'navigate'): PaletteItem {
  return {
    kind,
    key,
    label,
    group: 'Test',
    onSelect: () => {},
  };
}

describe('palette scoring (Fuse + boosts)', () => {
  it('returns items unchanged when query is empty', () => {
    const items = [makeItem('Alpha'), makeItem('Bravo')];
    const out = scoreItems('', items);
    assert.strictEqual(out.length, 2);
    assert.strictEqual(out[0].item.label, 'Alpha');
    assert.strictEqual(out[1].item.label, 'Bravo');
  });

  it('finds typo matches (vipr -> Viper)', () => {
    const items = [makeItem('Wolverine'), makeItem('Viper'), makeItem('Hammer')];
    const out = scoreItems('vipr', items);
    assert.ok(
      out.some(s => s.item.label === 'Viper'),
      'Fuse should find Viper for query "vipr"'
    );
  });

  it('boosts prefix matches above mid-word matches', () => {
    const items = [makeItem('Watermark'), makeItem('Members')];
    const out = scoreItems('mem', items);
    const memIdx = out.findIndex(s => s.item.label === 'Members');
    const waterIdx = out.findIndex(s => s.item.label === 'Watermark');
    assert.ok(memIdx !== -1, 'Members should match');
    if (waterIdx !== -1) {
      assert.ok(memIdx < waterIdx, 'expected prefix match Members to rank above mid-word Watermark');
    }
  });

  it('applies recency boost to lower the score of recent items', () => {
    const items = [makeItem('Members', 'nav:members'), makeItem('Medals', 'nav:medals')];
    const recencyBoost = new Map<string, number>([['navigate:nav:members', 1.0]]);
    const out = scoreItems('me', items, { recencyBoost });
    const membersIdx = out.findIndex(s => s.item.label === 'Members');
    const medalsIdx = out.findIndex(s => s.item.label === 'Medals');
    assert.ok(membersIdx !== -1 && medalsIdx !== -1, 'both items should match');
    assert.ok(membersIdx <= medalsIdx, 'expected boosted Members to rank at or above Medals');
  });

  it('returns empty array for queries with no matches', () => {
    const items = [makeItem('Alpha'), makeItem('Bravo')];
    const out = scoreItems('xqz123nomatch', items);
    assert.strictEqual(out.length, 0);
  });
});
