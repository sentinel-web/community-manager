import { Tag, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

export default function DiscoveryTypeTag({ discoveryTypeId }) {
  const [match, setMatch] = useState(null);

  useEffect(() => {
    if (!discoveryTypeId) setMatch(null);
    else Meteor.callAsync('discoveryTypes.read', { _id: discoveryTypeId }, { limit: 1 }).then(res => setMatch(res[0]));
  }, [discoveryTypeId]);

  if (!discoveryTypeId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color}>{match.name}</Tag>
    </Tooltip>
  );
}
DiscoveryTypeTag.propTypes = {
  discoveryTypeId: PropTypes.string,
};
