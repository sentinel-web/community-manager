import React from "react";
import TableActions from "../table/body/actions/TableActions";

export default function getRegistrationColumns(handleDelete, handleEdit) {
  return [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a, b) => a.name.localeCompare(b.name),
    },
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      sorter: (a, b) => String(a.id).localeCompare(String(b.id)),
    },
    {
      title: "Age",
      dataIndex: "age",
      key: "age",
      sorter: (a, b) => a.age - b.age,
    },
    {
      title: "Discovery Type",
      dataIndex: "discoveryType",
      key: "discoveryType",
      sorter: (a, b) => a.discoveryType.localeCompare(b.discoveryType),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      sorter: (a, b) => a.description.localeCompare(b.description),
    },
    {
      title: "Actions",
      dataIndex: "_id",
      key: "_id",
      render: (id, record) => (
        <TableActions
          record={record}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
        />
      ),
    },
  ];
}