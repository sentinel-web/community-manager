import { Tag, Tooltip } from 'antd';
import React, { useEffect, useState } from 'react';
import type { TaskStatus } from '../../../api/types/misc';
import ColoredTag from '../../components/ColoredTag';
import useMethod from '../../hooks/useMethod';

interface TaskStatusTagProps {
  taskStatusId?: string;
}

export default function TaskStatusTag({ taskStatusId }: TaskStatusTagProps) {
  const [match, setMatch] = useState<TaskStatus | null>(null);
  const { call } = useMethod<TaskStatus[]>('taskStatus.read');

  useEffect(() => {
    if (!taskStatusId) setMatch(null);
    else call({ _id: taskStatusId }, { limit: 1 }).then(res => res.ok && setMatch(res.data[0]));
  }, [taskStatusId, call]);

  if (!taskStatusId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <ColoredTag color={match.color}>{match.name}</ColoredTag>
    </Tooltip>
  );
}
