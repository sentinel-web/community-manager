import { Tag, Tooltip } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useEffect, useState } from 'react';

TaskStatusTag.propTypes = {
  taskStatusId: PropTypes.string,
};
export default function TaskStatusTag({ taskStatusId }) {
  const [match, setMatch] = useState(null);

  useEffect(() => {
    if (!taskStatusId) setMatch(null);
    else Meteor.callAsync('taskStatus.read', { _id: taskStatusId }, { limit: 1 }).then(res => setMatch(res[0]));
  }, [taskStatusId]);

  if (!taskStatusId) return <Tag>-</Tag>;
  if (!match) return <Tag>Not found</Tag>;
  return (
    <Tooltip title={match.description}>
      <Tag color={match.color}>{match.name}</Tag>
    </Tooltip>
  );
}
