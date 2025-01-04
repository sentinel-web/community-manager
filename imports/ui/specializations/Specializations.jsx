import React, { useCallback, useContext, useMemo, useState } from 'react';
import { App, Button, Col, Input, Row } from 'antd';
import SectionCard from '../section-card/SectionCard';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import TableFooter from '../table/footer/TableFooter';
import useSpecializations from './specializations.hook';
import { DrawerContext, SubdrawerContext } from '../app/App';
import SpecializationForm from './SpecializationForm';
import { Meteor } from 'meteor/meteor';
import getSpecializationColumns from './specializations.columns';
import TableHeader from '../table/header/TableHeader';

export default function Specializations({ useSubdrawer }) {
  const [nameInput, setNameInput] = useState('');
  const { ready, specializations } = useSpecializations();
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const { notification, message } = App.useApp();

  const handleNameChange = useCallback(value => setNameInput(value), []);

  const filterSpecialization = useCallback(
    specialization => {
      const charactersOfInput = nameInput.split('');
      const specializationName = specialization?.name || '';
      return charactersOfInput.every(char => specializationName.includes(char));
    },
    [nameInput]
  );

  const buildDatasource = useCallback(() => specializations.filter(filterSpecialization), [specializations, filterSpecialization]);

  const datasource = useMemo(() => {
    return buildDatasource();
  }, [buildDatasource]);

  const handleCreate = useCallback(() => {
    drawer.setDrawerTitle('Create Specialization');
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(<SpecializationForm setOpen={drawer.setDrawerOpen} />);
    drawer.setDrawerOpen(true);
  }, [drawer]);

  const handleEdit = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle('Edit Specialization');
      drawer.setDrawerComponent(<SpecializationForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const handleDelete = useCallback(
    async (e, record) => {
      e.preventDefault();
      try {
        await Meteor.callAsync('specializations.remove', record._id);
        message.success('Specialization deleted');
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [notification, message]
  );

  const columns = useMemo(() => getSpecializationColumns(handleEdit, handleDelete), [handleEdit, handleDelete]);

  return (
    <SectionCard title="Specializations" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TableHeader value={nameInput} handleChange={handleNameChange} handleCreate={handleCreate} />
        </Col>
        <Col span={24}>
          <TableContainer>
            <Table columns={columns} datasource={datasource} />
          </TableContainer>
          <TableFooter ready={ready} count={datasource.length} />
        </Col>
      </Row>
    </SectionCard>
  );
}
