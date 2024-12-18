import { Tag, Tooltip } from 'antd';
import React from 'react';
import useRanks from './ranks.hook';

export default function RankTag({ rankId }) {
  const { ready, ranks } = useRanks();
  const match = React.useMemo(() => {
    return ready ? ranks.find(status => status._id === rankId) : null;
  }, [rankId, ready, ranks]);
  if (!rankId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color}>{match.name}</Tag>
    </Tooltip>
  );
}
