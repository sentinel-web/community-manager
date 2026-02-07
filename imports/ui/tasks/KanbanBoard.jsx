import { CommentOutlined } from '@ant-design/icons';
import { Badge, Button, Card, Col, Empty, Grid, Row, Typography } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import TaskStatusTag from './task-status/TaskStatusTag';
import { Participants } from './task.columns';

const KanbanBoard = ({ datasource, handleEdit, handleDelete }) => {
  const onDragEnd = result => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    Meteor.callAsync('tasks.update', draggableId, { status: destination.droppableId });
  };

  const options = useTracker(() => Meteor.user()?.profile?.taskFilter?.status || [], []);

  const columns = useMemo(() => {
    return (
      datasource?.reduce((acc, task) => {
        if (!acc[task.status]) acc[task.status] = [];
        acc[task.status].push(task);
        return acc;
      }, {}) || {}
    );
  }, [datasource]);

  const breakpoints = Grid.useBreakpoint();
  const colSpan = useMemo(() => {
    const minSpan = breakpoints.xxl ? 6 : breakpoints.lg ? 8 : breakpoints.md ? 12 : 24;
    const calculatedSpan = 24 / (options.length || 1);
    return Math.max(calculatedSpan, minSpan);
  }, [options.length, breakpoints]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Row gutter={[16, 16]}>
        {options.map(status => (
          <Col key={status} span={colSpan}>
            <Droppable droppableId={status}>
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <Card title={<TaskStatusTag taskStatusId={status} />}>
                    {!columns[status]?.length && <Empty />}
                    {columns[status]?.map((task, index) => (
                      <Draggable key={`${status}-${task._id}`} draggableId={task._id} index={index}>
                        {provided => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                            <Card
                              title={task.name}
                              style={{ marginBottom: 8 }}
                              extra={
                                <Row gutter={[16, 16]} align="middle" justify="end">
                                  <Col>
                                    <Button onClick={e => handleEdit(e, task)}>Edit</Button>
                                  </Col>
                                  <Col>
                                    <Button onClick={e => handleDelete(e, task)} danger>
                                      Delete
                                    </Button>
                                  </Col>
                                </Row>
                              }
                            >
                              {task.description && (
                                <pre style={{ whiteSpace: 'pre-wrap' }} title={task.description}>
                                  {task.description.length > 150 ? `${task.description.substring(0, 100)}...` : task.description}
                                </pre>
                              )}
                              <Participants participants={task.participants} />
                              {task.completedBy?.length > 0 && (
                                <div style={{ marginTop: 4 }}>
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>Completed by: </Typography.Text>
                                  <Participants participants={task.completedBy} />
                                </div>
                              )}
                              <Row justify="space-between" align="middle" style={{ marginTop: 8 }}>
                                {task.createdAt && (
                                  <Col>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                      {dayjs(task.createdAt).format('YYYY-MM-DD')}
                                    </Typography.Text>
                                  </Col>
                                )}
                                {task.comments?.length > 0 && (
                                  <Col>
                                    <Badge count={task.comments.length} size="small">
                                      <CommentOutlined style={{ fontSize: 16 }} />
                                    </Badge>
                                  </Col>
                                )}
                              </Row>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </Card>
                </div>
              )}
            </Droppable>
          </Col>
        ))}
      </Row>
    </DragDropContext>
  );
};
KanbanBoard.propTypes = {
  datasource: PropTypes.array,
  handleEdit: PropTypes.func,
  handleDelete: PropTypes.func,
};

export default KanbanBoard;
