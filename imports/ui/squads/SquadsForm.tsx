import { Col, ColorPicker, Form, Input, Row, Switch, Upload } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { Meteor } from 'meteor/meteor';
import React, { useEffect, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import type { Squad } from '../../api/types/squad';
import { useDrawerFrame } from '../drawer-stack';
import useMethod from '../hooks/useMethod';
import FormFooter from '../components/FormFooter';
import { turnBase64ToImage, turnImageFileToBase64 } from '../profile-picture-input/ProfilePictureInput';
import { getColorFromValues } from '../specializations/SpecializationForm';
import SquadsSelect from './SquadsSelect';

interface SquadsFormValues {
  name?: string;
  color?: string | { toHexString?: () => string };
  image?: string | null;
  parentSquadId?: string;
  shortRangeFrequency?: string;
  longRangeFrequency?: string;
  description?: string;
  excludeFromOrbat?: boolean;
}

const SquadsForm = () => {
  const { t } = useTranslation();
  const { model, resolve, cancel } = useDrawerFrame<string, Partial<Squad> & { _id?: string }>();

  const squad = (model || {}) as unknown as Squad;

  const { call, loading } = useMethod<string | undefined>(Meteor.user() && squad?._id ? 'squads.update' : 'squads.insert', {
    success: squad?._id ? t('messages.squadUpdated') : t('messages.squadCreated'),
  });

  const [file, setFile] = useState<RcFile | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!squad.image) return;
    setImageSrc(squad.image);
  }, [squad.image]);

  const handleCustomRequest = async () => {
    try {
      const base64 = await turnImageFileToBase64(file as Blob);
      const data = await turnBase64ToImage(base64);
      setImageSrc(data.src);
    } catch {
      setImageSrc(null);
    }
  };

  const handleBeforeUpload = (_: RcFile, fileList: RcFile[]) => {
    return setFile(fileList[0]);
  };

  const handleFinish = async (values: SquadsFormValues) => {
    const color = getColorFromValues(values);
    values.color = color;
    const image = imageSrc;
    values.image = image;
    const args = [...(squad?._id ? [squad._id] : []), values];
    const res = await call(...args);
    if (!res.ok) return;
    resolve(squad?._id ?? res.data);
  };

  return (
    <Form layout="vertical" initialValues={squad} onFinish={handleFinish} disabled={loading}>
      <Form.Item label={t('squads.logo')} name="image" rules={[{ required: false }]}>
        <Upload.Dragger
          fileList={file ? [file] : []}
          accept="image/*"
          beforeUpload={handleBeforeUpload}
          customRequest={handleCustomRequest}
          showUploadList={false}
        >
          {imageSrc ? <img style={{ maxHeight: 140, aspectRatio: '1 / 1' }} src={imageSrc} alt="avatar" /> : <>{t('squads.dragOrClick')}</>}
        </Upload.Dragger>
      </Form.Item>
      <Row gutter={[16, 16]} align="middle" justify="space-between">
        <Col flex="auto">
          <Form.Item label={t('common.name')} name="name" rules={[{ required: true, type: 'string' }]} required>
            <Input placeholder={t('forms.placeholders.enterName')} />
          </Form.Item>
        </Col>
        <Col>
          <Form.Item label={t('common.color')} name="color" rules={[{ required: false }]}>
            <ColorPicker />
          </Form.Item>
        </Col>
      </Row>
      <SquadsSelect
        label={t('squads.parentSquad')}
        name="parentSquadId"
        rules={[{ required: false, type: 'string' }]}
        defaultValue={squad.parentSquadId}
      />
      <Form.Item label={t('squads.shortRangeFrequency')} name="shortRangeFrequency" rules={[{ required: false, type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterShortRangeFrequency')} />
      </Form.Item>
      <Form.Item label={t('squads.longRangeFrequency')} name="longRangeFrequency" rules={[{ required: false, type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterLongRangeFrequency')} />
      </Form.Item>
      <Form.Item label={t('common.description')} name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <Form.Item label={t('squads.excludeFromOrbat')} name="excludeFromOrbat" valuePropName="checked">
        <Switch />
      </Form.Item>
      <FormFooter onCancel={cancel} loading={loading} />
    </Form>
  );
};

export default SquadsForm;
