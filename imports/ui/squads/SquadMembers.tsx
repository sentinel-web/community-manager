import { Empty, List, Spin } from 'antd';
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import ColoredTag from '../components/ColoredTag';
import useMethod from '../hooks/useMethod';

interface SquadMemberItem {
  _id: string;
  id: number;
  name: string;
  rankName: string | null;
  rankColor: string | null;
  positionName: string | null;
  positionColor: string | null;
}

interface SquadMembersProps {
  squadId: string;
}

export default function SquadMembers({ squadId }: SquadMembersProps) {
  const [members, setMembers] = useState<SquadMemberItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { call } = useMethod<SquadMemberItem[]>('squads.members');

  useEffect(() => {
    call(squadId)
      .then(res => setMembers(res.ok ? res.data : []))
      .finally(() => setLoading(false));
  }, [squadId, call]);

  if (loading) return <Spin size="small" />;
  if (members.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('squads.noMembers')} />;

  return (
    <List
      size="small"
      dataSource={members}
      renderItem={member => (
        <List.Item key={member._id}>
          <span>
            {member.id} &quot;{member.name}&quot;
          </span>
          {member.rankName && (
            <ColoredTag color={member.rankColor} style={{ marginLeft: 8 }}>
              {member.rankName}
            </ColoredTag>
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
