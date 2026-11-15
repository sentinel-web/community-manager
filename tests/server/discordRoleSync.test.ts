import assert from 'node:assert';
import { htmlToMarkdown } from '../../imports/api/discord/htmlToMarkdown';
import { diffDiscordRoles, profileChangesFromDiscord, type RoleLink } from '../../imports/api/discord/roleSync';
import { isValidPreset, parsePreset, PRESET_MAX_LENGTH } from '../../imports/api/events/preset';

const links: RoleLink[] = [
  { kind: 'rank', id: 'private', discordRoleId: 'r-private' },
  { kind: 'rank', id: 'sergeant', discordRoleId: 'r-sergeant' },
  { kind: 'role', id: 'admin', discordRoleId: 'r-admin' },
  { kind: 'squad', id: 'alpha', discordRoleId: 'r-alpha' },
  { kind: 'specialization', id: 'medic', discordRoleId: 'r-medic' },
];

describe('diffDiscordRoles (web → Discord)', () => {
  it('adds what the profile backs and removes managed roles it does not', () => {
    const profile = { rankId: 'sergeant', roleId: 'admin', specializationIds: ['medic'] };
    assert.deepStrictEqual(diffDiscordRoles(profile, ['r-private', 'r-medic', 'unmanaged'], links), {
      add: ['r-sergeant', 'r-admin'],
      remove: ['r-private'],
    });
  });

  it('never touches roles that are not mapped', () => {
    assert.deepStrictEqual(diffDiscordRoles({}, ['unmanaged'], links), { add: [], remove: [] });
  });

  it('strips every managed role for an unlinked or deleted member', () => {
    assert.deepStrictEqual(diffDiscordRoles(null, ['r-sergeant', 'r-alpha', 'unmanaged'], links), { add: [], remove: ['r-sergeant', 'r-alpha'] });
  });
});

describe('profileChangesFromDiscord (Discord → web)', () => {
  it('never changes the permission role, even when its Discord role is granted', () => {
    assert.deepStrictEqual(profileChangesFromDiscord({ rankId: 'private' }, ['r-private'], ['r-private', 'r-admin'], links), {});
  });

  it('replaces the rank when a mapped rank role is granted', () => {
    assert.deepStrictEqual(profileChangesFromDiscord({ rankId: 'private' }, ['r-private'], ['r-private', 'r-sergeant'], links), {
      'profile.rankId': 'sergeant',
    });
  });

  it('does not remove a rank: members always carry one', () => {
    assert.deepStrictEqual(profileChangesFromDiscord({ rankId: 'private' }, ['r-private'], [], links), {});
  });

  it('grants and revokes squads and specializations', () => {
    assert.deepStrictEqual(profileChangesFromDiscord({ specializationIds: [] }, [], ['r-alpha', 'r-medic'], links), {
      'profile.squadId': 'alpha',
      'profile.specializationIds': ['medic'],
    });
    assert.deepStrictEqual(profileChangesFromDiscord({ squadId: 'alpha', specializationIds: ['medic', 'pilot'] }, ['r-alpha', 'r-medic'], [], links), {
      'profile.squadId': null,
      'profile.specializationIds': ['pilot'],
    });
  });

  it('reports nothing when the profile already matches (no sync loop)', () => {
    assert.deepStrictEqual(profileChangesFromDiscord({ rankId: 'sergeant', squadId: 'alpha', specializationIds: ['medic'] }, [], ['r-sergeant', 'r-alpha', 'r-medic'], links), {});
  });
});

describe('htmlToMarkdown', () => {
  it('converts the rich-text allow-list to Discord markdown', () => {
    const html = '<h2>Briefing</h2><p><strong>Bold</strong> and <em>italic</em> &amp; <a href="https://example.com">link</a></p><ul><li>one</li><li>two</li></ul>';
    assert.strictEqual(htmlToMarkdown(html), '**Briefing**\n**Bold** and *italic* & [link](https://example.com)\n- one\n- two');
  });

  it('drops unknown tags and truncates', () => {
    assert.strictEqual(htmlToMarkdown('<span>abcdef</span>', 4), 'abc…');
    assert.strictEqual(htmlToMarkdown(undefined), '');
  });
});

describe('event preset', () => {
  it('recognises uploaded files and http(s) links only', () => {
    assert.deepStrictEqual(parsePreset('https://example.com/preset'), { kind: 'link', url: 'https://example.com/preset' });
    assert.deepStrictEqual(parsePreset('file:mods.html:::data:text/html;base64,PGI+'), {
      kind: 'file',
      filename: 'mods.html',
      dataUrl: 'data:text/html;base64,PGI+',
      base64: 'PGI+',
    });
    // Never an href: script URLs and free text are not links.
    assert.strictEqual(parsePreset('javascript:alert(1)'), null);
    assert.strictEqual(parsePreset('see the forum'), null);
    assert.strictEqual(parsePreset(''), null);
  });

  it('bounds the stored value', () => {
    assert.ok(isValidPreset(undefined));
    assert.ok(isValidPreset('https://example.com'));
    assert.ok(!isValidPreset(42));
    assert.ok(!isValidPreset('x'.repeat(PRESET_MAX_LENGTH + 1)));
  });
});
