import { Tag, Tooltip } from 'antd';
import React, { useMemo } from 'react';
import useDiscoveryTypes from './discovery-types.hook';

export default function DiscoveryTypeTag({ discoveryTypeId }) {
  const { ready, discoveryTypes } = useDiscoveryTypes();
  const discoveryType = useMemo(() => {
    return ready ? discoveryTypes.find(type => type._id === discoveryTypeId) : null;
  }, [discoveryTypeId, ready, discoveryTypes]);
  if (!discoveryTypeId) return <Tag>-</Tag>;
  if (!discoveryType) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={discoveryType.description}>
      <Tag color={discoveryType.color}>{discoveryType.name}</Tag>
    </Tooltip>
  );
}
