import { App, Col, ColorPicker, Form, Input, Row, Switch, Upload } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { Meteor } from 'meteor/meteor';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import type { Squad } from '../../api/types/squad';
import type { DrawerContextValue } from '../app/types';
import { DrawerContext, SubdrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';
import { turnBase64ToImage, turnImageFileToBase64 } from '../profile-picture-input/ProfilePictureInput';
import { getColorFromValues } from '../specializations/SpecializationForm';
import SquadsSelect from './SquadsSelect';

interface SquadsFormProps {
  setOpen: (open: boolean) => void;
  useSubdrawer?: boolean;
}

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

const SquadsForm = ({ setOpen, useSubdrawer = false }: SquadsFormProps) => {
  const { t } = useTranslation();
  const { message, notification } = App.useApp();
  const drawer = useContext(DrawerContext) as DrawerContextValue;
  const subdrawer = useContext(SubdrawerContext) as DrawerContextValue;

  const model = useMemo(() => {
    return useSubdrawer ? subdrawer.drawerModel || {} : drawer.drawerModel || {};
  }, [drawer, subdrawer, useSubdrawer]);

  const squad = model as unknown as Squad;

  const [file, setFile] = useState<RcFile | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!squad.image) return;
    setImageSrc(squad.image);
  }, [model]);

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
    Meteor.callAsync(Meteor.user() && squad?._id ? 'squads.update' : 'squads.insert', ...args)
      .then(() => {
        setOpen(false);
        message.success(squad?._id ? t('messages.squadUpdated') : t('messages.squadCreated'));
      })
      .catch(error => {
        notification.error({
          message: error.error,
          description: error.message,
        });
      });
  };

  return (
    <Form layout="vertical" initialValues={model} onFinish={handleFinish}>
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
      <SquadsSelect label={t('squads.parentSquad')} name="parentSquadId" rules={[{ required: false, type: 'string' }]} defaultValue={squad.parentSquadId} />
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
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};

export default SquadsForm;
