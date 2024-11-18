import React from 'react';
import { Meteor } from 'meteor/meteor';
import useEvents from './events.hook';
import { handleEventDelete, handleEventEdit } from './event.actions';
import TableHeader from '../table/header/TableHeader';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import TableFooter from '../table/footer/TableFooter';
import { Col, Form, Row } from 'antd';
import TableActions from '../table/body/actions/TableActions';
import SectionCard from '../section-card/SectionCard';

export default function Events() {
  const [form] = Form.useForm();
  const [nameInput, setNameInput] = React.useState('');
  const { ready, events } = useEvents();
  const [disabled, setDisabled] = React.useState(false);

  const handleSubmit = React.useCallback(
    values => {
      setDisabled(true);
      const { name } = values;

      if (name) {
        Meteor.callAsync('events.insert', { name, start: new Date() })
          .then(() => {
            form.resetFields();
            setNameInput('');
          })
          .catch(error => {
            alert(JSON.stringify({ error: error.error, message: error.message }, null, 2));
          })
          .finally(() => {
            setDisabled(false);
          });
      } else {
        setDisabled(false);
      }
    },
    [form]
  );

  const handleNameChange = React.useCallback(e => setNameInput(e.target.value), []);

  const filterEvent = React.useCallback(
    event => {
      const charactersOfInput = nameInput.split('');
      const eventName = event?.name || '';
      return charactersOfInput.every(char => eventName.includes(char));
    },
    [nameInput]
  );

  const buildDatasource = React.useCallback(() => {
    return events.filter(event => filterEvent(event));
  }, [events, filterEvent]);

  const datasource = React.useMemo(() => {
    return buildDatasource();
  }, [buildDatasource]);

  return (
    <SectionCard title="Events" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <TableHeader handleInputChange={handleNameChange} disabled={disabled} inputName="name" />
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
          </Form>
        </Col>
      </Row>
    </SectionCard>
  );
}
