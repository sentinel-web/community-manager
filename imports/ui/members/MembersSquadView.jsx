import { Card, Col, List, Row, Tag } from 'antd';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useCallback, useMemo } from 'react';
import SquadsCollection from '../../api/collections/squads.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import getLegibleTextColor from '../../helpers/colors/getLegibleTextColor';
import RankTag from './ranks/RankTag';

export default function MembersSquadView({ datasource, handleEdit }) {
  const { t } = useTranslation();
  useSubscribe('squads', {}, {});
  const squads = useFind(() => SquadsCollection.find({}), []);

  const squadMap = useMemo(() => new Map(squads.map(s => [s._id, s])), [squads]);

  const grouped = useMemo(() => {
    const groups = {};
    for (const member of datasource) {
      const squadId = member.profile?.squadId || '__none__';
      if (!groups[squadId]) groups[squadId] = [];
      groups[squadId].push(member);
    }
    return groups;
  }, [datasource]);

  const sortedSquadIds = useMemo(() => {
    const ids = Object.keys(grouped).filter(id => id !== '__none__');
    ids.sort((a, b) => {
      const nameA = squadMap.get(a)?.name || '';
      const nameB = squadMap.get(b)?.name || '';
      return nameA.localeCompare(nameB);
    });
    if (grouped.__none__?.length) ids.push('__none__');
    return ids;
  }, [grouped, squadMap]);

  const handleClick = useCallback((e, member) => handleEdit(e, member), [handleEdit]);

  return (
    <Row gutter={[16, 16]}>
      {sortedSquadIds.map(squadId => {
        const squad = squadMap.get(squadId);
        const members = grouped[squadId];
        const title = squad ? squad.name : t('members.noSquad');
        const color = squad?.color;

        return (
          <Col key={squadId} xs={24} sm={24} md={12} lg={8}>
            <Card
              size="small"
              title={
                color ? (
                  <Tag color={color}>
                    <span style={{ color: getLegibleTextColor(color) }}>{title}</span>
                  </Tag>
                ) : (
                  title
                )
              }
            >
              <List
                size="small"
                dataSource={members}
                renderItem={member => (
                  <List.Item>
                    <a href="#" onClick={e => handleClick(e, member)} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <RankTag rankId={member.profile?.rankId} />
                      <span>
                        {member.profile?.id || '----'} {member.profile?.name || member.username}
                      </span>
                    </a>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        );
      })}
    </Row>
  );
}
MembersSquadView.propTypes = {
  datasource: PropTypes.array,
  handleEdit: PropTypes.func,
};
