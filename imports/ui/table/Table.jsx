import { Table as AntdTable } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

export default function Table({ columns, datasource, expandable, rowSelection }) {
  return <AntdTable columns={columns} dataSource={datasource} pagination={false} rowKey="_id" expandable={expandable} rowSelection={rowSelection} />;
}
Table.propTypes = {
  columns: PropTypes.array,
  datasource: PropTypes.array,
  expandable: PropTypes.object,
  rowSelection: PropTypes.object,
};
