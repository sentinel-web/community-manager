import { Alert, App, Button, Col, Form, Input, InputNumber, Row, Switch } from 'antd';
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
  // Track name/id availability as independent signals and derive disableSubmit
  // from them. Folding both into one state let the two async validations
  // clobber each other (last-writer-wins), so an in-use name could be masked by
  // an available id. Rules acceptance is enforced via a field validator below,
  // not here, so the button stays clickable on an empty form (to surface the
  // required-field errors).
  const [nameAvailable, setNameAvailable] = useState(true);
  const [idAvailable, setIdAvailable] = useState(true);
  const disableSubmit = useMemo(() => !nameAvailable || !idAvailable, [nameAvailable, idAvailable]);
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
        setNameAvailable(result);
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
        setIdAvailable(result);
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
      // Guard the submit itself, not just the footer button. The button's
      // `disabled` blocks clicks, but Enter-to-submit fires through the form's
      // hidden submit button — which bypasses `disableSubmit` (rules not
      // accepted / name or id already in use) unless we re-check here.
      if (loading || disableSubmit) return;
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
    [resolve, model, message, notification, t, loading, disableSubmit],
  );

  const handleValuesChange = useCallback(
    (changedValues: Partial<RegistrationFormValues>, values: RegistrationFormValues) => {
      if ('name' in values) {
        validateName();
      }
      if ('id' in values) {
        validateId();
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
      <Form.Item
        name="rulesReadAndAccepted"
        label={t('forms.labels.rulesAccepted')}
        rules={[
          {
            validator: (_, value) => (value ? Promise.resolve() : Promise.reject(new Error(t('forms.tooltips.pleaseReadAndAcceptRules')))),
          },
        ]}
        required
      >
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
            <Button type="primary" onClick={() => form.submit()} loading={loading} disabled={disableSubmit}>
              {t('common.submit')}
            </Button>
          </Col>
        </Row>
      </DrawerFooter>
    </Form>
  );
}
