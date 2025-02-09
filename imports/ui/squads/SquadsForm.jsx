import { Button, Col, ColorPicker, Form, Input, Row, Upload } from 'antd';
import React, { useContext, useEffect, useMemo, useState } from 'react';
import { DrawerContext, SubdrawerContext } from '../app/App';
import { turnBase64ToImage, turnImageFileToBase64 } from '../profile-picture-input/ProfilePictureInput';
import { Meteor } from 'meteor/meteor';
import { getColorFromValues } from '../specializations/SpecializationForm';
import SquadsSelect from './SquadsSelect';

const SquadsForm = ({ setOpen, useSubdrawer = false }) => {
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
      <Form.Item label="Squad Logo" name="image" rules={[{ required: false }]}>
        <Upload.Dragger
          fileList={file ? [file] : []}
          accept="image/*"
          beforeUpload={handleBeforeUpload}
          customRequest={handleCustomRequest}
          showUploadList={false}
        >
          {imageSrc ? <img style={{ maxHeight: 140, aspectRatio: '1 / 1' }} src={imageSrc} alt="avatar" /> : <>Drag and drop or click to upload</>}
        </Upload.Dragger>
      </Form.Item>
      <Row gutter={[16, 16]} align="middle" justify="space-between">
        <Col flex="auto">
          <Form.Item label="Name" name="name" rules={[{ required: true, type: 'string' }]} required>
            <Input placeholder="Enter name" />
          </Form.Item>
        </Col>
        <Col>
          <Form.Item label="Color" name="color" rules={[{ required: false }]}>
            <ColorPicker />
          </Form.Item>
        </Col>
      </Row>
      <SquadsSelect label="Parent Squad" name="parentSquadId" rules={[{ required: false, type: 'string' }]} />
      <Form.Item label="Short Range Frequency" name="shortRangeFrequency" rules={[{ required: false, type: 'string' }]}>
        <Input placeholder="Enter icon" />
      </Form.Item>
      <Form.Item label="Description" name="description" rules={[{ required: false, type: 'string' }]}>
        <Input.TextArea autoSize placeholder="Enter description" />
      </Form.Item>
      <Row gutter={[16, 16]} align="middle" justify="end">
        <Col>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
        </Col>
        <Col>
          <Button type="primary" htmlType="submit">
            Save
          </Button>
        </Col>
      </Row>
    </Form>
  );
};

export default SquadsForm;
