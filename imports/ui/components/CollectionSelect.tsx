import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Col, Divider, Form, Row, Select, Tag } from 'antd';
import type { Rule } from 'antd/es/form';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import React, { ComponentType, MouseEvent, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { DrawerContext, SubdrawerContext } from '../app/App';
import type { DrawerContextValue } from '../app/types';
import { useTranslation } from '/imports/i18n/LanguageContext';

const empty = <></>;

type CollectionDoc = {
  _id?: string;
  name?: string;
  color?: string;
  profile?: { name?: string };
  [key: string]: unknown;
};

type CollectionSelectValue = string | string[];

interface CollectionSelectProps {
  defaultValue?: CollectionSelectValue;
  onChange?: (value: CollectionSelectValue) => void;
  placeholder?: string;
  mode?: 'multiple' | 'tags';
  collection?: Mongo.Collection<CollectionDoc>;
  name?: string;
  label?: string;
  rules?: Rule[];
  FormComponent?: ComponentType<{ setOpen: (open: boolean) => void; useSubdrawer?: boolean }>;
  subscription?: string;
  extra?: ReactNode;
  query?: Mongo.Selector<CollectionDoc>;
}

interface OptionShape {
  value: string | undefined;
  label: string | undefined;
  raw: CollectionDoc;
}

const CollectionSelect = ({
  defaultValue,
  onChange,
  placeholder,
  mode,
  collection,
  name,
  label,
  rules,
  FormComponent,
  subscription,
  extra = empty,
  query = {},
}: CollectionSelectProps) => {
  const { modal } = App.useApp();
  const drawer = useContext(DrawerContext) as DrawerContextValue;
  const subdrawer = useContext(SubdrawerContext) as DrawerContextValue;
  const { t } = useTranslation();
  const [limit, setLimit] = useState(20);
  const [searchValue, setSearchValue] = useState('');
  const [value, setValue] = useState<CollectionSelectValue>(Array.isArray(defaultValue) ? defaultValue : defaultValue || []);
  const stableQuery = useMemo(() => query, [JSON.stringify(query)]);
  const valueFilter = useMemo<Mongo.Selector<CollectionDoc>>(
    () => ({ _id: Array.isArray(value) ? { $in: value } : value }),
    [value]
  );
  const searchFilter = useMemo<Mongo.Selector<CollectionDoc>>(
    () =>
      searchValue
        ? { $or: [{ name: { $regex: searchValue, $options: 'i' } }, { 'profile.name': { $regex: searchValue, $options: 'i' } }] }
        : {},
    [searchValue]
  );

  const valueLength = useMemo(() => (Array.isArray(value) ? value.length : 1), [value]);
  const otherLimit = useMemo(() => (valueLength > limit ? valueLength : limit - valueLength), [limit, valueLength]);
  const valueSubFilter = useMemo(() => ({ ...valueFilter, ...stableQuery }), [valueFilter, stableQuery]);
  const searchSubFilter = useMemo(() => ({ ...searchFilter, ...stableQuery }), [searchFilter, stableQuery]);
  useSubscribe(subscription, valueSubFilter, { limit: valueLength });
  useSubscribe(subscription, searchSubFilter, { limit: otherLimit });
  const combinedFilter = useMemo<Mongo.Selector<CollectionDoc>>(
    () => ({ $and: [{ $or: [valueFilter, searchFilter] }, stableQuery] }),
    [valueFilter, searchFilter, stableQuery]
  );
  const documents = useFind(() => collection?.find?.(combinedFilter) || ([] as unknown as Mongo.Cursor<CollectionDoc>), [collection, combinedFilter]);
  const options = useMemo<OptionShape[]>(
    () => documents.map(item => ({ value: item._id, label: item.name ?? item?.profile?.name, raw: item })),
    [documents]
  );
  const isFormItem = useMemo(() => Boolean(name && label && rules), [name, label, rules]);
  const user = useTracker(() => Meteor.user(), []);

  const handleCreate = useCallback(() => {
    const usedDrawer = !drawer.drawerOpen ? drawer : subdrawer;
    usedDrawer.setDrawerTitle(`${t('common.create')} ${label ?? ''}`);
    usedDrawer.setDrawerModel({});
    usedDrawer.setDrawerComponent(React.createElement(FormComponent!, { setOpen: usedDrawer.setDrawerOpen, useSubdrawer: drawer.drawerOpen }));
    usedDrawer.setDrawerExtra(extra);
    usedDrawer.setDrawerOpen(true);
  }, [drawer, subdrawer, FormComponent, label, t, extra]);

  const handleEdit = useCallback(
    (e: MouseEvent<HTMLElement>, raw: CollectionDoc) => {
      e.preventDefault();
      e.stopPropagation();
      const usedDrawer = !drawer.drawerOpen ? drawer : subdrawer;
      usedDrawer.setDrawerTitle(`${t('common.edit')} ${label ?? ''}`);
      usedDrawer.setDrawerModel(raw as Record<string, unknown>);
      usedDrawer.setDrawerComponent(React.createElement(FormComponent!, { setOpen: usedDrawer.setDrawerOpen, useSubdrawer: drawer.drawerOpen }));
      usedDrawer.setDrawerExtra(extra);
      usedDrawer.setDrawerOpen(true);
    },
    [drawer, subdrawer, label, FormComponent, t, extra]
  );

  const handleDelete = useCallback(
    (e: MouseEvent<HTMLElement>, selectedValue: string | undefined) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: t('messages.deleteConfirm'),
        okText: t('common.delete'),
        cancelText: t('common.cancel'),
        okType: 'danger',
        onOk: () => {
          Meteor.callAsync(`${subscription}.remove`, selectedValue);
        },
      });
    },
    [modal, subscription, t]
  );

  const renderPopup = useCallback(
    (menu: ReactNode) => {
      return (
        <Row>
          <Col span={24}>{menu}</Col>
          <Col span={24}>
            <Divider size="small" />
          </Col>
          <Col span={24}>
            <Row justify="center">
              <Col>
                <Button disabled={options.length < limit} onClick={() => setLimit(prev => prev + 10)}>
                  {t('common.loadMore')}
                </Button>
              </Col>
            </Row>
          </Col>
        </Row>
      );
    },
    [options.length, limit, t]
  );

  const renderOption = (item: { value?: unknown; label?: ReactNode; data?: unknown }) => {
    const { value: optionValue, label: optionLabel, data } = item;
    const raw = ((data as { raw?: CollectionDoc })?.raw ?? {}) as CollectionDoc;
    const keyValue = optionValue === undefined || optionValue === null ? undefined : String(optionValue);
    return (
      <Row gutter={[4, 4]} align="middle" justify="space-between" key={keyValue} style={{ marginRight: 4 }}>
        <Col flex="auto">
          <Tag color={raw?.color}>{optionLabel}</Tag>
        </Col>
        {user && (
          <>
            <Col>
              <Button icon={<EditOutlined />} onClick={e => handleEdit(e, raw)} type="text" size="small" />
            </Col>
            <Col>
              <Button
                icon={<DeleteOutlined />}
                onClick={e => handleDelete(e, optionValue === undefined ? undefined : String(optionValue))}
                type="text"
                size="small"
                danger
              />
            </Col>
          </>
        )}
      </Row>
    );
  };

  const handleChange = useCallback(
    (newValue: CollectionSelectValue) => {
      if (onChange) {
        onChange(newValue);
      }
      setValue(newValue);
    },
    [onChange]
  );

  return (
    <Row gutter={8} align="middle" style={{ flexWrap: 'nowrap' }}>
      <Col flex="auto">
        {isFormItem && (
          <Form.Item name={name} label={label} rules={rules}>
            <Select
              searchValue={searchValue}
              onSearch={setSearchValue}
              onChange={handleChange}
              options={options}
              placeholder={placeholder}
              mode={mode}
              optionFilterProp="label"
              popupRender={renderPopup}
              optionRender={renderOption}
              showSearch
            />
          </Form.Item>
        )}
        {!isFormItem && (
          <Select
            searchValue={searchValue}
            onSearch={setSearchValue}
            onChange={handleChange}
            options={options}
            placeholder={placeholder}
            mode={mode}
            optionFilterProp="label"
            filterSort={(optionA, optionB) => (optionA.label ?? '').toString().localeCompare((optionB.label ?? '').toString())}
            popupRender={renderPopup}
            optionRender={renderOption}
            style={{ width: '100%', minWidth: 200 }}
            showSearch
          />
        )}
      </Col>
      <Col>{user && <Button icon={<PlusOutlined />} onClick={handleCreate} style={isFormItem ? { marginTop: 8 } : {}} />}</Col>
    </Row>
  );
};

export default CollectionSelect;
