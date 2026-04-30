import { Tag, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import type { DiscoveryType } from '../../../api/types/misc';

interface DiscoveryTypeTagProps {
  discoveryTypeId?: string;
}

export default function DiscoveryTypeTag({ discoveryTypeId }: DiscoveryTypeTagProps) {
  const [match, setMatch] = useState<DiscoveryType | null>(null);

  useEffect(() => {
    if (!discoveryTypeId) setMatch(null);
    else
      Meteor.callAsync('discoveryTypes.read', { _id: discoveryTypeId }, { limit: 1 }).then((res: DiscoveryType[]) =>
        setMatch(res[0])
      );
  }, [discoveryTypeId]);

  if (!discoveryTypeId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color || 'transparent'}>{match.name}</Tag>
    </Tooltip>
  );
}
