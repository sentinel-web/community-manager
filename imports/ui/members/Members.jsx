import React from "react";
import useMembers from "./members.hook";
import { Meteor } from "meteor/meteor";
import TableFooter from "../table/footer/TableFooter";
import TableContainer from "../table/body/TableContainer";
import TableHeader from "../table/header/TableHeader";
import Table from "../table/Table";
import { handleDelete, handleEdit } from "./member.actions";
import { Col, Form, Row } from "antd";
import TableActions from "../table/body/actions/TableActions";
import SectionCard from "../section-card/SectionCard";

export default function Members() {
  const [form] = Form.useForm();
  const [usernameInput, setUsernameInput] = React.useState("");
  const { ready, members } = useMembers();
  const [disabled, setDisabled] = React.useState(false);

  function handleSubmit(values) {
    setDisabled(true);
    const { username } = values;

    if (username) {
      const password = prompt("Enter password");
      if (password) {
        Meteor.callAsync("members.insert", username, password)
          .then(() => {
            form.resetFields();
            setUsernameInput("");
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

  function handleUsernameChange(e) {
    return setUsernameInput(e.target.value);
  }

  function filterMember(member) {
    const charactersOfInput = usernameInput.split("");
    const memberUsername = member?.username || "";
    return charactersOfInput.every(function (char) {
      return memberUsername.includes(char);
    });
  }

  function buildDatasource() {
    return members.filter((member) => filterMember(member));
  }

  const datasource = React.useMemo(() => {
    return buildDatasource();
  }, [members, usernameInput]);

  return (
    <SectionCard title="Members" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <TableHeader
              handleInputChange={handleUsernameChange}
              disabled={disabled}
              inputName="username"
            />
            <TableContainer>
              <Table
                columns={[
                  {
                    title: "Username",
                    dataIndex: "username",
                    key: "username",
                    sorter: (a, b) => a.username.localeCompare(b.username),
                  },
                  {
                    title: "Actions",
                    dataIndex: "_id",
                    key: "actions",
                    render: (id, record) => (
                      <TableActions
                        record={record}
                        handleDelete={handleDelete}
                        handleEdit={handleEdit}
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
