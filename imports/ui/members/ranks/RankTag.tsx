import { Tag, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import type { Rank } from '../../../api/types/rank';

interface RankTagProps {
  rankId?: string;
}

export default function RankTag({ rankId }: RankTagProps) {
  const [match, setMatch] = useState<Rank | null>(null);
  useEffect(() => {
    if (!rankId) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    Meteor.callAsync('ranks.read', { _id: rankId }, { limit: 1 }).then(res => {
      if (!cancelled) setMatch((res as Rank[])[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [rankId]);

  if (!rankId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color}>{match.name}</Tag>
    </Tooltip>
  );
}
