import { Alert, App, Col, Row } from 'antd';
import type { ExpandableConfig } from 'antd/es/table/interface';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { ComponentType, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { PUBLISH_LIMITS } from '../../config';
import { useTranslation } from '../../i18n/LanguageContext';
import { useDrawerStack } from '../drawer-stack';
import useMethod from '../hooks/useMethod';
import useModulePermissions from '../hooks/useModulePermissions';
import useStableValue from '../hooks/useStableValue';
import TableContainer from '../table/body/TableContainer';
import TableFooter from '../table/footer/TableFooter';
import GroupActionsBar from '../table/header/GroupActionsBar';
import TableHeader from '../table/header/TableHeader';
import Table from '../table/Table';
import DeleteImpactPreview, { type DeleteImpactPreviewData } from './DeleteImpactPreview';
import SectionCard from './SectionCard';
import type { BoundGroupAction, ColumnsFactory, CustomViewProps, GroupAction, RowClickEvent } from './types';

function defaultFilterFactory(input: string): Mongo.Selector<Record<string, unknown>> {
  return { name: { $regex: input, $options: 'i' } };
}

const emptyGroupActions: GroupAction[] = [];

// Table view page size; each "load more" adds another page.
const PAGE_SIZE = 20;

function defaultColumnsFactory(): ReturnType<ColumnsFactory<Record<string, unknown>>> {
  return [];
}

interface SectionProps<T extends { _id?: string }, V extends object = object> {
  title?: string;
  collectionName?: string;
  Collection?: Mongo.Collection<T> | null;
  FormComponent?: ComponentType<unknown>;
  // Re-applied whenever its identity changes — parents that build it from their
  // own state must memoize it (useCallback) so it only changes with that state.
  filterFactory?: (input: string) => Mongo.Selector<T>;
  sort?: Mongo.SortSpecifier;
  columnsFactory?: ColumnsFactory<T>;
  extra?: ReactNode;
  headerExtra?: ReactNode;
  customView?: ComponentType<CustomViewProps<T> & V> | false;
  // Extra props for the custom view (e.g. a callback reporting its visible range).
  customViewProps?: V;
  // Opt-in page size for the custom view, for views that bound their own query
  // (the calendar, by date range) and must show every match at once. Views that
  // don't opt in stay on the table page size and surface a truncation warning —
  // a custom view has no "load more" button.
  customViewLimit?: number;
  permissionModule?: string | null;
  expandable?: ExpandableConfig<T>;
  groupActions?: GroupAction[];
}

export default function Section<T extends { _id?: string }, V extends object = object>({
  title = '',
  collectionName = '',
  Collection = null,
  FormComponent,
  filterFactory = defaultFilterFactory as (input: string) => Mongo.Selector<T>,
  columnsFactory = defaultColumnsFactory as unknown as ColumnsFactory<T>,
  extra = <></>,
  headerExtra = <></>,
  sort,
  customView = false,
  customViewProps,
  customViewLimit,
  permissionModule = null,
  expandable,
  groupActions = emptyGroupActions,
}: SectionProps<T, V>) {
  const [nameInput, setNameInput] = useState('');
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  // Derived, never stored: a new filterFactory (parent filter state changed) or
  // search input re-queries immediately. useStableValue keeps the identity while
  // the selector is structurally unchanged, so deps below don't churn.
  const filter = useStableValue(useMemo(() => filterFactory(nameInput), [filterFactory, nameInput]));
  // Custom views have no "load more". One that bounds its own query can raise
  // its page size via customViewLimit (capped at the server's publish limit);
  // the rest stay on the table page size and warn when they hit it.
  const limit = customView && customViewLimit ? Math.min(customViewLimit, PUBLISH_LIMITS.MAX) : pageLimit;
  const options = useStableValue(useMemo(() => (sort ? { limit, sort } : { limit }), [limit, sort]));
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  useSubscribe(collectionName, filter, options);
  const datasource = useFind(() => Collection?.find?.(filter, options) || ([] as unknown as Mongo.Cursor<T>), [Collection, filter, options]);
  const drawerStack = useDrawerStack();
  const { notification, message, modal } = App.useApp();
  const { t } = useTranslation();

  // Delete-flow seams. Reads (preview/previewBulk) notify on failure (seam
  // default) and carry no success toast; the remove mutation owns the success
  // message, while bulkRemove handles its own partial-vs-full messaging on the
  // resolved result, so it opts out of the success option.
  const { call: previewDelete } = useMethod<DeleteImpactPreviewData>('integrity.preview');
  const { call: previewBulkDelete } = useMethod<{ aggregate: DeleteImpactPreviewData; blockedIds: string[] }>('integrity.previewBulk');
  const { call: removeEntry } = useMethod(`${collectionName}.remove`, { success: t('messages.deleteSuccess') });
  const { call: bulkRemoveEntries } = useMethod<{ removed: number; errors: unknown[] }>(`${collectionName}.bulkRemove`);

  const permissions = useModulePermissions(collectionName, permissionModule);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [filter]);

  const handleNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setNameInput(event.target.value);
  }, []);

  const handleCreate = useCallback(() => {
    void drawerStack.push({
      title: t('common.createEntry'),
      Component: FormComponent as ComponentType<unknown>,
      model: {},
      extra,
    });
  }, [drawerStack, t, FormComponent, extra]);

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
      void drawerStack.push({
        title: t('common.editEntry'),
        Component: FormComponent as ComponentType<unknown>,
        model: record as Record<string, unknown>,
        extra,
      });
    },
    [drawerStack, FormComponent, extra, t]
  );

  const handleDelete = useCallback(
    async (e: RowClickEvent, record: T) => {
      e.preventDefault();
      const recordId = record._id;
      if (!recordId) return;

      const previewRes = await previewDelete(collectionName, recordId);
      if (!previewRes.ok) return;
      const preview = previewRes.data;

      const isBlocked = preview != null && preview.blockedBy.length > 0;

      modal.confirm({
        title: t('modals.deleteEntry'),
        content: (
          <>
            <DeleteImpactPreview preview={preview} />
            {!isBlocked && <p>{t('modals.deleteEntryConfirm')}</p>}
          </>
        ),
        okButtonProps: { danger: true, disabled: isBlocked },
        okText: t('common.delete'),
        cancelText: t('common.cancel'),
        onOk: async () => {
          await removeEntry(recordId);
        },
      });
    },
    [previewDelete, removeEntry, modal, collectionName, t]
  );

  const handleBulkDelete = useCallback(async () => {
    const count = selectedRowKeys.length;
    const ids = selectedRowKeys.map(String);

    // Pre-fetch the aggregate preview. If any id is blocked, we render the
    // structured block panel and disable confirm — matches the single-delete
    // pre-flight pattern. Side-effect counts (pull/setNull/cascade) ride
    // along so admins see "this will affect 23 events" before committing.
    const previewRes = await previewBulkDelete(collectionName, ids);
    if (!previewRes.ok) return;
    const preview = previewRes.data;

    const isBlocked = preview != null && preview.blockedIds.length > 0;

    modal.confirm({
      title: t('common.delete'),
      content: (
        <>
          <DeleteImpactPreview preview={preview ? preview.aggregate : null} />
          {!isBlocked && <p>{t('modals.bulkDeleteConfirm', { count })}</p>}
        </>
      ),
      okButtonProps: { danger: true, disabled: isBlocked },
      onOk: async () => {
        setBulkActionLoading(true);
        // bulkRemove reports partial vs full success itself, so it skips the
        // seam success option; the seam still notifies on outright failure.
        const res = await bulkRemoveEntries(selectedRowKeys);
        if (res.ok) {
          if (res.data.errors.length > 0) {
            message.warning(t('messages.bulkDeletePartial', { removed: res.data.removed, errors: res.data.errors.length }));
          } else {
            message.success(t('messages.bulkDeleteSuccess', { count: res.data.removed }));
          }
          setSelectedRowKeys([]);
        }
        setBulkActionLoading(false);
      },
    });
  }, [selectedRowKeys, collectionName, modal, message, previewBulkDelete, bulkRemoveEntries, t]);

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
    setPageLimit(prevLimit => prevLimit + PAGE_SIZE);
  }, []);

  const loadMoreDisabled = datasource.length < pageLimit;
  const customViewTruncated = !!customView && datasource.length >= limit;

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
            <>
              {customViewTruncated && (
                <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t('messages.resultsTruncated', { limit })} />
              )}
              {React.createElement(customView, { ...(customViewProps as V), handleEdit, handleDelete, datasource, permissions })}
            </>
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
