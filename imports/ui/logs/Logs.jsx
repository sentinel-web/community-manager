import { App, Col, DatePicker, Input, Row } from 'antd';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import LogsCollection from '../../api/collections/logs.collection';
import { DrawerContext } from '../app/App';
import SectionCard from '../section/SectionCard';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import Table from '../table/Table';
import getLogsColumns from './logs.columns';
import LogViewer from './LogViewer';

/**
 * Logs management page component.
 * Displays a filterable table of audit logs with view and delete actions.
 * No props - fetches data internally via Meteor subscriptions.
 */

const { RangePicker } = DatePicker;

function buildFilter(actionInput, dateRange) {
  const filter = {};

  if (actionInput) {
    filter.action = { $regex: actionInput, $options: 'i' };
  }

  if (dateRange && dateRange[0] && dateRange[1]) {
    filter.timestamp = {
      $gte: dateRange[0].startOf('day').toDate(),
      $lte: dateRange[1].endOf('day').toDate(),
    };
  }

  return filter;
}

export default function Logs() {
  const defaultDateRange = useMemo(() => [dayjs().subtract(7, 'day'), dayjs()], []);
  const [actionInput, setActionInput] = useState('');
  const [dateRange, setDateRange] = useState(defaultDateRange);
  const [filter, setFilter] = useState(() => buildFilter('', defaultDateRange));
  const [options, setOptions] = useState({ limit: 20, sort: { timestamp: -1 } });

  useSubscribe('logs', filter, options);
  const datasource = useFind(() => LogsCollection.find(filter, options), [filter, options]);

  const drawer = useContext(DrawerContext);
  const { notification, message } = App.useApp();

  useEffect(() => {
    setFilter(buildFilter(actionInput, dateRange));
  }, [actionInput, dateRange]);

  const handleActionChange = useCallback(event => {
    setActionInput(event.target.value);
  }, []);

  const handleDateRangeChange = useCallback(dates => {
    setDateRange(dates);
  }, []);

  const handleView = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle('View Log');
      drawer.setDrawerComponent(React.createElement(LogViewer));
      drawer.setDrawerOpen(true);
      drawer.setDrawerExtra(<></>);
    },
    [drawer]
  );

  const handleDelete = useCallback(
    async (e, record) => {
      e.preventDefault();
      try {
        await Meteor.callAsync('logs.remove', record._id);
        message.success('Log deleted');
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [notification, message]
  );

  const columns = useMemo(() => getLogsColumns(handleView, handleDelete), [handleView, handleDelete]);

  const handleLoadMore = useCallback(() => {
    setOptions(prevOptions => ({ ...prevOptions, limit: prevOptions.limit + 20 }));
  }, []);

  const loadMoreDisabled = useMemo(() => datasource?.length < options?.limit, [options, datasource]);

  return (
    <SectionCard title="Logs" ready={true}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={8}>
              <Input.Search placeholder="Filter by action..." value={actionInput} onChange={handleActionChange} allowClear />
            </Col>
            <Col xs={24} sm={12} md={8}>
              <RangePicker value={dateRange} onChange={handleDateRangeChange} style={{ width: '100%' }} allowClear />
            </Col>
          </Row>
        </Col>
        <Col span={24}>
          <TableContainer>
            <Table columns={columns} datasource={datasource} />
          </TableContainer>
          <TableFooter ready={true} count={datasource.length} handleLoadMore={handleLoadMore} disabled={loadMoreDisabled} />
        </Col>
      </Row>
    </SectionCard>
  );
}
