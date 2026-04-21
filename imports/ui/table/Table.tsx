import { Table as AntdTable } from 'antd';
import type { ColumnsType, ExpandableConfig, TableRowSelection } from 'antd/es/table/interface';
import React from 'react';

interface TableProps<T> {
  columns?: ColumnsType<T>;
  datasource?: T[];
  expandable?: ExpandableConfig<T>;
  rowSelection?: TableRowSelection<T>;
}

export default function Table<T extends { _id?: string }>({ columns, datasource, expandable, rowSelection }: TableProps<T>) {
  return (
    <AntdTable<T>
      columns={columns}
      dataSource={datasource}
      pagination={false}
      rowKey="_id"
      expandable={expandable}
      rowSelection={rowSelection}
    />
  );
}
