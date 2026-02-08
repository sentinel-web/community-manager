import { Tag } from 'antd';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import PositionsCollection from '../../../api/collections/positions.collection';

export default function PositionTag({ positionId }) {
  const filter = useMemo(() => ({ _id: positionId || null }), [positionId]);
  useSubscribe('positions', filter, { limit: 1 });
  const positions = useFind(() => PositionsCollection.find(filter, { limit: 1 }), [filter]);
  const position = positions?.[0];

  if (!position) return '-';

  return <Tag color={position.color}>{position.name}</Tag>;
}
PositionTag.propTypes = {
  positionId: PropTypes.string,
};
