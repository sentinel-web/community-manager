import { Tag, Tooltip } from 'antd';
import React, { useEffect, useState } from 'react';
import type { DiscoveryType } from '../../../api/types/misc';
import useMethod from '../../hooks/useMethod';

interface DiscoveryTypeTagProps {
  discoveryTypeId?: string;
}

export default function DiscoveryTypeTag({ discoveryTypeId }: DiscoveryTypeTagProps) {
  const [match, setMatch] = useState<DiscoveryType | null>(null);
  const { call } = useMethod<DiscoveryType[]>('discoveryTypes.read');

  useEffect(() => {
    if (!discoveryTypeId) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    call({ _id: discoveryTypeId }, { limit: 1 }).then(res => {
      if (!cancelled && res.ok) setMatch(res.data[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [discoveryTypeId, call]);

  if (!discoveryTypeId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color || 'transparent'}>{match.name}</Tag>
    </Tooltip>
  );
}
