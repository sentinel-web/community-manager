import { Grid, Table as AntdTable } from 'antd';
import type { ColumnsType, ExpandableConfig, TableRowSelection } from 'antd/es/table/interface';
import React from 'react';
import TableList from './body/TableList';

interface TableProps<T> {
  columns?: ColumnsType<T>;
  datasource?: T[];
  expandable?: ExpandableConfig<T>;
  rowSelection?: TableRowSelection<T>;
}

export default function Table<T extends { _id?: string }>({ columns, datasource, expandable, rowSelection }: TableProps<T>) {
  const screens = Grid.useBreakpoint();
  // Below `md` (768px, the MOBILE breakpoint in imports/config.ts) tables would
  // crush their columns with no horizontal-scroll escape hatch, so render the
  // same data as a card list instead. See docs/responsive-audit.md (finding #1).
  const isMobile = !screens.md;

  if (isMobile) {
    return <TableList<T> columns={columns} datasource={datasource} expandable={expandable} rowSelection={rowSelection} />;
  }

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
