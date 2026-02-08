import { Empty, List, Spin, Tag } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';

export default function SquadMembers({ squadId }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    Meteor.callAsync('squads.members', squadId)
      .then(result => setMembers(result))
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
            <Tag color={member.rankColor} style={{ marginLeft: 8 }}>
              <span style={{ color: member.rankColor ? getLegibleTextColor(member.rankColor) : undefined }}>{member.rankName}</span>
            </Tag>
          )}
          {member.positionName && (
            <Tag color={member.positionColor} style={{ marginLeft: 4 }}>
              <span style={{ color: member.positionColor ? getLegibleTextColor(member.positionColor) : undefined }}>{member.positionName}</span>
            </Tag>
          )}
        </List.Item>
      )}
    />
  );
}
SquadMembers.propTypes = {
  squadId: PropTypes.string.isRequired,
};
