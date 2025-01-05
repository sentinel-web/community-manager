import React, { useCallback, useContext, useMemo, useState } from 'react';
import { App, Col, Row } from 'antd';
import SectionCard from '../section-card/SectionCard';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import TableFooter from '../table/footer/TableFooter';
import { DrawerContext, SubdrawerContext } from '../app/App';
import { Meteor } from 'meteor/meteor';
import TableHeader from '../table/header/TableHeader';
import SquadsForm from './SquadsForm';
import useSquads from './squads.hook';
import getSquadsColumns from './squads.columns';

export default function Squads({ useSubdrawer }) {
  const [nameInput, setNameInput] = useState('');
  const { ready, squads } = useSquads();
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const { notification, message } = App.useApp();

  const handleNameChange = useCallback(value => setNameInput(value), []);

  const filterSquads = useCallback(
    squad => {
      const charactersOfInput = nameInput.split('');
      const squadName = squad?.name || '';
      return charactersOfInput.every(char => squadName.includes(char));
    },
    [nameInput]
  );

  const buildDatasource = useCallback(() => squads.filter(filterSquads), [squads, filterSquads]);

  const datasource = useMemo(() => {
    return buildDatasource();
  }, [buildDatasource]);

  const handleCreate = useCallback(() => {
    drawer.setDrawerTitle('Create Squad');
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(<SquadsForm setOpen={drawer.setDrawerOpen} />);
    drawer.setDrawerOpen(true);
  }, [drawer]);

  const handleEdit = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle('Edit Squad');
      drawer.setDrawerComponent(<SquadsForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const handleDelete = useCallback(
    async (e, record) => {
      e.preventDefault();
      try {
        await Meteor.callAsync('squads.remove', record._id);
        message.success('Squad deleted');
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [notification, message]
  );

  const columns = useMemo(() => getSquadsColumns(handleEdit, handleDelete), [handleEdit, handleDelete]);

  return (
    <SectionCard title="Squads" ready={ready}>
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
