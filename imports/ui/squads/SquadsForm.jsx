import { Col, ColorPicker, Form, Input, Row, Upload } from 'antd';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';
import { DrawerContext, SubdrawerContext } from '../app/App';
import FormFooter from '../components/FormFooter';
import { turnBase64ToImage, turnImageFileToBase64 } from '../profile-picture-input/ProfilePictureInput';
import { getColorFromValues } from '../specializations/SpecializationForm';
import SquadsSelect from './SquadsSelect';

const SquadsForm = ({ setOpen, useSubdrawer = false }) => {
  const { t } = useTranslation();
  const drawer = useContext(DrawerContext);
  const subdrawer = useContext(SubdrawerContext);

  const model = useMemo(() => {
    return useSubdrawer ? subdrawer.drawerModel || {} : drawer.drawerModel || {};
  }, [drawer, subdrawer, useSubdrawer]);

  const [file, setFile] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);

  useEffect(() => {
    if (!model.image) return;
    setImageSrc(model.image);
  }, [model]);

  const handleCustomRequest = async () => {
    try {
      const base64 = await turnImageFileToBase64(file);
      const data = await turnBase64ToImage(base64);
      setImageSrc(data.src);
    } catch (error) {
      console.error(error);
      setImageSrc(null);
    }
  };

  const handleBeforeUpload = (_, fileList) => {
    return setFile(fileList[0]);
  };

  const handleFinish = async values => {
    const color = getColorFromValues(values);
    values.color = color;
    const image = imageSrc;
    values.image = image;
    const args = [...(model?._id ? [model._id] : []), values];
    Meteor.callAsync(Meteor.user() && model?._id ? 'squads.update' : 'squads.insert', ...args)
      .then(() => {
        setOpen(false);
      })
      .catch(error => {
        console.error(error);
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
      <SquadsSelect label={t('squads.parentSquad')} name="parentSquadId" rules={[{ required: false, type: 'string' }]} defaultValue={model.parentSquadId} />
      <Form.Item label={t('squads.shortRangeFrequency')} name="shortRangeFrequency" rules={[{ required: false, type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterShortRangeFrequency')} />
      </Form.Item>
      <Form.Item label={t('squads.longRangeFrequency')} name="longRangeFrequency" rules={[{ required: false, type: 'string' }]}>
        <Input placeholder={t('forms.placeholders.enterLongRangeFrequency')} />
      </Form.Item>
      <Form.Item label={t('common.description')} name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder={t('forms.placeholders.enterDescription')} />
      </Form.Item>
      <FormFooter setOpen={setOpen} />
    </Form>
  );
};
SquadsForm.propTypes = {
  setOpen: PropTypes.func,
  useSubdrawer: PropTypes.bool,
};

export default SquadsForm;
