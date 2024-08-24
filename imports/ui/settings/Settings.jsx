import React from "react";
import useSettings from "./settings.hook";
import { Meteor } from "meteor/meteor";
import Logo from "../logo/Logo";
import { Col, Form, Input, Row, Typography, Upload } from "antd";
import Dragger from "antd/es/upload/Dragger";

async function getEventValue(key, e) {
  switch (key) {
    case "community-title":
      return e.target.value;
    case "community-logo":
      return await transformFileToBase64(e);
    default:
      return e.target.value;
  }
}

async function transformFileToBase64(file) {
  const image = await turnImageFileIntoWebp(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(image);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
}

async function turnImageFileIntoWebp(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/webp");
    };
    img.onerror = (error) => reject(error);
    img.src = URL.createObjectURL(file);
  });
}

export default function Settings() {
  const [form] = Form.useForm();
  const [disabled, setDisabled] = React.useState(false);
  const { ready, communityTitle, communityLogo } = useSettings();
  console.log({ ready, communityTitle });

  React.useEffect(() => {
    if (!ready) {
      form.setFieldValue("community-title", "");
      form.setFieldValue("community-logo", undefined);
      setDisabled(true);
    } else {
      form.setFieldValue("community-title", communityTitle);
      form.setFieldValue("community-logo", communityLogo);
      setDisabled(false);
    }
  }, [ready, communityTitle, communityLogo]);

  async function handleChange(e, key) {
    setDisabled(true);
    const value = await getEventValue(key, e);
    Meteor.callAsync("settings.upsert", key, value)
      .catch((error) => {
        alert(
          JSON.stringify(
            { error: error.error, message: error.message },
            null,
            2
          )
        );
      })
      .finally(() => {
        setDisabled(false);
      });
  }

  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={2}>Settings</Typography.Title>
      </Col>
      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Form
              form={form}
              layout="vertical"
              initialValues={form.getFieldsValue()}
            >
              <Form.Item name="community-title" label="Community Title">
                <Input
                  placeholder="Enter title"
                  disabled={disabled}
                  onBlur={(e) => handleChange(e, "community-title")}
                />
              </Form.Item>
              <Form.Item name="community-logo" label="Community Logo">
                <Dragger
                  disabled={disabled}
                  beforeUpload={(file) => handleChange(file, "community-logo")}
                  action={""}
                  accept="image/*"
                  multiple={false}
                  showUploadList={false}
                >
                  <Logo src={communityLogo} />
                </Dragger>
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </Col>
    </Row>
  );
}
