import { Empty, List, Spin, Tag } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';

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

  useEffect(() => {
    Meteor.callAsync('squads.members', squadId)
      .then(result => setMembers(result as SquadMemberItem[]))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, [squadId]);

  if (loading) return <Spin size="small" />;
  if (members.length === 0) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('squads.noMembers')} />;

  return (
    <List
      size="small"
      dataSource={members}
      renderItem={member => (
        <List.Item key={member._id}>
          <span>{member.id} &quot;{member.name}&quot;</span>
          {member.rankName && (
            <Tag color={member.rankColor ?? undefined} style={{ marginLeft: 8 }}>
              <span style={{ color: member.rankColor ? getLegibleTextColor(member.rankColor) : undefined }}>{member.rankName}</span>
            </Tag>
          )}
          {member.positionName && (
            <Tag color={member.positionColor ?? undefined} style={{ marginLeft: 4 }}>
              <span style={{ color: member.positionColor ? getLegibleTextColor(member.positionColor) : undefined }}>{member.positionName}</span>
            </Tag>
          )}
        </List.Item>
      )}
    />
  );
}
