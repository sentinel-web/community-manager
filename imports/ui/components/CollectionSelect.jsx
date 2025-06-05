import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Col, Divider, Form, Row, Select, Tag } from 'antd';
import { Meteor } from 'meteor/meteor';
import { useFind, useSubscribe, useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import React, { useCallback, useContext, useMemo, useState } from 'react';
import { DrawerContext, SubdrawerContext } from '../app/App';

const empty = <></>;

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
}) => {
  const { modal } = App.useApp();
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);
  const [limit, setLimit] = useState(20);
  const [searchValue, setSearchValue] = useState('');
  const [value, setValue] = useState(Array.isArray(defaultValue) ? defaultValue : defaultValue || []);
  const valueFilter = useMemo(() => ({ _id: Array.isArray(value) ? { $in: value } : value }), [value]);
  const searchFilter = useMemo(
    () =>
      searchValue ? { $or: [{ name: { $regex: searchValue, $options: 'i' } }, { 'profile.name': { $regex: searchValue, $options: 'i' } }] } : {},
    [searchValue]
  );

  const valueLength = useMemo(() => (Array.isArray(value) ? value.length : 1), [value]);
  const otherLimit = useMemo(() => (valueLength > limit ? valueLength : limit - valueLength), [limit, valueLength]);
  useSubscribe(subscription, valueFilter, { limit: valueLength });
  useSubscribe(subscription, searchFilter, { limit: otherLimit });
  const documents = useFind(() => collection?.find?.({ $or: [valueFilter, searchFilter] }) || [], [collection, valueFilter, searchFilter]);
  const options = useMemo(() => documents.map(item => ({ value: item._id, label: item.name ?? item?.profile?.name, raw: item })), [documents]);
  const isFormItem = useMemo(() => name && label && rules, [name, label, rules]);
  const user = useTracker(() => Meteor.user(), []);

  const handleCreate = useCallback(() => {
    const usedDrawer = !drawer.drawerOpen ? drawer : subdrawer;
    usedDrawer.setDrawerTitle(`Create ${label}`);
    usedDrawer.setDrawerModel({});
    usedDrawer.setDrawerComponent(React.createElement(FormComponent, { setOpen: usedDrawer.setDrawerOpen, useSubdrawer: drawer.drawerOpen }));
    usedDrawer.setDrawerExtra(extra);
    usedDrawer.setDrawerOpen(true);
  }, [drawer, subdrawer, FormComponent, label]);

  const handleEdit = useCallback(
    (e, raw) => {
      e.preventDefault();
      e.stopPropagation();
      const usedDrawer = !drawer.drawerOpen ? drawer : subdrawer;
      usedDrawer.setDrawerTitle(`Edit ${label}`);
      usedDrawer.setDrawerModel(raw);
      usedDrawer.setDrawerComponent(React.createElement(FormComponent, { setOpen: usedDrawer.setDrawerOpen, useSubdrawer: drawer.drawerOpen }));
      usedDrawer.setDrawerExtra(extra);
      usedDrawer.setDrawerOpen(true);
    },
    [drawer, subdrawer, collection, label, FormComponent]
  );

  const handleDelete = useCallback(
    (e, value) => {
      e.preventDefault();
      e.stopPropagation();
      modal.confirm({
        title: `Are you sure you want to delete this ${label}?`,
        okText: 'Delete',
        onOk: () => {
          Meteor.callAsync(`${subscription}.remove`, value);
        },
      });
    },
    [modal, subscription, label]
  );

  const renderPopup = menu => {
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
                Load more
              </Button>
            </Col>
          </Row>
        </Col>
      </Row>
    );
  };

  const renderOption = item => {
    const { value, label, data } = item;
    const raw = data?.raw || {};
    return (
      <Row gutter={[4, 4]} align="middle" justify="space-between" key={value} style={{ marginRight: 4 }}>
        <Col flex="auto">
          <Tag color={raw?.color}>{label}</Tag>
        </Col>
        {user && (
          <>
            <Col>
              <Button icon={<EditOutlined />} onClick={e => handleEdit(e, raw)} type="text" size="small" />
            </Col>
            <Col>
              <Button icon={<DeleteOutlined />} onClick={e => handleDelete(e, value)} type="text" size="small" danger />
            </Col>
          </>
        )}
      </Row>
    );
  };

  const handleChange = useCallback(
    newValue => {
      if (onChange) {
        onChange?.(newValue);
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
            filterSort={(optionA, optionB) => optionA.label.localeCompare(optionB.label)}
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
CollectionSelect.propTypes = {
  defaultValue: PropTypes.any,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  mode: PropTypes.string,
  collection: PropTypes.object,
  name: PropTypes.string,
  label: PropTypes.string,
  rules: PropTypes.array,
  FormComponent: PropTypes.any,
  subscription: PropTypes.object,
  extra: PropTypes.any,
};

export default CollectionSelect;
