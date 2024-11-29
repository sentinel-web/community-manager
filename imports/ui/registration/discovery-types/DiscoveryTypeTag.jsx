import { Tag, Tooltip } from 'antd';
import React from 'react';
import DiscoveryTypesCollection from '../../../api/collections/discoveryTypes.collection';
import useDiscoveryTypes from './discovery-types.hook';

export default function DiscoveryTypeTag({ discoveryTypeId }) {
  const { ready, discoveryTypes, count } = useDiscoveryTypes();
  const discoveryType = React.useMemo(() => {
    return ready ? DiscoveryTypesCollection.findOne(discoveryTypeId) : null;
  }, [discoveryTypeId, ready]);
  if (!discoveryTypeId) return <Tag>-</Tag>;
  if (!discoveryType) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={discoveryType.description}>
      <Tag color={discoveryType.color}>{discoveryType.name}</Tag>
    </Tooltip>
  );
}
