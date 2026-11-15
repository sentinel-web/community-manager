/**
 * Pure mapping between a member's profile and the Discord roles the bot manages.
 * No Meteor, no discord.js — the gateway code in server/discord/ only applies the results.
 *
 * Permission roles (`kind: 'role'`) are deliberately one-way (web → Discord): a Discord
 * role change must never grant permissions inside the app.
 */
export type RoleLinkKind = 'rank' | 'role' | 'squad' | 'specialization';

export interface RoleLink {
  kind: RoleLinkKind;
  /** Id of the rank / role / squad / specialization document. */
  id: string;
  discordRoleId: string;
}

export interface SyncedProfile {
  rankId?: string | null;
  roleId?: string | null;
  squadId?: string | null;
  specializationIds?: string[] | null;
}

function profileHas(profile: SyncedProfile, link: RoleLink): boolean {
  switch (link.kind) {
    case 'rank':
      return profile.rankId === link.id;
    case 'role':
      return profile.roleId === link.id;
    case 'squad':
      return profile.squadId === link.id;
    case 'specialization':
      return (profile.specializationIds ?? []).includes(link.id);
  }
}

/** Role changes that make a Discord member match the profile. Unmapped Discord roles are never touched. */
export function diffDiscordRoles(profile: SyncedProfile | null, current: readonly string[], links: readonly RoleLink[]) {
  const desired = new Set(profile ? links.filter(link => profileHas(profile, link)).map(link => link.discordRoleId) : []);
  const managed = new Set(links.map(link => link.discordRoleId));
  return {
    add: [...desired].filter(id => !current.includes(id)),
    remove: current.filter(id => managed.has(id) && !desired.has(id)),
  };
}

/**
 * `$set` changes for a member whose Discord roles went from `before` to `after`.
 * A rank can only be replaced, not removed (members always carry one); a squad and
 * specializations can be both granted and revoked.
 */
export function profileChangesFromDiscord(
  profile: SyncedProfile,
  before: readonly string[],
  after: readonly string[],
  links: readonly RoleLink[]
): Record<string, unknown> {
  const added = links.filter(link => after.includes(link.discordRoleId) && !before.includes(link.discordRoleId));
  const removed = links.filter(link => before.includes(link.discordRoleId) && !after.includes(link.discordRoleId));
  const changes: Record<string, unknown> = {};

  const rank = added.find(link => link.kind === 'rank');
  if (rank && rank.id !== profile.rankId) changes['profile.rankId'] = rank.id;

  const squad = added.find(link => link.kind === 'squad');
  if (squad && squad.id !== profile.squadId) changes['profile.squadId'] = squad.id;
  else if (!squad && removed.some(link => link.kind === 'squad' && link.id === profile.squadId)) changes['profile.squadId'] = null;

  const specs = new Set(profile.specializationIds ?? []);
  const size = specs.size;
  let dropped = false;
  for (const link of added) if (link.kind === 'specialization') specs.add(link.id);
  for (const link of removed) if (link.kind === 'specialization') dropped = specs.delete(link.id) || dropped;
  if (specs.size !== size || dropped) changes['profile.specializationIds'] = [...specs];

  return changes;
}
