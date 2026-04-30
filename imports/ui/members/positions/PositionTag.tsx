import { Tag } from 'antd';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { useMemo } from 'react';
import PositionsCollection from '../../../api/collections/positions.collection';

interface PositionTagProps {
  positionId?: string;
}

export default function PositionTag({ positionId }: PositionTagProps) {
  const filter = useMemo(() => ({ _id: positionId || null } as { _id: string }), [positionId]);
  useSubscribe('positions', filter, { limit: 1 });
  const positions = useFind(() => PositionsCollection.find(filter, { limit: 1 }), [filter]);
  const position = positions?.[0];

  if (!position) return '-';

  return <Tag color={position.color}>{position.name}</Tag>;
}
