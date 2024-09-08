import React from "react";
import SectionCard from "../section-card/SectionCard";
import { App, Button, Col, Input, Row } from "antd";
import useRegistrations from "./registrations.hook";
import TableContainer from "../table/body/TableContainer";
import Table from "../table/Table";
import { Meteor } from "meteor/meteor";
import getRegistrationColumns from "./registration.columns";
import TableFooter from "../table/footer/TableFooter";
import { DrawerContext } from "../app/App";
import RegistrationForm from "./RegistrationForm";

export default function Registration() {
  const { message, notification } = App.useApp();
  const { ready, registrations } = useRegistrations();
  const [searchValue, setSearchValue] = React.useState("");
  const drawer = React.useContext(DrawerContext);

  function handleCreate() {
    drawer.setDrawerTitle("Create Registration");
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(
      <RegistrationForm setOpen={drawer.setDrawerOpen} />
    );
    drawer.setDrawerOpen(true);
  }

  function handleEdit(e, record) {
    e.preventDefault();
    drawer.setDrawerModel(record);
    drawer.setDrawerTitle("Edit Registration");
    drawer.setDrawerComponent(
      <RegistrationForm setOpen={drawer.setDrawerOpen} />
    );
    drawer.setDrawerOpen(true);
  }

  function handleDelete(e, record) {
    e.preventDefault();
    Meteor.callAsync("registrations.remove", record._id)
      .then(() => {
        message.success("Registration deleted");
      })
      .catch((error) => {
        notification.error({
          message: error.error,
          description: error.message,
        });
      });
  }

  const columns = React.useMemo(
    () => getRegistrationColumns(handleDelete, handleEdit),
    []
  );

  function registrationNameIncludesSearchValue(registration) {
    if (!searchValue) return true;
    if (!registration?.name) return false;
    const charactersOfInput = searchValue.split("");
    return charactersOfInput.every(function (char) {
      return registration.name.includes(char);
    });
  }

  function registrationIdIncludesSearchValue(registration) {
    if (!searchValue) return true;
    if (!registration?.id) return false;
    const charactersOfInput = searchValue.split("");
    return charactersOfInput.every(function (char) {
      return String(registration.id).includes(char);
    });
  }

  function filterRegistrationBySearchValue() {
    return registrations.filter((registration) => {
      return (
        registrationNameIncludesSearchValue(registration) ||
        registrationIdIncludesSearchValue(registration)
      );
    });
  }

  const datasource = React.useMemo(filterRegistrationBySearchValue, [
    registrations,
    searchValue,
  ]);

  return (
    <SectionCard title="Registration" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col flex="auto">
              <Input.Search placeholder="Search" onSearch={setSearchValue} />
            </Col>
            <Col>
              <Button type="primary" onClick={handleCreate}>
                Create
              </Button>
            </Col>
          </Row>
        </Col>
        <Col span={24}>
          <TableContainer>
            <Table
              columns={columns}
              datasource={datasource}
              count={datasource.length}
            />
          </TableContainer>
          <TableFooter count={datasource.length} ready={ready} />
        </Col>
      </Row>
    </SectionCard>
  );
}
