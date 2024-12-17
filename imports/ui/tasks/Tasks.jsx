import React, { useCallback, useContext, useMemo, useState } from 'react';
import useTasks from './tasks.hook';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import TableFooter from '../table/footer/TableFooter';
import { App, Button, Col, Input, Row } from 'antd';
import SectionCard from '../section-card/SectionCard';
import { getTaskColumns } from './task.columns';
import { DrawerContext } from '../app/App';
import TaskForm from './TaskForm';
import { Meteor } from 'meteor/meteor';
import TaskFilter from './TaskFilter';
import { useTracker } from 'meteor/react-meteor-data';
import KanbanBoard from './KanbanBoard';

const empty = <></>;

export default function Tasks() {
  const { message, notification, modal } = App.useApp();
  const [nameInput, setNameInput] = useState('');
  const { ready, tasks } = useTasks();
  const drawer = useContext(DrawerContext);
  const filter = useTracker(() => {
    return Meteor.user()?.profile?.taskFilter || {};
  });

  const openFilterDrawer = useCallback(
    e => {
      e.preventDefault();
      drawer.setDrawerTitle('Filter Tasks');
      drawer.setDrawerModel(filter);
      drawer.setDrawerComponent(<TaskFilter setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerExtra(empty);
      drawer.setDrawerOpen(true);
    },
    [drawer, filter]
  );

  const openInsertDrawer = useCallback(
    e => {
      e.preventDefault();
      drawer.setDrawerTitle('Create Task');
      drawer.setDrawerModel({});
      drawer.setDrawerComponent(<TaskForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerExtra(empty);
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const openUpdateDrawer = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle('Edit Task');
      drawer.setDrawerComponent(<TaskForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerExtra(empty);
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const handleTaskDelete = useCallback(
    (e, record) => {
      e.preventDefault();
      modal.confirm({
        title: 'Are you sure?',
        content: 'Do you want to delete this task?',
        okText: 'Yes',
        okType: 'danger',
        cancelText: 'No',
        closable: true,
        maskClosable: true,
        onOk: async () => {
          await Meteor.callAsync('tasks.remove', record._id)
            .then(() => {
              message.success('Task deleted');
            })
            .catch(error => {
              notification.error({
                message: error.error,
                description: error.message,
              });
            });
        },
      });
    },
    [message, notification, modal]
  );

  const handleNameChange = useCallback(value => {
    return setNameInput(value);
  }, []);

  const filterTask = useCallback(
    task => {
      const charactersOfInput = nameInput.split('');
      const taskName = task?.name || '';
      const includesStatus = filter.status?.length ? filter.status.includes(task.status) : true;
      const includesParticipants = filter.participants?.length
        ? task.participants?.length
          ? filter.participants.every(participant => task.participants.includes(participant))
          : false
        : true;
      return charactersOfInput.every(char => taskName.includes(char)) && includesStatus && includesParticipants;
    },
    [nameInput, filter]
  );

  const buildDatasource = useCallback(() => {
    return tasks.filter(task => filterTask(task));
  }, [tasks, filterTask]);

  const datasource = useMemo(() => {
    return buildDatasource();
  }, [buildDatasource]);

  const columns = useMemo(() => {
    return getTaskColumns(openUpdateDrawer, handleTaskDelete);
  }, [openUpdateDrawer, handleTaskDelete]);

  return (
    <SectionCard title="Tasks" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col flex="auto">
              <Input.Search placeholder="Search" onSearch={handleNameChange} />
            </Col>
            <Col>
              <Button onClick={openFilterDrawer}>Filter</Button>
            </Col>
            <Col>
              <Button type="primary" onClick={openInsertDrawer}>
                Create
              </Button>
            </Col>
          </Row>
        </Col>
        {(!filter?.type || filter?.type === 'kanban') && (
          <Col span={24}>
            <KanbanBoard
              edit={openUpdateDrawer}
              remove={handleTaskDelete}
              tasks={datasource}
              options={filter?.status?.length ? filter.status : ['open', 'in-progress', 'done']}
            />
          </Col>
        )}
        {(!filter?.type || filter?.type === 'table') && (
          <Col span={24}>
            <TableContainer>
              <Table columns={columns} datasource={datasource} />
            </TableContainer>
            <TableFooter ready={ready} count={datasource.length} />
          </Col>
        )}
      </Row>
    </SectionCard>
  );
}
