import React, { useCallback, useContext, useMemo, useState } from 'react';
import SectionCard from '../section-card/SectionCard';
import { App, Col, Row } from 'antd';
import useRegistrations from './registrations.hook';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import { Meteor } from 'meteor/meteor';
import getRegistrationColumns from './registration.columns';
import TableFooter from '../table/footer/TableFooter';
import { DrawerContext } from '../app/App';
import RegistrationForm from './RegistrationForm';
import RegistrationExtra from './RegistrationExtra';
import TableHeader from '../table/header/TableHeader';

const empty = <></>;

export default function Registration() {
  const { message, notification } = App.useApp();
  const { ready, registrations } = useRegistrations();
  const [searchValue, setSearchValue] = useState('');
  const drawer = useContext(DrawerContext);

  const handleCreate = useCallback(() => {
    drawer.setDrawerTitle('Create Registration');
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(<RegistrationForm setOpen={drawer.setDrawerOpen} />);
    drawer.setDrawerExtra(empty);
    drawer.setDrawerOpen(true);
  }, [drawer]);

  const handleExtraCleanup = useCallback(() => {
    drawer.setDrawerTitle('');
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(empty);
    drawer.setDrawerExtra(empty);
    drawer.setDrawerOpen(false);
  }, [drawer]);

  const handleEdit = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle('Edit Registration');
      drawer.setDrawerComponent(<RegistrationForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerExtra(<RegistrationExtra record={record} handleExtraCleanup={handleExtraCleanup} />);
      drawer.setDrawerOpen(true);
    },
    [drawer, handleExtraCleanup]
  );

  const handleDelete = useCallback(
    (e, record) => {
      e.preventDefault();
      Meteor.callAsync('registrations.remove', record._id)
        .then(() => {
          message.success('Registration deleted');
        })
        .catch(error => {
          notification.error({
            message: error.error,
            description: error.message,
          });
        });
    },
    [message, notification]
  );

  const columns = useMemo(() => getRegistrationColumns(handleDelete, handleEdit), [handleDelete, handleEdit]);

  const registrationNameIncludesSearchValue = useCallback(
    registration => {
      if (!searchValue) return true;
      if (!registration?.name) return false;
      const charactersOfInput = searchValue.split('');
      return charactersOfInput.every(char => registration.name.includes(char));
    },
    [searchValue]
  );

  const registrationIdIncludesSearchValue = useCallback(
    registration => {
      if (!searchValue) return true;
      if (!registration?.id) return false;
      const charactersOfInput = searchValue.split('');
      return charactersOfInput.every(char => String(registration.id).includes(char));
    },
    [searchValue]
  );

  const filterRegistrationBySearchValue = useCallback(() => {
    return registrations.filter(registration => {
      return registrationNameIncludesSearchValue(registration) || registrationIdIncludesSearchValue(registration);
    });
  }, [registrations, registrationNameIncludesSearchValue, registrationIdIncludesSearchValue]);

  const datasource = useMemo(() => filterRegistrationBySearchValue(), [filterRegistrationBySearchValue]);

  return (
    <SectionCard title="Registration" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TableHeader value={searchValue} handleChange={setSearchValue} handleCreate={handleCreate} />
        </Col>
        <Col span={24}>
          <TableContainer>
            <Table columns={columns} datasource={datasource} count={datasource.length} />
          </TableContainer>
          <TableFooter count={datasource.length} ready={ready} />
        </Col>
      </Row>
    </SectionCard>
  );
}
