import React, { useCallback, useMemo, useState } from 'react';
import useEvents from './events.hook';
import { handleEventDelete, handleEventEdit } from './event.actions';
import TableHeader from '../table/header/TableHeader';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import TableFooter from '../table/footer/TableFooter';
import { Col, Row } from 'antd';
import TableActions from '../table/body/actions/TableActions';
import SectionCard from '../section-card/SectionCard';

export default function Events() {
  const [nameInput, setNameInput] = useState('');
  const { ready, events } = useEvents();

  const handleSubmit = useCallback(values => {
    //  todo
  }, []);

  const handleNameChange = useCallback(value => setNameInput(value), []);

  const filterEvent = useCallback(
    event => {
      const charactersOfInput = nameInput.split('');
      const eventName = event?.name || '';
      return charactersOfInput.every(char => eventName.includes(char));
    },
    [nameInput]
  );

  const buildDatasource = useCallback(() => {
    return events.filter(event => filterEvent(event));
  }, [events, filterEvent]);

  const datasource = useMemo(() => {
    return buildDatasource();
  }, [buildDatasource]);

  return (
    <SectionCard title="Events" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TableHeader handleChange={handleNameChange} value={nameInput} handleCreate={handleSubmit} />
        </Col>
        <Col span={24}>
          <TableContainer>
            <Table
              columns={[
                {
                  title: 'Name',
                  dataIndex: 'name',
                  sorter: (a, b) => a.name.localeCompare(b.name),
                },
                {
                  title: 'Start',
                  dataIndex: 'start',
                  render: date => (date ? new Date(date).toLocaleString() : '-'),
                  sorter: (a, b) => a.start - b.start,
                },
                {
                  title: 'Actions',
                  dataIndex: '_id',
                  render: (id, record) => <TableActions record={record} handleEdit={handleEventEdit} handleDelete={handleEventDelete} />,
                },
              ]}
              datasource={datasource}
            />
          </TableContainer>
          <TableFooter ready={ready} count={datasource.length} />
        </Col>
      </Row>
    </SectionCard>
  );
}
