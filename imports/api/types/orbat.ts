import type { Squad } from './squad';

/** A squad as returned by `orbat.squads`: the stored squad plus its direct member count (sub-squads not included). */
export interface OrbatSquad extends Squad {
  memberCount: number;
}

/**
 * One member row of a squad, as returned by `orbat.popover.items` and `squads.members`.
 * Rows are sorted by position order (missing last), then rank seniority (missing last), then name.
 */
export interface SquadMemberRow {
  memberId: string;
  memberNumber: number | null;
  memberName: string | null;
  positionName: string | null;
  positionColor: string | null;
  rankName: string | null;
  rankAbbreviation: string | null;
  rankColor: string | null;
}
