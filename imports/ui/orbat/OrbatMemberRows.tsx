import { Typography } from 'antd';
import React from 'react';
import type { SquadMemberRow } from '../../api/types/orbat';
import { useTranslation } from '../../i18n/LanguageContext';
import ColoredTag from '../components/ColoredTag';
import CompactRankTag from '../members/ranks/CompactRankTag';

// Fixed, left-aligned columns (position | rank | member) so rows line up whether or not a value is set.
const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, max-content)',
  columnGap: 8,
  rowGap: 4,
  alignItems: 'center',
  textAlign: 'left',
};

const TAG_STYLE: React.CSSProperties = { marginInlineEnd: 0 };

function formatMember(row: SquadMemberRow): string {
  return `${row.memberNumber ?? '-'} "${row.memberName ?? '-'}"`;
}

interface OrbatMemberRowsProps {
  rows: SquadMemberRow[];
}

export default function OrbatMemberRows({ rows }: OrbatMemberRowsProps) {
  const { t } = useTranslation();

  return (
    <div style={GRID_STYLE}>
      <Typography.Text type="secondary">{t('members.position')}</Typography.Text>
      <Typography.Text type="secondary">{t('members.rank')}</Typography.Text>
      <Typography.Text type="secondary">{t('common.name')}</Typography.Text>
      {rows.map(row => (
        <React.Fragment key={row.memberId}>
          <div>
            {row.positionName ? (
              <ColoredTag color={row.positionColor} style={TAG_STYLE}>
                {row.positionName}
              </ColoredTag>
            ) : (
              '-'
            )}
          </div>
          <div>
            {row.rankName ? <CompactRankTag name={row.rankName} abbreviation={row.rankAbbreviation} color={row.rankColor} style={TAG_STYLE} /> : '-'}
          </div>
          <Typography.Text>{formatMember(row)}</Typography.Text>
        </React.Fragment>
      ))}
    </div>
  );
}
