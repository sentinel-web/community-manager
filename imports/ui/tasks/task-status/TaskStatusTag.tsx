import { Tag, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import type { TaskStatus } from '../../../api/types/misc';

interface TaskStatusTagProps {
  taskStatusId?: string;
}

export default function TaskStatusTag({ taskStatusId }: TaskStatusTagProps) {
  const [match, setMatch] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (!taskStatusId) setMatch(null);
    else
      Meteor.callAsync('taskStatus.read', { _id: taskStatusId }, { limit: 1 }).then((res: TaskStatus[]) =>
        setMatch(res[0])
      );
  }, [taskStatusId]);

  if (!taskStatusId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color || 'transparent'}>{match.name}</Tag>
    </Tooltip>
  );
}
