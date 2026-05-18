/** Max length of a rank abbreviation (e.g. "OFw"); enforced on the server write path and in RanksForm. */
export const RANK_ABBREVIATION_MAX_LENGTH = 16;

export type RankType = 'player' | 'zeus';

export interface Rank {
  discordRoleId?: string;
  _id?: string;
  name: string;
  abbreviation?: string;
  type: RankType;
  color?: string;
  previousRankId?: string;
  nextRankId?: string;
  description?: string;
}
