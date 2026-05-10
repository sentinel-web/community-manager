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
    if (!discoveryTypeId) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    Meteor.callAsync('discoveryTypes.read', { _id: discoveryTypeId }, { limit: 1 })
      .then((res: DiscoveryType[]) => {
        if (cancelled) return;
        setMatch(res[0]);
      })
      .catch(() => {
        // Avoid unhandled rejection on unmount-during-call or transient blips —
        // see #130 for context. The Tag falls back to the "Not found" state.
      });
    return () => {
      cancelled = true;
    };
  }, [discoveryTypeId]);

  if (!discoveryTypeId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color || 'transparent'}>{match.name}</Tag>
    </Tooltip>
  );
}
