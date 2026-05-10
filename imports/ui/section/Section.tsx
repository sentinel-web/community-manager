import { App, Col, Row } from 'antd';
import type { ExpandableConfig } from 'antd/es/table/interface';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { ComponentType, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import RolesCollection from '../../api/collections/roles.collection';
import type { Role, CrudPermission } from '../../api/types';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerContext } from '../app/App';
import type { DrawerContextValue } from '../app/types';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import GroupActionsBar from '../table/header/GroupActionsBar';
import TableHeader from '../table/header/TableHeader';
import Table from '../table/Table';
import SectionCard from './SectionCard';
import type { BoundGroupAction, ColumnsFactory, GroupAction, RowClickEvent, SectionPermissions } from './types';

type ModuleKey = keyof Role;

function getModulePermissions(role: Role | undefined, module: ModuleKey): SectionPermissions {
  if (!role) {
    return { canCreate: false, canUpdate: false, canDelete: false };
  }

  if (role.roles === true) {
    return { canCreate: true, canUpdate: true, canDelete: true };
  }

  const permission = role[module];

  if (permission === true) {
    return { canCreate: true, canUpdate: true, canDelete: true };
  }

  if (typeof permission === 'object' && permission !== null) {
    const crud = permission as CrudPermission;
    return {
      canCreate: crud.create === true,
      canUpdate: crud.update === true,
      canDelete: crud.delete === true,
    };
  }

  return { canCreate: false, canUpdate: false, canDelete: false };
}

function defaultFilterFactory(input: string): Mongo.Selector<Record<string, unknown>> {
  return { name: { $regex: input, $options: 'i' } };
}

function defaultColumnsFactory(): ReturnType<ColumnsFactory<Record<string, unknown>>> {
  return [];
}

interface SectionProps<T extends { _id?: string }> {
  title?: string;
  collectionName?: string;
  Collection?: Mongo.Collection<T> | null;
  FormComponent?: ComponentType<{ setOpen: (open: boolean) => void }>;
  filterFactory?: (input: string) => Mongo.Selector<T>;
  columnsFactory?: ColumnsFactory<T>;
  extra?: ReactNode;
  headerExtra?: ReactNode;
  customView?:
    | ComponentType<{
        handleEdit: (e: RowClickEvent, record: T) => void;
        handleDelete: (e: RowClickEvent, record: T) => void;
        datasource: T[];
        setFilter: (filter: Mongo.Selector<T>) => void;
        permissions: SectionPermissions;
      }>
    | false;
  permissionModule?: string | null;
  expandable?: ExpandableConfig<T>;
  groupActions?: GroupAction[];
}

