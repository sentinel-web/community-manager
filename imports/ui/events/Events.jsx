import React from "react";
import { Meteor } from "meteor/meteor";
import useEvents from "./events.hook";
import { handleEventDelete, handleEventEdit } from "./event.actions";
import TableHeader from "../table/header/TableHeader";
import TableContainer from "../table/body/TableContainer";
import Table from "../table/Table";
import TableFooter from "../table/footer/TableFooter";
import { Col, Form, Row, Typography } from "antd";
import TableActions from "../table/body/actions/TableActions";

export default function Events() {
  const [form] = Form.useForm();
  const [nameInput, setNameInput] = React.useState("");
  const { ready, events } = useEvents();
  const [disabled, setDisabled] = React.useState(false);

  function handleSubmit(values) {
    setDisabled(true);
    const { name } = values;

    if (name) {
      Meteor.callAsync("events.insert", { name, start: new Date() })
        .then(() => {
          form.resetFields();
          setNameInput("");
        })
        .catch((error) => {
          alert(
            JSON.stringify(
              { error: error.error, message: error.message },
              null,
              2
            )
          );
        })
        .finally(() => {
          setDisabled(false);
        });
    } else {
      setDisabled(false);
    }
  }

  function handleNameChange(e) {
    return setNameInput(e.target.value);
  }

  function filterEvent(event) {
    const charactersOfInput = nameInput.split("");
    const eventName = event?.name || "";
    return charactersOfInput.every(function (char) {
      return eventName.includes(char);
    });
  }

  function buildDatasource() {
    return events.filter((event) => filterEvent(event));
  }

  const datasource = React.useMemo(() => {
    return buildDatasource();
  }, [events, nameInput]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={2}>Events</Typography.Title>
      </Col>
      <Col span={24}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <TableHeader
            handleInputChange={handleNameChange}
            disabled={disabled}
            inputName="name"
          />
          <TableContainer>
            <Table
              columns={[
                {
                  title: "Name",
                  dataIndex: "name",
                  sorter: (a, b) => a.name.localeCompare(b.name),
                },
                {
                  title: "Start",
                  dataIndex: "start",
                  render: (date) =>
                    date ? new Date(date).toLocaleString() : "-",
                  sorter: (a, b) => a.start - b.start,
                },
                {
                  title: "Actions",
                  dataIndex: "_id",
                  render: (id, record) => (
                    <TableActions
                      record={record}
                      handleEdit={handleEventEdit}
                      handleDelete={handleEventDelete}
                    />
                  ),
                },
              ]}
              datasource={datasource}
            />
          </TableContainer>
          <TableFooter ready={ready} count={datasource.length} />
        </Form>
      </Col>
    </Row>
  );
}
