import { Tag } from 'antd';
import React, { useEffect, useState } from 'react';
import type { Rank } from '../../../api/types/rank';
import useMethod from '../../hooks/useMethod';
import CompactRankTag from './CompactRankTag';

interface RankTagProps {
  rankId?: string;
}

export default function RankTag({ rankId }: RankTagProps) {
  const [match, setMatch] = useState<Rank | null>(null);
  const { call } = useMethod<Rank[]>('ranks.read');
  useEffect(() => {
    if (!rankId) {
      setMatch(null);
      return;
    }
    let cancelled = false;
    call({ _id: rankId }, { limit: 1 }).then(res => {
      if (!cancelled && res.ok) setMatch(res.data[0]);
    });
    return () => {
      cancelled = true;
    };
  }, [rankId, call]);

  if (!rankId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return <CompactRankTag name={match.name} abbreviation={match.abbreviation} color={match.color} description={match.description} />;
}
