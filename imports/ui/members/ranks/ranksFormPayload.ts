import { getColorFromValues } from '/imports/helpers/colors/getColorFromValues';

export interface RankFormValues {
  name: string;
  abbreviation?: string;
  type: 'player' | 'zeus';
  description?: string;
  color?: { toHexString?: () => string } | string;
  previousRankId?: string;
  nextRankId?: string;
}

export interface RankPayload {
  name: string;
  abbreviation: string | null;
  color: string | undefined;
  description: string | undefined;
  previousRankId: string | undefined;
  nextRankId: string | undefined;
  type: 'player' | 'zeus';
}

/**
 * Maps RanksForm values onto the wire payload. DOM-free so it is testable without antd.
 *
 * An emptied (or whitespace-only) abbreviation field is sent as `null`, which clears the stored value,
 * instead of writing `''` — that mirrors how the squads form clears `order` and keeps `Rank.abbreviation`
 * either a real abbreviation or absent, as its optional type promises.
 */
export default function toRankPayload(values: RankFormValues): RankPayload {
  const { name, abbreviation, description, previousRankId, nextRankId, type } = values;
  return {
    name,
    abbreviation: abbreviation?.trim() || null,
    color: getColorFromValues(values),
    description,
    previousRankId,
    nextRankId,
    type,
  };
}
