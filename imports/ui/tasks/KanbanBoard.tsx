import { CommentOutlined } from '@ant-design/icons';
import { Badge, Button, Card, Col, Empty, Grid, Row, Typography } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { useEffect, useMemo, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from 'react-beautiful-dnd';
import TaskStatusCollection from '../../api/collections/taskStatus.collection';
import type { Task } from '../../api/types/task';
import { useTranslation } from '../../i18n/LanguageContext';
import useMethod from '../hooks/useMethod';
import useStableValue from '../hooks/useStableValue';
import type { RowClickEvent } from '../section/types';
import TaskStatusTag from './task-status/TaskStatusTag';
import { Participants } from './task.columns';

interface KanbanBoardProps {
  datasource?: Task[];
  handleEdit: (e: RowClickEvent, record: Task) => void;
  handleDelete: (e: RowClickEvent, record: Task) => void;
}

export default function KanbanBoard({ datasource, handleEdit, handleDelete }: KanbanBoardProps) {
  const { t } = useTranslation();
  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    Meteor.callAsync('tasks.update', draggableId, { status: destination.droppableId });
  };

  const selectedStatuses = useTracker(() => (Meteor.user()?.profile?.taskFilter?.status as string[] | undefined) || [], []);
  useSubscribe('taskStatus', {});
  const allStatuses = useFind(() => TaskStatusCollection.find({}), []);
  // No status filter selected → show every task-status as a column instead of nothing.
  const options = useMemo(
    () => (selectedStatuses.length ? selectedStatuses : allStatuses.map(status => status._id as string)),
    [selectedStatuses, allStatuses]
  );

  const columns = useMemo(() => {
    const result: Record<string, Task[]> = datasource?.reduce<Record<string, Task[]>>((acc, task) => {
      const key = task.status as string;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {}) || {};
    return result;
  }, [datasource]);

  // Every card shows participants and completed-by names. Resolving them per
  // card is two method calls per card (and the board can hold a full page of
  // tasks), so the whole board's ids are resolved in one call and handed down.
  // useStableValue keeps the id list's identity across reactive datasource
  // updates that don't change the ids, so the effect doesn't re-fire.
  const memberIds = useStableValue(
    useMemo(() => [...new Set((datasource ?? []).flatMap(task => [...(task.participants ?? []), ...(task.completedBy ?? [])]))], [datasource])
  );
  const [nameById, setNameById] = useState<Record<string, string> | null>(null);
  const { call: fetchNames } = useMethod<Record<string, string>>('members.namesByIds');

  useEffect(() => {
    if (!memberIds.length) {
      setNameById({});
      return;
    }
    let active = true;
    void fetchNames(memberIds).then(res => {
      // A failed lookup resolves to "no names known" rather than leaving every
      // card stuck on the loading placeholder.
      if (active) setNameById(res.ok ? res.data ?? {} : {});
    });
    return () => {
      active = false;
    };
  }, [memberIds, fetchNames]);

  const breakpoints = Grid.useBreakpoint();
  const colSpan = useMemo(() => {
    const minSpan = breakpoints.xxl ? 6 : breakpoints.lg ? 8 : breakpoints.md ? 12 : 24;
    const calculatedSpan = 24 / (options.length || 1);
    return Math.max(calculatedSpan, minSpan);
  }, [options.length, breakpoints]);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Row gutter={[16, 16]}>
        {options.map((status: string) => (
          <Col key={status} span={colSpan}>
            <Droppable droppableId={status}>
              {provided => (
                <div ref={provided.innerRef} {...provided.droppableProps}>
                  <Card title={<TaskStatusTag taskStatusId={status} />}>
                    {!columns[status]?.length && <Empty />}
                    {columns[status]?.map((task, index) => (
                      <Draggable key={`${status}-${task._id}`} draggableId={task._id ?? ''} index={index}>
                        {provided => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                            <Card
                              title={task.name}
                              style={{ marginBottom: 8 }}
                              extra={
                                <Row gutter={[16, 16]} align="middle" justify="end">
                                  <Col>
                                    <Button onClick={e => handleEdit(e, task)}>{t('common.edit')}</Button>
                                  </Col>
                                  <Col>
                                    <Button onClick={e => handleDelete(e, task)} danger>
                                      {t('common.delete')}
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
                              <Participants participants={task.participants} nameById={nameById} />
                              {task.completedBy && task.completedBy.length > 0 && (
                                <div style={{ marginTop: 4 }}>
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    {t('tasks.completedBy')}{' '}
                                  </Typography.Text>
                                  <Participants participants={task.completedBy} nameById={nameById} />
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
                                {task.comments && task.comments.length > 0 && (
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
}
