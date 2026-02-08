import { App, Col, Row } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import GroupActionsBar from '../table/header/GroupActionsBar';
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

  // Admin role (roles: true) has full access to all modules
  if (role.roles === true) {
    return { canCreate: true, canUpdate: true, canDelete: true };
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
  expandable = undefined,
  groupActions = [],
}) {
  const [nameInput, setNameInput] = useState('');
  const [filter, setFilter] = useState(filterFactory(''));
  const [options, setOptions] = useState({ limit: 20 });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  useSubscribe(collectionName, filter, options);
  const datasource = useFind(() => Collection?.find?.(filter, options) || [], [Collection, filter, options]);
  const drawer = useContext(DrawerContext);
  const { notification, message, modal } = App.useApp();
  const { t } = useTranslation();

  // Get user's role for permission checks
  const user = useTracker(() => Meteor.user(), []);
  useSubscribe('roles', { _id: user?.profile?.roleId ?? null }, { limit: 1 });
  const roles = useFind(() => RolesCollection.find({ _id: user?.profile?.roleId ?? null }, { limit: 1 }), [user?.profile?.roleId]);
  const permissions = useMemo(() => {
    const role = roles?.[0];
    const module = permissionModule || collectionName;
    return getModulePermissions(role, module);
  }, [roles, permissionModule, collectionName]);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedRowKeys([]);
  }, [filter]);

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
    drawer.setDrawerTitle(t('common.createEntry'));
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(React.createElement(FormComponent, { setOpen: drawer.setDrawerOpen }));
    drawer.setDrawerOpen(true);
    drawer.setDrawerExtra(extra);
  }, [drawer, t]);

  const handleEdit = useCallback(
    (e, record) => {
      e.preventDefault();
      drawer.setDrawerModel(record);
      drawer.setDrawerTitle(t('common.editEntry'));
      drawer.setDrawerComponent(React.createElement(FormComponent, { setOpen: drawer.setDrawerOpen }));
      drawer.setDrawerOpen(true);
      drawer.setDrawerExtra(extra);
    },
    [drawer, FormComponent, extra, t]
  );

  const handleDelete = useCallback(
    async (e, record) => {
      e.preventDefault();
      try {
        await Meteor.callAsync(`${collectionName}.remove`, record._id);
        message.success(t('messages.deleteSuccess'));
      } catch (error) {
        notification.error({
          message: error.error,
          description: error.message,
        });
      }
    },
    [notification, message, collectionName, t]
  );

  const handleBulkDelete = useCallback(() => {
    const count = selectedRowKeys.length;
    modal.confirm({
      title: t('common.delete'),
      content: t('modals.bulkDeleteConfirm', { count }),
      okButtonProps: { danger: true },
      onOk: async () => {
        setBulkActionLoading(true);
        try {
          const result = await Meteor.callAsync(`${collectionName}.bulkRemove`, selectedRowKeys);
          if (result.errors.length > 0) {
            message.warning(t('messages.bulkDeletePartial', { removed: result.removed, errors: result.errors.length }));
          } else {
            message.success(t('messages.bulkDeleteSuccess', { count: result.removed }));
          }
          setSelectedRowKeys([]);
        } catch (error) {
          notification.error({
            message: error.error,
            description: error.message,
          });
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  }, [selectedRowKeys, collectionName, modal, message, notification, t]);

  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  // Wrap custom group action handlers with loading/error/clear logic
  const wrappedGroupActions = useMemo(
    () =>
      groupActions.map(action => ({
        ...action,
        handler: async () => {
          setBulkActionLoading(true);
          try {
            await action.handler(selectedRowKeys);
            setSelectedRowKeys([]);
          } catch (error) {
            notification.error({
              message: error.error || t('common.error'),
              description: error.message,
            });
          } finally {
            setBulkActionLoading(false);
          }
        },
      })),
    [groupActions, selectedRowKeys, notification, t]
  );

  const showSelection = permissions.canDelete || groupActions.length > 0;

  const rowSelection = useMemo(
    () =>
      showSelection
        ? {
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }
        : undefined,
    [showSelection, selectedRowKeys]
  );

  const columns = useMemo(
    () => columnsFactory(handleEdit, handleDelete, permissions, t),
    [handleEdit, handleDelete, columnsFactory, permissions, t]
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
        {selectedRowKeys.length > 0 && (
          <Col span={24}>
            <GroupActionsBar
              selectedCount={selectedRowKeys.length}
              onDelete={permissions.canDelete ? handleBulkDelete : undefined}
              groupActions={wrappedGroupActions}
              onClearSelection={handleClearSelection}
              loading={bulkActionLoading}
            />
          </Col>
        )}
        <Col span={24}>
          {customView ? (
            React.createElement(customView, { handleEdit, handleDelete, datasource, setFilter, permissions })
          ) : (
            <TableSection
              columns={columns}
              datasource={datasource}
              handleLoadMore={handleLoadMore}
              disabled={loadMoreDisabled}
              expandable={expandable}
              rowSelection={rowSelection}
            />
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
  expandable: PropTypes.object,
  groupActions: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      handler: PropTypes.func.isRequired,
    })
  ),
};

const TableSection = ({ columns, datasource, handleLoadMore, disabled, expandable, rowSelection }) => {
  return (
    <>
      <TableContainer>
        <Table columns={columns} datasource={datasource} expandable={expandable} rowSelection={rowSelection} />
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
  expandable: PropTypes.object,
  rowSelection: PropTypes.object,
};
