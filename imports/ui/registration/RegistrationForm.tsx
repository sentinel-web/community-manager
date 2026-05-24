import { Alert, App, Button, Col, Form, Input, InputNumber, Row, Switch, Tooltip } from 'antd';
import type { ValidateStatus } from 'antd/es/form/FormItem';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useFind, useSubscribe } from 'meteor/react-meteor-data';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DiscoveryTypesCollection from '../../api/collections/discoveryTypes.collection';
import type { Registration } from '../../api/types';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerFooter, useDrawerFrame } from '../drawer-stack';
import CollectionSelect, { type CollectionDoc } from '../components/CollectionSelect';
import DiscoveryTypeForm from './discovery-types/DiscoveryTypesForm';

interface RegistrationFormValues {
  name: string;
  id: number | null;
  age: number | null;
  discoveryType: string | null;
  discoveryTypeDetails?: string;
  steamProfileLink?: string;
  discordTag?: string;
  rulesReadAndAccepted: boolean;
  description?: string;
}

export default function RegistrationForm() {
  const [form] = Form.useForm<RegistrationFormValues>();
  const { model: rawModel, resolve, cancel } = useDrawerFrame<string, Partial<Registration>>();
  const { message, notification } = App.useApp();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [disableSubmit, setDisableSubmit] = useState(false);
  const [nameError, setNameError] = useState<ValidateStatus | undefined>(undefined);
  const [idError, setIdError] = useState<ValidateStatus | undefined>(undefined);

  const model = useMemo((): Registration | Record<string, never> => {
    if (!Meteor.user()) return {};
    return (rawModel as unknown as Registration) || {};
  }, [rawModel]);

  useEffect(() => {
    if (Object.keys(model).length > 0) {
      form.setFieldsValue(model as unknown as RegistrationFormValues);
    } else {
      form.setFieldsValue({
        name: '',
        id: null,
        age: null,
        discoveryType: null,
        steamProfileLink: '',
        discordTag: '',
        rulesReadAndAccepted: false,
        description: '',
      });
    }
  }, [model, form.setFieldsValue]);

  const validateName = useCallback(() => {
    const value = form.getFieldValue('name');
    setNameError('validating');
    Meteor.callAsync('registrations.validateName', value, (model as Registration)?._id)
      .then((result: boolean) => {
        setNameError(result ? 'success' : 'error');
        setDisableSubmit(!result);
      })
      .catch(() => {
        setNameError('warning');
      });
  }, [form.getFieldValue, (model as Registration)?._id]);

  const validateId = useCallback(() => {
    const value = form.getFieldValue('id');
    setIdError('validating');
    Meteor.callAsync('registrations.validateId', value, (model as Registration)?._id)
      .then((result: boolean) => {
        setIdError(result ? 'success' : 'error');
        setDisableSubmit(!result);
      })
      .catch(() => {
        setIdError('warning');
      });
  }, [form.getFieldValue, (model as Registration)?._id]);

  useSubscribe('discoveryTypes', {}, {});
  const discoveryTypes = useFind(() => DiscoveryTypesCollection.find({}), []);
  const [showDetails, setShowDetails] = useState(false);

  const handleDiscoveryTypeChange = useCallback(() => {
    const selectedId = form.getFieldValue('discoveryType');
    const dt = discoveryTypes.find(d => d._id === selectedId);
    setShowDetails(!!dt?.hasTextInput);
    if (!dt?.hasTextInput) {
      form.setFieldValue('discoveryTypeDetails', undefined);
    }
  }, [form, discoveryTypes]);

  const handleSubmit = useCallback(
    async (values: RegistrationFormValues) => {
      setLoading(true);
      const { name, id, age, discoveryType, discoveryTypeDetails, steamProfileLink, discordTag, rulesReadAndAccepted, description } = values;
      const args = [
        ...((model as Registration)?._id ? [(model as Registration)._id] : []),
        { name, id, age, discoveryType, discoveryTypeDetails, steamProfileLink, discordTag, rulesReadAndAccepted, description },
      ];
      try {
        const result = (await Meteor.callAsync(
          Meteor.user() && (model as Registration)?._id ? 'registrations.update' : 'registrations.insert',
          ...args
        )) as string | undefined;
        message.success(t('messages.registrationSuccessful'));
        resolve((model as Registration)?._id ?? result);
      } catch (error) {
        const err = error as Meteor.Error;
        notification.error({
          message: err.error as string,
          description: err.message,
        });
      } finally {
        setLoading(false);
      }
    },
    [resolve, model, message, notification, t],
  );

  const handleValuesChange = useCallback(
    (changedValues: Partial<RegistrationFormValues>, values: RegistrationFormValues) => {
      if ('name' in values) {
        validateName();
      }
      if ('id' in values) {
        validateId();
      }
      if ('rulesReadAndAccepted' in changedValues && 'rulesReadAndAccepted' in values) {
        setDisableSubmit(!values.rulesReadAndAccepted);
      }
      if ('discoveryType' in changedValues) {
        handleDiscoveryTypeChange();
      }
    },
    [validateId, validateName, handleDiscoveryTypeChange],
  );

  useEffect(() => {
    handleValuesChange(model as unknown as Partial<RegistrationFormValues>, {} as RegistrationFormValues);
  }, [model, handleValuesChange]);

  return (
    <Form form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} disabled={loading}>
      {(nameError === 'error' || idError === 'error') && (
        <Alert
          className="alert"
          type="error"
          description={
            <Row gutter={[16, 16]}>
              {nameError === 'error' && <Col span={24}>{t('forms.errors.nameAlreadyInUse')}</Col>}
              {idError === 'error' && <Col span={24}>{t('forms.errors.idAlreadyInUse')}</Col>}
            </Row>
          }
        />
      )}
      <Form.Item name="name" label={t('forms.labels.desiredName')} rules={[{ required: true, type: 'string' }]} status={nameError} required>
        <Input placeholder={t('forms.placeholders.enterDesiredName')} />
      </Form.Item>
      <Form.Item
        name="id"
        label={t('forms.labels.desiredId')}
        rules={[
          { required: true, type: 'number' },
          { min: 1000, max: 9999, type: 'number' },
        ]}
        status={idError}
        required
      >
        <InputNumber min={1000} max={9999} step={1} placeholder={t('forms.placeholders.enterDesiredId')} />
      </Form.Item>
      <Form.Item
        name="age"
        label={t('forms.labels.age')}
        rules={[
          { required: true, type: 'number' },
          { type: 'number', min: 16 },
        ]}
        required
      >
        <InputNumber min={16} step={1} placeholder={t('forms.placeholders.enterAge')} />
      </Form.Item>
      <CollectionSelect
        defaultValue={(model as Registration)?.discoveryType ?? undefined}
        name="discoveryType"
        subscription="discoveryTypes"
        label={t('forms.labels.discoveryType')}
        rules={[{ required: false, type: 'string' }]}
        placeholder={t('forms.placeholders.selectDiscoveryType')}
        collection={DiscoveryTypesCollection as unknown as Mongo.Collection<CollectionDoc>}
        FormComponent={DiscoveryTypeForm}
        onChange={handleDiscoveryTypeChange}
      />
      {showDetails && (
        <Form.Item name="discoveryTypeDetails" label={t('registrations.discoveryTypeDetails')} rules={[{ type: 'string' }]}>
          <Input placeholder={t('forms.placeholders.enterDetails')} />
        </Form.Item>
      )}
      <Form.Item name="steamProfileLink" label={t('forms.labels.steamProfileLink')} rules={[{ type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterSteamProfileLink')} />
      </Form.Item>
      <Form.Item name="discordTag" label={t('forms.labels.discordTag')} rules={[{ type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterDiscordTag')} />
      </Form.Item>
      <Form.Item name="rulesReadAndAccepted" label={t('forms.labels.rulesAccepted')} rules={[{ required: true, type: 'boolean' }]} required>
        <Switch />
      </Form.Item>
      {Meteor.user() && (
        <Form.Item name="description" label={t('common.description')} rules={[{ type: 'string' }]}>
          <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
        </Form.Item>
      )}
      <DrawerFooter>
        <Row gutter={[16, 16]} align="middle" justify="end">
          <Col>
            <Button onClick={cancel} danger>
              {t('common.cancel')}
            </Button>
          </Col>
          <Col>
            <Tooltip title={disableSubmit ? t('forms.tooltips.pleaseReadAndAcceptRules') : ''}>
              <Button type="primary" onClick={() => form.submit()} loading={loading} disabled={disableSubmit}>
                {t('common.submit')}
              </Button>
            </Tooltip>
          </Col>
        </Row>
      </DrawerFooter>
    </Form>
  );
}
