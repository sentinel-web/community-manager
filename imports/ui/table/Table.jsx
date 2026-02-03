import { Table as AntdTable } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

export default function Table({ columns, datasource }) {
  return <AntdTable columns={columns} dataSource={datasource} pagination={false} rowKey="_id" />;
}
Table.propTypes = {
  columns: PropTypes.array,
  datasource: PropTypes.array,
};
