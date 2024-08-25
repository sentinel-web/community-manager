import React from "react";
import useSettings from "./settings.hook";
import { Meteor } from "meteor/meteor";
import Logo from "../logo/Logo";
import { Col, ColorPicker, Input, Row, Typography } from "antd";
import Dragger from "antd/es/upload/Dragger";
import SectionCard from "../section-card/SectionCard";

async function getEventValue(key, e) {
  switch (key) {
    case "community-title":
      return e.target.value;
    case "community-logo":
      return await transformFileToBase64(e);
    case "community-color":
      return e.toHexString ? e.toHexString() : undefined;
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
  const { ready, communityTitle, communityLogo, communityColor } =
    useSettings();

  async function handleChange(e, key) {
    const value = await getEventValue(key, e);
    Meteor.callAsync("settings.upsert", key, value).catch((error) => {
      alert(
        JSON.stringify({ error: error.error, message: error.message }, null, 2)
      );
    });
  }

  return (
    <SectionCard title="Settings" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Row gutter={[16, 16]}>
                <Col xs={24} lg={12}>
                  <CommunityTitleSettings
                    communityTitle={communityTitle}
                    handleChange={handleChange}
                  />
                </Col>
                <Col xs={24} lg={12}>
                  <CommunityColorSettings
                    communityColor={communityColor}
                    handleChange={handleChange}
                  />
                </Col>
                <Col span={24}>
                  <CommunityLogoSettings
                    communityLogo={communityLogo}
                    handleChange={handleChange}
                  />
                </Col>
              </Row>
            </Col>
          </Row>
        </Col>
      </Row>
    </SectionCard>
  );
}

function SettingTitle({ title }) {
  return (
    <Col span={24}>
      <Typography.Title level={3}>{title}</Typography.Title>
    </Col>
  );
}

function CommunityTitleSettings({ communityTitle, handleChange }) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Community Title" />
      <Col span={24}>
        <Input
          placeholder="Enter title"
          value={communityTitle}
          onChange={(e) => handleChange(e, "community-title")}
        />
      </Col>
    </Row>
  );
}

function CommunityLogoSettings({ communityLogo, handleChange }) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Community Logo" />
      <Col span={24}>
        <Dragger
          beforeUpload={(file) => handleChange(file, "community-logo")}
          action=""
          accept="image/*"
          multiple={false}
          showUploadList={false}
        >
          <Logo src={communityLogo} />
        </Dragger>
      </Col>
    </Row>
  );
}

function CommunityColorSettings({ communityColor, handleChange }) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Community Color" />
      <Col span={24}>
        <ColorPicker
          defaultValue={communityColor}
          onChange={(color) => handleChange(color, "community-color")}
        />
      </Col>
    </Row>
  );
}
