import React from 'react';
import useMembers from './members.hook';
import { Meteor } from 'meteor/meteor';
import TableFooter from '../table/footer/TableFooter';
import TableContainer from '../table/body/TableContainer';
import Table from '../table/Table';
import { App, Button, Col, Input, Row } from 'antd';
import SectionCard from '../section-card/SectionCard';
import { DrawerContext } from '../app/App';
import getMembersColumns from './members.columns';
import MemberForm from './MemberForm';

export default function Members() {
  const { message, notification, modal } = App.useApp();
  const { ready, members } = useMembers();
  const [searchValue, setSearchValue] = React.useState('');
  const drawer = React.useContext(DrawerContext);

  const handleCreate = React.useCallback(() => {
    drawer.setDrawerTitle('Create Member');
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(<MemberForm setOpen={drawer.setDrawerOpen} />);
    drawer.setDrawerOpen(true);
  }, [drawer]);

  const handleEdit = React.useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle('Edit Member');
      drawer.setDrawerComponent(<MemberForm setOpen={drawer.setDrawerOpen} />);
      drawer.setDrawerOpen(true);
    },
    [drawer]
  );

  const deleteMember = React.useCallback(
    record => {
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

  const handleModalConfirm = React.useCallback(
    record => {
      modal.confirm({
        title: 'Delete Member',
        content: 'Are you sure you want to delete this member?',
        okText: 'Yes, delete',
        cancelText: 'No, cancel',
        onOk: () => {
          deleteMember(record);
        },
      });
    },
    [modal, deleteMember]
  );

  const handleDelete = React.useCallback(
    (e, record) => {
      e.preventDefault();
      handleModalConfirm(record);
    },
    [handleModalConfirm]
  );

  const filterMember = React.useCallback(
    member => {
      const charactersOfInput = searchValue.split('');
      const memberUsername = member?.username || '';
      return charactersOfInput.every(char => memberUsername.includes(char));
    },
    [searchValue]
  );

  const buildDatasource = React.useCallback(() => {
    return members
      .map(member => ({
        _id: member._id,
        username: member.username,
        profilePictureId: member.profile?.profilePictureId,
        name: member.profile?.name,
        id: member.profile?.id,
        rankId: member.profile?.rankId,
        specializationIds: member.profile?.specializationIds,
        roleId: member.profile?.roleId,
        squadId: member.profile?.squadId,
        discordTag: member.profile?.discordTag,
        steamProfileLink: member.profile?.steamProfileLink,
        description: member.profile?.description,
      }))
      .filter(member => filterMember(member));
  }, [members, filterMember]);

  const datasource = React.useMemo(() => {
    return buildDatasource();
  }, [buildDatasource]);

  const columns = React.useMemo(() => getMembersColumns(handleDelete, handleEdit), [handleDelete, handleEdit]);

  return (
    <SectionCard title="Members" ready={ready}>
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
            <Table columns={columns} datasource={datasource} />
          </TableContainer>
          <TableFooter ready={ready} count={datasource.length} />
        </Col>
      </Row>
    </SectionCard>
  );
}