export default function Section<T extends { _id?: string }>({
  title = '',
  collectionName = '',
  Collection = null,
  FormComponent,
  filterFactory = defaultFilterFactory as (input: string) => Mongo.Selector<T>,
  columnsFactory = defaultColumnsFactory as unknown as ColumnsFactory<T>,
  extra = <></>,
  headerExtra = <></>,
  customView = false,
  permissionModule = null,
  expandable,
  groupActions = [],
}: SectionProps<T>) {
  const [nameInput, setNameInput] = useState('');
  const [filter, setFilter] = useState<Mongo.Selector<T>>(filterFactory(''));
  const [options, setOptions] = useState<{ limit: number }>({ limit: 20 });
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  useSubscribe(collectionName, filter, options);
  const datasource = useFind(() => Collection?.find?.(filter, options) || ([] as unknown as Mongo.Cursor<T>), [Collection, filter, options]);
  const drawer = useContext(DrawerContext) as DrawerContextValue;
  const { notification, message, modal } = App.useApp();
  const { t } = useTranslation();

  const user = useTracker(() => Meteor.user(), []);
  useSubscribe('roles', { _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 });
  const roles = useFind(
    () => RolesCollection.find({ _id: (user?.profile?.roleId ?? null) as unknown as string }, { limit: 1 }),
    [user?.profile?.roleId]
  );
  const permissions = useMemo(() => {
    const role = roles?.[0];
    const moduleKey = (permissionModule || collectionName) as ModuleKey;
    return getModulePermissions(role, moduleKey);
  }, [roles, permissionModule, collectionName]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [filter]);

  useEffect(() => {
    setFilter(filterFactory(nameInput));
  }, [filterFactory]);

  const handleNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setNameInput(event.target.value);
      const newFilter = filterFactory(event.target.value);
      setFilter(newFilter);
    },
    [filterFactory]
  );

  const handleCreate = useCallback(() => {
    drawer.setDrawerTitle(t('common.createEntry'));
    drawer.setDrawerModel({});
    drawer.setDrawerComponent(React.createElement(FormComponent!, { setOpen: drawer.setDrawerOpen }));
    drawer.setDrawerOpen(true);
    drawer.setDrawerExtra(extra);
  }, [drawer, t, FormComponent, extra]);

  useEffect(() => {
    if (!permissions.canCreate || !FormComponent) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') !== 'create') return;
    handleCreate();
    params.delete('action');
    const search = params.toString();
    const newUrl = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', newUrl);
  }, [permissions.canCreate, FormComponent, handleCreate]);

  const handleEdit = useCallback(
    (e: RowClickEvent, record: T) => {
      e.preventDefault();
      drawer.setDrawerModel(record as Record<string, unknown>);
      drawer.setDrawerTitle(t('common.editEntry'));
      drawer.setDrawerComponent(React.createElement(FormComponent!, { setOpen: drawer.setDrawerOpen }));
      drawer.setDrawerOpen(true);
      drawer.setDrawerExtra(extra);
    },
    [drawer, FormComponent, extra, t]
  );

  const handleDelete = useCallback(
    async (e: RowClickEvent, record: T) => {
      e.preventDefault();
      try {
        await Meteor.callAsync(`${collectionName}.remove`, record._id);
        message.success(t('messages.deleteSuccess'));
      } catch (error) {
        const err = error as Meteor.Error;
        notification.error({ message: err.error as string, description: err.message });
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
          const result = (await Meteor.callAsync(`${collectionName}.bulkRemove`, selectedRowKeys)) as {
            removed: number;
            errors: unknown[];
          };
          if (result.errors.length > 0) {
            message.warning(t('messages.bulkDeletePartial', { removed: result.removed, errors: result.errors.length }));
          } else {
            message.success(t('messages.bulkDeleteSuccess', { count: result.removed }));
          }
          setSelectedRowKeys([]);
        } catch (error) {
          const err = error as Meteor.Error;
          notification.error({ message: err.error as string, description: err.message });
        } finally {
          setBulkActionLoading(false);
        }
      },
    });
  }, [selectedRowKeys, collectionName, modal, message, notification, t]);

  const handleClearSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  const wrappedGroupActions = useMemo<BoundGroupAction[]>(
    () =>
      groupActions.map(action => ({
        key: action.key,
        label: action.label,
        handler: async () => {
          setBulkActionLoading(true);
          try {
            await action.handler(selectedRowKeys);
            setSelectedRowKeys([]);
          } catch (error) {
            const err = error as Meteor.Error;
            notification.error({ message: (err.error as string) || t('common.error'), description: err.message });
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

  const columns = useMemo(() => columnsFactory(handleEdit, handleDelete, permissions, t), [handleEdit, handleDelete, columnsFactory, permissions, t]);

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
            <TableSection<T>
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

interface TableSectionProps<T extends { _id?: string }> {
  columns: ReturnType<ColumnsFactory<T>>;
  datasource: T[];
  handleLoadMore: () => void;
  disabled: boolean;
  expandable?: ExpandableConfig<T>;
  rowSelection?: { selectedRowKeys: React.Key[]; onChange: (keys: React.Key[]) => void };
}

function TableSection<T extends { _id?: string }>({ columns, datasource, handleLoadMore, disabled, expandable, rowSelection }: TableSectionProps<T>) {
  return (
    <>
      <TableContainer>
        <Table<T> columns={columns} datasource={datasource} expandable={expandable} rowSelection={rowSelection} />
      </TableContainer>
      <TableFooter ready={true} count={datasource.length} handleLoadMore={handleLoadMore} disabled={disabled} />
    </>
  );
}
