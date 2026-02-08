import { Table as AntdTable } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

export default function Table({ columns, datasource, expandable }) {
  return <AntdTable columns={columns} dataSource={datasource} pagination={false} rowKey="_id" expandable={expandable} />;
}
Table.propTypes = {
  columns: PropTypes.array,
  datasource: PropTypes.array,
  expandable: PropTypes.object,
};
