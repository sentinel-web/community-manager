import { App, Col, Row } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import { DrawerContext } from '../app/App';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import TableHeader from '../table/header/TableHeader';
import Table from '../table/Table';
import SectionCard from './SectionCard';

/**
 * Gets CRUD permissions for a module from a role.
 * Handles both boolean permissions and CRUD object permissions.
 */
function getModulePermissions(role, module) {
  if (!role) {
    return { canCreate: false, canUpdate: false, canDelete: false };
  }

  const permission = role[module];

  // Boolean permission (true = full access)
  if (permission === true) {
    return { canCreate: true, canUpdate: true, canDelete: true };
  }

  // CRUD object permission
  if (typeof permission === 'object' && permission !== null) {
    return {
      canCreate: permission.create === true,
      canUpdate: permission.update === true,
      canDelete: permission.delete === true,
    };
  }

  // No permission
  return { canCreate: false, canUpdate: false, canDelete: false };
}

function defaultFilterFactory(string) {
  return { name: { $regex: string, $options: 'i' } };
}

function defaultColumnsFactory() {
  return [];
}

export default function Section({
  title = '',
  collectionName = '',
  Collection = null,
  FormComponent = <></>,
  filterFactory = defaultFilterFactory,
  columnsFactory = defaultColumnsFactory,
  extra = <></>,
  headerExtra = <></>,
  customView = false,
  permissionModule = null,
}) {
  const [nameInput, setNameInput] = useState('');
  const [filter, setFilter] = useState(filterFactory(''));
  const [options, setOptions] = useState({ limit: 20 });
  useSubscribe(collectionName, filter, options);
  const datasource = useFind(() => Collection?.find?.(filter, options) || [], [Collection, filter, options]);
  const drawer = useContext(DrawerContext);
  const { notification, message } = App.useApp();

  // Get user's role for permission checks
  const user = useTracker(() => Meteor.user(), []);
  useSubscribe('roles', { _id: user?.profile?.roleId ?? null }, { limit: 1 });
  const roles = useFind(() => RolesCollection.find({ _id: user?.profile?.roleId ?? null }, { limit: 1 }), [user?.profile?.roleId]);
  const permissions = useMemo(() => {
    const role = roles?.[0];
    const module = permissionModule || collectionName;
    return getModulePermissions(role, module);
  }, [roles, permissionModule, collectionName]);

  useEffect(() => {
    setFilter(filterFactory(nameInput));
  }, [filterFactory]);
  const handleNameChange = useCallback(
    event => {
      setNameInput(event.target.value);
      const newFilter = filterFactory(event.target.value);
      setFilter(newFilter);
    },
    [filterFactory]
  );

  const handleCreate = useCallback(() => {
    drawer.setDrawerTitle(`Create entry`);
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(React.createElement(FormComponent, { setOpen: drawer.setDrawerOpen }));
    drawer.setDrawerOpen(true);
    drawer.setDrawerExtra(extra);
  }, [drawer]);

  const handleEdit = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle(`Edit entry`);
      drawer.setDrawerComponent(React.createElement(FormComponent, { setOpen: drawer.setDrawerOpen }));
      drawer.setDrawerOpen(true);
      drawer.setDrawerExtra(extra);
    },
    [drawer, FormComponent, extra]
  );

  const handleDelete = useCallback(
    async (e, record) => {
      e.preventDefault();
      try {
        await Meteor.callAsync(`${collectionName}.remove`, record._id);
        message.success(`Entry deleted`);
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [notification, message, collectionName]
  );

  const columns = useMemo(
    () => columnsFactory(handleEdit, handleDelete, permissions),
    [handleEdit, handleDelete, columnsFactory, permissions]
  );

  const handleLoadMore = useCallback(() => {
    setOptions(prevOptions => ({ limit: prevOptions.limit + 20 }));
  }, []);

  const loadMoreDisabled = useMemo(() => datasource?.length < options?.limit, [options, datasource]);

  return (
    <SectionCard title={title} ready={true}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TableHeader
            value={nameInput}
            handleChange={handleNameChange}
            handleCreate={handleCreate}
            extra={headerExtra}
            canCreate={permissions.canCreate}
          />
        </Col>
        <Col span={24}>
          {customView ? (
            React.createElement(customView, { handleEdit, handleDelete, datasource, setFilter, permissions })
          ) : (
            <TableSection columns={columns} datasource={datasource} handleLoadMore={handleLoadMore} disabled={loadMoreDisabled} />
          )}
        </Col>
      </Row>
    </SectionCard>
  );
}
Section.propTypes = {
  title: PropTypes.string,
  collectionName: PropTypes.string,
  Collection: PropTypes.object,
  FormComponent: PropTypes.object,
  filterFactory: PropTypes.func,
  columnsFactory: PropTypes.func,
  extra: PropTypes.node,
  headerExtra: PropTypes.node,
  customView: PropTypes.bool,
  permissionModule: PropTypes.string,
};

const TableSection = ({ columns, datasource, handleLoadMore, disabled }) => {
  return (
    <>
      <TableContainer>
        <Table columns={columns} datasource={datasource} />
      </TableContainer>
      <TableFooter ready={true} count={datasource.length} handleLoadMore={handleLoadMore} disabled={disabled} />
    </>
  );
};
TableSection.propTypes = {
  columns: PropTypes.array,
  datasource: PropTypes.array,
  handleLoadMore: PropTypes.func,
  disabled: PropTypes.bool,
};
