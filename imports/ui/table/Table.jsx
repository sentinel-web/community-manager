import React from "react";
import { Table as AntdTable } from "antd";

export default function Table({ columns, datasource }) {
  return (
    <AntdTable
      columns={columns}
      dataSource={datasource}
      pagination={false}
      rowKey="_id"
    />
  );
}
