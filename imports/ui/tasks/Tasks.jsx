import React from "react";
import { Meteor } from "meteor/meteor";
import useTasks from "./tasks.hook";
import TableHeader from "../table/header/TableHeader";
import TableContainer from "../table/body/TableContainer";
import Table from "../table/Table";
import TableFooter from "../table/footer/TableFooter";
import { handleTaskDelete, handleTaskEdit } from "./task.actions";
import { Col, Form, Row } from "antd";
import TableActions from "../table/body/actions/TableActions";
import SectionCard from "../section-card/SectionCard";

export default function Tasks() {
  const [form] = Form.useForm();
  const [nameInput, setNameInput] = React.useState("");
  const { ready, tasks } = useTasks();
  const [disabled, setDisabled] = React.useState(false);

  function handleSubmit(values) {
    setDisabled(true);
    const { name } = values;

    if (name) {
      const status = prompt("Enter status", "open");
      if (status) {
        Meteor.callAsync("tasks.insert", name, status)
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
    } else {
      setDisabled(false);
    }
  }

  function handleNameChange(e) {
    return setNameInput(e.target.value);
  }

  function filterTask(task) {
    const charactersOfInput = nameInput.split("");
    const taskName = task?.name || "";
    return charactersOfInput.every(function (char) {
      return taskName.includes(char);
    });
  }

  function buildDatasource() {
    return tasks.filter((task) => filterTask(task));
  }

  const datasource = React.useMemo(() => {
    return buildDatasource();
  }, [tasks, nameInput]);

  return (
    <SectionCard title="Tasks" ready={ready}>
      <Row gutter={[16, 16]}>
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
                    title: "Status",
                    dataIndex: "status",
                    sorter: (a, b) => a.status.localeCompare(b.status),
                  },
                  {
                    title: "Actions",
                    dataIndex: "_id",
                    render: (id, record) => (
                      <TableActions
                        record={record}
                        handleEdit={handleTaskEdit}
                        handleDelete={handleTaskDelete}
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
    </SectionCard>
  );
}
