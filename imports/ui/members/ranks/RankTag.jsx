import { Tag, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

RankTag.propTypes = {
  rankId: PropTypes.string,
};
export default function RankTag({ rankId }) {
  const [match, setMatch] = useState(null);
  useEffect(() => {
    if (!rankId) setMatch(null);
    else Meteor.callAsync('ranks.read', { _id: rankId }, { limit: 1 }).then(res => setMatch(res[0]));
  }, [rankId]);

  if (!rankId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color}>{match.name}</Tag>
    </Tooltip>
  );
}
