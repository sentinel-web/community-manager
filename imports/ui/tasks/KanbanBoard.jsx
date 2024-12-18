import React, { useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { Button, Card, Col, Row } from 'antd';
import { Meteor } from 'meteor/meteor';
import { Participants } from './task.columns';
import TaskStatusTag from './task-status/TaskStatusTag';

const KanbanBoard = ({ tasks, options, edit, remove }) => {
  const onDragEnd = result => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    Meteor.callAsync('tasks.update', draggableId, { status: destination.droppableId });
  };

  const columns = useMemo(() => {
    return (
      tasks?.reduce((acc, task) => {
        if (!acc[task.status]) acc[task.status] = [];
        acc[task.status].push(task);
        return acc;
      }, {}) || {}
    );
  }, [tasks]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Row gutter={16}>
        {options.map(status => (
          <Col key={status} span={24 / (options.length || 1)}>
            <Droppable droppableId={status}>
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <Card title={<TaskStatusTag taskStatusId={status} />}>
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
                                    <Button onClick={e => edit(e, task)}>Edit</Button>
                                  </Col>
                                  <Col>
                                    <Button onClick={e => remove(e, task._id)} danger>
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
