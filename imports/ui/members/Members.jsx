import React, { useCallback, useContext, useMemo, useState } from 'react';
import useMembers from './members.hook';
import { Meteor } from 'meteor/meteor';
import TableFooter from '../table/footer/TableFooter';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import { App, Col, Row } from 'antd';
import SectionCard from '../section-card/SectionCard';
import { DrawerContext } from '../app/App';
import getMembersColumns from './members.columns';
import MemberForm from './MemberForm';
import TableHeader from '../table/header/TableHeader';

export default function Members() {
  const { message, notification, modal } = App.useApp();
  const { ready, members } = useMembers();
  const [searchValue, setSearchValue] = useState('');
  const drawer = useContext(DrawerContext);

  const handleCreate = useCallback(() => {
    drawer.setDrawerTitle('Create Member');
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(<MemberForm setOpen={drawer.setDrawerOpen} />);
    drawer.setDrawerOpen(true);
  }, [drawer]);

  const handleEdit = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle('Edit Member');
      drawer.setDrawerComponent(<MemberForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const deleteMember = useCallback(
    (e, record) => {
      e.preventDefault();
      Meteor.callAsync('members.remove', record._id)
        .then(() => {
          message.success('Member deleted');
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

  const filterMember = useCallback(
    member => {
      const charactersOfInput = searchValue.split('');
      const memberUsername = member?.username || '';
      return charactersOfInput.every(char => memberUsername.includes(char));
    },
    [searchValue]
  );

  const buildDatasource = useCallback(() => {
    return members
      .map(member => ({
        _id: member._id,
        username: member.username,
        profilePictureId: member.profile?.profilePictureId,
        name: member.profile?.name,
        id: member.profile?.id,
        rankId: member.profile?.rankId,
        navyRankId: member.profile?.navyRankId,
        specializationIds: member.profile?.specializationIds,
        roleId: member.profile?.roleId,
        squadId: member.profile?.squadId,
        discordTag: member.profile?.discordTag,
        steamProfileLink: member.profile?.steamProfileLink,
        medalIds: member.profile?.medalIds,
        description: member.profile?.description,
        entryDate: member.profile?.entryDate,
        exitDate: member.profile?.exitDate,
        hasCustomArmour: member.profile?.hasCustomArmour,
      }))
      .filter(member => filterMember(member));
  }, [members, filterMember]);

  const datasource = useMemo(() => {
    return buildDatasource();
  }, [buildDatasource]);

  const columns = useMemo(() => getMembersColumns(deleteMember, handleEdit), [deleteMember, handleEdit]);

  return (
    <SectionCard title="Members" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TableHeader handleChange={setSearchValue} handleCreate={handleCreate} value={searchValue} />
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
