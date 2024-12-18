import { Tag, Tooltip } from 'antd';
import React from 'react';
import useTaskStatus from './task-status.hook';

export default function TaskStatusTag({ taskStatusId }) {
  const { ready, taskStatus } = useTaskStatus();
  const match = React.useMemo(() => {
    return ready ? taskStatus.find(status => status._id === taskStatusId) : null;
  }, [taskStatusId, ready, taskStatus]);
  if (!taskStatusId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color}>{match.name}</Tag>
    </Tooltip>
  );
}
