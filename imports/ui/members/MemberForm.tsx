import { Alert, Button, Col, DatePicker, Divider, Form, Input, InputNumber, Row, Switch } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import RanksCollection from '../../api/collections/ranks.collection';
import RolesCollection from '../../api/collections/roles.collection';
import type { Member } from '../../api/types/member';
import { useTranslation } from '../../i18n/LanguageContext';
import { DrawerFooter, useDrawerFrame } from '../drawer-stack';
import useMethod from '../hooks/useMethod';
import CollectionSelect, { type CollectionDoc } from '../components/CollectionSelect';
import { getDateFromValues } from '../events/EventForm';
import ProfilePictureInput from '../profile-picture-input/ProfilePictureInput';
import SpecializationsSelect from '../specializations/SpecializationsSelect';
import SquadsSelect from '../squads/SquadsSelect';
import MedalsSelect from './medals/MedalsSelect';
import PositionsSelect from './positions/PositionsSelect';
import RanksForm from './ranks/RanksForm';
import RolesForm from './roles/RolesForm';

const styles = {
  datePicker: {
    width: '100%',
  },
};

type ValidationStatus = 'success' | 'warning' | 'error' | 'validating' | undefined;

interface MemberFormProfile {
  profilePictureId?: string;
  name?: string;
  id?: number | null;
  rankId?: string | null;
  navyRankId?: string | null;
  specializationIds?: string[];
  roleId?: string | null;
  squadId?: string | null;
  discordTag?: string;
  steamProfileLink?: string;
  staticAttendancePoints?: number | null;
  staticInactivityPoints?: number | null;
  medalIds?: string[];
  positionId?: string | null;
  description?: string;
  entryDate?: Dayjs | null;
  exitDate?: Dayjs | null;
  hasCustomArmour?: boolean;
}

interface MemberFormValues {
  username?: string;
  password?: string;
  profile?: MemberFormProfile;
}

export const transformDateToDays = (values: Record<string, unknown>, key = 'date'): Dayjs | undefined => {
  if (values[key]) return dayjs(values[key] as dayjs.ConfigType);
  return values[key] as undefined;
};

