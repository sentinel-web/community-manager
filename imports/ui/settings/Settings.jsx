import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, ColorPicker, Input, List, Row, Typography } from 'antd';
import Dragger from 'antd/es/upload/Dragger';
import { Meteor } from 'meteor/meteor';
import PropTypes from 'prop-types';
import React, { useCallback, useState } from 'react';
import Logo from '../logo/Logo';
import SectionCard from '../section/SectionCard';
import useSettings from './settings.hook';

async function getEventValue(key, e) {
  switch (key) {
    case 'community-title':
      return e.target.value;
    case 'community-logo':
      return await transformFileToBase64(e);
    case 'community-color':
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
    reader.onerror = error => reject(error);
  });
}

async function turnImageFileIntoWebp(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        resolve(blob);
      }, 'image/webp');
    };
    img.onerror = error => reject(error);
    img.src = URL.createObjectURL(file);
  });
}

export default function Settings() {
  const { ready, communityTitle, communityLogo, communityColor, communityNameBlackList, communityIdBlackList } = useSettings();

  async function handleChange(e, key) {
    const value = await getEventValue(key, e);
    Meteor.callAsync('settings.upsert', key, value).catch(error => {
      alert(JSON.stringify({ error: error.error, message: error.message }, null, 2));
    });
  }

  return (
    <SectionCard title="Settings" ready={ready}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Row gutter={[16, 16]}>
                <Col span={24}>
                  <CommunityLogoSettings communityLogo={communityLogo} handleChange={handleChange} />
                </Col>
                <Col xs={24} lg={12}>
                  <CommunityTitleSettings communityTitle={communityTitle} handleChange={handleChange} />
                </Col>
                <Col xs={24} lg={12}>
                  <CommunityColorSettings communityColor={communityColor} handleChange={handleChange} />
                </Col>
                <Col xs={24} lg={12}>
                  <CommunityNameBlackListSettings communityNameBlackList={communityNameBlackList} handleChange={handleChange} />
                </Col>
                <Col xs={24} lg={12}>
                  <CommunityIdBlackListSettings communityIdBlackList={communityIdBlackList} handleChange={handleChange} />
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
SettingTitle.propTypes = {
  title: PropTypes.string,
};

function CommunityNameBlackListSettings({ communityNameBlackList, handleChange }) {
  const [value, setValue] = useState('');

  const handleClick = useCallback(() => {
    if (value) {
      const newList = [...communityNameBlackList, value];
      handleChange({ target: { value: newList } }, 'community-name-black-list');
      setValue('');
    }
  }, [value, communityNameBlackList, handleChange]);

  const handleDelete = useCallback(
    item => {
      const newList = communityNameBlackList.filter(name => name !== item);
      handleChange({ target: { value: newList } }, 'community-name-black-list');
    },
    [communityNameBlackList, handleChange]
  );

  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Member Name Black List" />
      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col flex="auto">
            <Input
              value={value}
              style={{ width: '100%' }}
              placeholder="Enter new black listed name"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleClick();
                }
              }}
              onChange={e => setValue(e.target.value)}
            />
          </Col>
          <Col>
            <Button icon={<PlusOutlined />} onClick={handleClick} type="primary" />
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <List
          bordered
          dataSource={communityNameBlackList}
          renderItem={item => (
            <List.Item actions={[<Button type="text" danger key={`delete-${item}`} icon={<DeleteOutlined />} onClick={() => handleDelete(item)} />]}>
              <Typography.Text>{item}</Typography.Text>
            </List.Item>
          )}
        />
      </Col>
    </Row>
  );
}
CommunityNameBlackListSettings.propTypes = {
  communityNameBlackList: PropTypes.array,
  handleChange: PropTypes.func,
};

function CommunityIdBlackListSettings({ communityIdBlackList, handleChange }) {
  const [value, setValue] = useState('');

  const handleClick = useCallback(() => {
    if (value) {
      const newList = [...communityIdBlackList, value];
      handleChange({ target: { value: newList } }, 'community-id-black-list');
      setValue('');
    }
  }, [value, communityIdBlackList, handleChange]);

  const handleDelete = useCallback(
    item => {
      const newList = communityIdBlackList.filter(name => name !== item);
      handleChange({ target: { value: newList } }, 'community-id-black-list');
    },
    [communityIdBlackList, handleChange]
  );

  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Member ID Black List" />
      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col flex="auto">
            <Input
              value={value}
              style={{ width: '100%' }}
              placeholder="Enter new black listed id"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleClick();
                }
              }}
              onChange={e => setValue(e.target.value)}
            />
          </Col>
          <Col>
            <Button icon={<PlusOutlined />} onClick={handleClick} type="primary" />
          </Col>
        </Row>
      </Col>
      <Col span={24}>
        <List
          bordered
          dataSource={communityIdBlackList}
          renderItem={item => (
            <List.Item actions={[<Button type="text" danger key={`delete-${item}`} icon={<DeleteOutlined />} onClick={() => handleDelete(item)} />]}>
              <Typography.Text>{item}</Typography.Text>
            </List.Item>
          )}
        />
      </Col>
    </Row>
  );
}
CommunityIdBlackListSettings.propTypes = {
  communityIdBlackList: PropTypes.array,
  handleChange: PropTypes.func,
};

function CommunityTitleSettings({ communityTitle, handleChange }) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Community Title" />
      <Col span={24}>
        <Input placeholder="Enter title" value={communityTitle} onChange={e => handleChange(e, 'community-title')} />
      </Col>
    </Row>
  );
}
CommunityTitleSettings.propTypes = {
  communityTitle: PropTypes.string,
  handleChange: PropTypes.func,
};

function CommunityLogoSettings({ communityLogo, handleChange }) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Community Logo" />
      <Col span={24}>
        <Dragger
          beforeUpload={file => handleChange(file, 'community-logo')}
          action=""
          accept=".jpg, .jpeg, .png"
          multiple={false}
          showUploadList={false}
        >
          <Logo src={communityLogo} />
        </Dragger>
      </Col>
    </Row>
  );
}
CommunityLogoSettings.propTypes = {
  communityLogo: PropTypes.string,
  handleChange: PropTypes.func,
};

function CommunityColorSettings({ communityColor, handleChange }) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title="Community Color" />
      <Col span={24}>
        <ColorPicker defaultValue={communityColor} onChange={color => handleChange(color, 'community-color')} />
      </Col>
    </Row>
  );
}
CommunityColorSettings.propTypes = {
  communityColor: PropTypes.string,
  handleChange: PropTypes.func,
};
