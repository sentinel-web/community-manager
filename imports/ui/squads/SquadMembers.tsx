import { Empty, List, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import type { SquadMemberRow } from '../../api/types/orbat';
import { useTranslation } from '../../i18n/LanguageContext';
import ColoredTag from '../components/ColoredTag';
import useMethod from '../hooks/useMethod';
import CompactRankTag from '../members/ranks/CompactRankTag';

interface SquadMembersProps {
  squadId: string;
}

export default function SquadMembers({ squadId }: SquadMembersProps) {
  const [members, setMembers] = useState<SquadMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { call } = useMethod<SquadMemberRow[]>('squads.members');

  useEffect(() => {
    call(squadId)
      .then(res => setMembers(res.ok ? res.data : []))
      .finally(() => setLoading(false));
  }, [squadId, call]);

  if (loading) return <Spin size="small" />;
  if (members.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('squads.noMembers')} />;

  // Rows arrive sorted by position order, rank seniority, then name.
  return (
    <List
      size="small"
      dataSource={members}
      renderItem={member => (
        <List.Item key={member.memberId}>
          <span>
            {member.memberNumber} &quot;{member.memberName}&quot;
          </span>
          {member.rankName && (
            <CompactRankTag name={member.rankName} abbreviation={member.rankAbbreviation} color={member.rankColor} style={{ marginLeft: 8 }} />
          )}
          {member.positionName && (
            <ColoredTag color={member.positionColor} style={{ marginLeft: 4 }}>
              {member.positionName}
            </ColoredTag>
          )}
        </List.Item>
      )}
    />
  );
}