export default function MemberForm() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [form] = Form.useForm<any>();
  const { t } = useTranslation();
  // Independent availability signals derived into disableSubmit — see the same
  // pattern in RegistrationForm. Previously a single disableSubmit was written
  // by two async validations that clobbered each other; here they also never
  // fired at all, because the checks below used the wrong (top-level) field
  // paths and the registrations collection instead of members.
  const [nameAvailable, setNameAvailable] = useState(true);
  const [idAvailable, setIdAvailable] = useState(true);
  const disableSubmit = useMemo(() => !nameAvailable || !idAvailable, [nameAvailable, idAvailable]);
  const [nameError, setNameError] = useState<ValidationStatus>(undefined);
  const [idError, setIdError] = useState<ValidationStatus>(undefined);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const { model: rawModel, resolve, cancel } = useDrawerFrame<string, Partial<Member>>();
  const model = useMemo(() => (rawModel || {}) as Member, [rawModel]);

  const { call, loading } = useMethod<string | undefined>(Meteor.user() && model?._id ? 'members.update' : 'members.insert', {
    success: t('messages.saveSuccessful'),
  });

  useEffect(() => {
    if (Object.keys(model).length > 0) {
      const data = { ...model } as Record<string, unknown>;
      const profile = data.profile as Record<string, unknown>;
      profile.entryDate = transformDateToDays(profile, 'entryDate');
      profile.exitDate = transformDateToDays(profile, 'exitDate');
      data.profile = profile;
      form.setFieldsValue(data as unknown as MemberFormValues);
    } else {
      form.setFieldsValue({
        username: '',
        password: '',
        profile: {
          profilePictureId: '',
          name: '',
          id: null,
          rankId: null,
          navyRankId: null,
          specializationIds: [],
          roleId: null,
          squadId: null,
          discordTag: '',
          steamProfileLink: '',
          staticAttendancePoints: null,
          staticInactivityPoints: null,
          medalIds: [],
          positionId: null,
          description: '',
          entryDate: null,
          exitDate: null,
        },
      });
      setFileList([]);
    }
  }, [model, form.setFieldsValue]);

  const validateName = useCallback(() => {
    const value = form.getFieldValue(['profile', 'name']);
    setNameError('validating');
    Meteor.callAsync('members.validateName', value, model?._id || false)
      .then((result: boolean) => {
        setNameError(result ? 'success' : 'error');
        setNameAvailable(result);
      })
      .catch(() => {
        setNameError('warning');
      });
  }, [form, model?._id]);

  const validateId = useCallback(() => {
    const value = form.getFieldValue(['profile', 'id']);
    setIdError('validating');
    Meteor.callAsync('members.validateId', value, model?._id || false)
      .then((result: boolean) => {
        setIdError(result ? 'success' : 'error');
        setIdAvailable(result);
      })
      .catch(() => {
        setIdError('warning');
      });
  }, [form, model?._id]);

  const handleSubmit = useCallback(
    async (values: MemberFormValues) => {
      // Guard the submit itself, not just the footer button. The button's
      // `disabled` blocks clicks, but Enter-to-submit fires through the form's
      // hidden submit button — which bypasses `disableSubmit` (name or id
      // already in use / rules not accepted) unless we re-check here.
      if (loading || disableSubmit) return;
      const payload = {
        ...values,
        profile: {
          ...values.profile,
          entryDate: getDateFromValues(values.profile as unknown as Record<string, unknown>, 'entryDate'),
          exitDate: getDateFromValues(values.profile as unknown as Record<string, unknown>, 'exitDate'),
        },
      };
      const args = model?._id ? [model._id, payload] : [payload];
      const res = await call(...args);
      if (!res.ok) return;
      resolve(model?._id ?? res.data);
    },
    [model?._id, resolve, call, loading, disableSubmit]
  );

  const handleValuesChange = useCallback(
    (changedValues: MemberFormValues) => {
      // name/id live under `profile`, so inspect the changed nested keys.
      const changedProfile = (changedValues as { profile?: Record<string, unknown> }).profile;
      if (changedProfile && 'name' in changedProfile) {
        validateName();
      }
      if (changedProfile && 'id' in changedProfile) {
        validateId();
      }
    },
    [validateName, validateId]
  );

  const handleCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  useEffect(() => {
    handleValuesChange({} as MemberFormValues);
  }, [model, handleValuesChange]);

  return (
    <Form autoComplete="off" form={form} layout="vertical" onFinish={handleSubmit} onValuesChange={handleValuesChange} disabled={loading}>
      <Form.Item name={['profile', 'profilePictureId']} hidden />
      <Row justify="center" align="middle">
        <Col span={24}>
          <ProfilePictureInput fileList={fileList} setFileList={setFileList} form={form} profilePictureId={model?.profile?.profilePictureId} />
        </Col>
      </Row>
      <Divider>{t('forms.sections.memberAccount')}</Divider>
      <Form.Item name="username" label={t('auth.username')} rules={[{ required: true, type: 'string' }]} required>
        <Input placeholder={t('forms.placeholders.enterUsername')} />
      </Form.Item>
      {!model?._id && (
        <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, type: 'string' }]} required>
          <Input.Password placeholder={t('forms.placeholders.enterPassword')} />
        </Form.Item>
      )}
      <Divider>{t('forms.sections.memberProfile')}</Divider>
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
      <Form.Item
        name={['profile', 'id']}
        label={t('forms.labels.id')}
        rules={[
          { required: true, type: 'number' },
          { min: 1000, max: 9999, type: 'number' },
        ]}
        status={idError}
        required
      >
        <InputNumber min={1000} max={9999} step={1} placeholder={t('forms.placeholders.enterId')} />
      </Form.Item>
      <Form.Item name={['profile', 'name']} label={t('common.name')} rules={[{ required: true, type: 'string' }]} status={nameError} required>
        <Input placeholder={t('forms.placeholders.enterName')} />
      </Form.Item>
      <SquadsSelect
        multiple={false}
        name={['profile', 'squadId']}
        label={t('members.squad')}
        rules={[{ type: 'string' }]}
        defaultValue={model?.profile?.squadId}
      />
      <CollectionSelect
        defaultValue={model?.profile?.rankId}
        FormComponent={RanksForm}
        name={['profile', 'rankId']}
        label={t('members.rank')}
        placeholder={t('common.selectRank')}
        rules={[{ type: 'string' }]}
        collection={RanksCollection as unknown as Mongo.Collection<CollectionDoc>}
        subscription="ranks"
        query={{ type: 'player' }}
      />
      <CollectionSelect
        defaultValue={model?.profile?.navyRankId}
        FormComponent={RanksForm}
        name={['profile', 'navyRankId']}
        label={t('forms.labels.navyRank')}
        placeholder={t('common.selectRank')}
        rules={[{ type: 'string' }]}
        collection={RanksCollection as unknown as Mongo.Collection<CollectionDoc>}
        subscription="ranks"
        query={{ type: 'zeus' }}
      />
      <PositionsSelect
        name={['profile', 'positionId']}
        label={t('members.position')}
        rules={[{ type: 'string' }]}
        defaultValue={model?.profile?.positionId}
      />
      {Meteor.user() && (
        <Form.Item name={['profile', 'description']} label={t('common.description')} rules={[{ type: 'string' }]}>
          <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
        </Form.Item>
      )}
      <Divider>{t('forms.sections.adminData')}</Divider>
      <SpecializationsSelect
        name={['profile', 'specializationIds']}
        label={t('members.specializations')}
        rules={[{ type: 'array' }]}
        defaultValue={model?.profile?.specializationIds}
        multiple
      />
      <MedalsSelect
        name={['profile', 'medalIds']}
        label={t('members.medals')}
        rules={[{ type: 'array' }]}
        defaultValue={model?.profile?.medalIds}
        multiple
      />
      <CollectionSelect
        name={['profile', 'roleId']}
        label={t('forms.labels.role')}
        placeholder={t('forms.placeholders.selectRole')}
        rules={[{ type: 'string' }]}
        subscription="roles"
        FormComponent={RolesForm}
        defaultValue={model?.profile?.roleId}
        collection={RolesCollection as unknown as Mongo.Collection<CollectionDoc>}
      />
      <Form.Item name={['profile', 'discordTag']} label={t('members.discordTag')} rules={[{ type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterDiscordTag')} />
      </Form.Item>
      <Form.Item name={['profile', 'steamProfileLink']} label={t('forms.labels.steamProfileLink')} rules={[{ type: 'url' }]}>
        <Input placeholder={t('forms.placeholders.enterSteamProfileLink')} />
      </Form.Item>
      <Form.Item name={['profile', 'staticAttendancePoints']} label={t('forms.labels.staticAttendancePoints')} rules={[{ type: 'number' }]}>
        <InputNumber min={0} placeholder={t('forms.placeholders.enterStaticAttendancePoints')} />
      </Form.Item>
      <Form.Item name={['profile', 'staticInactivityPoints']} label={t('forms.labels.staticInactivityPoints')} rules={[{ type: 'number' }]}>
        <InputNumber min={0} placeholder={t('forms.placeholders.enterStaticInactivityPoints')} />
      </Form.Item>
      <Form.Item name={['profile', 'entryDate']} label={t('members.entryDate')} rules={[{ type: 'date' }]}>
        <DatePicker style={styles.datePicker} placeholder={t('common.selectDate')} />
      </Form.Item>
      <Form.Item name={['profile', 'exitDate']} label={t('members.exitDate')} rules={[{ type: 'date' }]}>
        <DatePicker style={styles.datePicker} placeholder={t('common.selectDate')} />
      </Form.Item>
      <Form.Item
        name={['profile', 'hasCustomArmour']}
        label={t('forms.labels.hasCustomArmour')}
        valuePropName="checked"
        rules={[{ type: 'boolean' }]}
      >
        <Switch />
      </Form.Item>
      <DrawerFooter>
        <Row gutter={[16, 16]} align="middle" justify="end">
          <Col>
            <Button onClick={handleCancel} danger>
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
