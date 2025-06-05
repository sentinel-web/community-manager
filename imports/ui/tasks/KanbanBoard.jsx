import { Button, Card, Col, Empty, Grid, Row } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useMemo } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import TaskStatusTag from './task-status/TaskStatusTag';
import { Participants } from './task.columns';

KanbanBoard.propTypes = {
  datasource: PropTypes.array,
  handleEdit: PropTypes.func,
  handleDelete: PropTypes.func,
};
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

export default KanbanBoard;
