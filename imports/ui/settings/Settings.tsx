import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Col, ColorPicker, Input, List, Popconfirm, Row, Typography } from 'antd';
import Dragger from 'antd/es/upload/Dragger';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useContext, useState } from 'react';
import { type LanguageContextValue, useTranslation } from '../../i18n/LanguageContext';
import Logo from '../logo/Logo';
import useNavigation from '../navigation/navigation.hook';
import SectionCard from '../section/SectionCard';
import TourContext, { useTourRef } from '../tour/TourContext';
import useSettings from './settings.hook';

type TFn = LanguageContextValue['t'];
type HandleChangeFn = (e: unknown, key: string) => void | Promise<void>;

const emptyStringList: string[] = [];
const noopHandleChange: HandleChangeFn = () => {};

async function getEventValue(key: string, e: unknown): Promise<string | string[] | undefined> {
  switch (key) {
    case 'community-title':
      return (e as React.ChangeEvent<HTMLInputElement>).target.value;
    case 'community-logo':
      return await transformFileToBase64(e as File);
    case 'community-color': {
      const colorObj = e as { toHexString?: () => string };
      return colorObj.toHexString ? colorObj.toHexString() : undefined;
    }
    default:
      return (e as { target: { value: string } }).target.value;
  }
}

async function transformFileToBase64(file: File): Promise<string> {
  const image = await turnImageFileIntoWebp(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(image);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
}

async function turnImageFileIntoWebp(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx!.drawImage(img, 0, 0);
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('canvas.toBlob returned null'));
        }
      }, 'image/webp');
    };
    img.onerror = error => reject(error);
    img.src = URL.createObjectURL(file);
  });
}

export default function Settings() {
  const settingsRef = useTourRef('settings-section');
  const { ready, communityTitle, communityLogo, communityColor, communityNameBlackList, communityIdBlackList } = useSettings();
  const { t } = useTranslation();

  const handleChange: HandleChangeFn = useCallback(async (e: unknown, key: string) => {
    const value = await getEventValue(key, e);
    Meteor.callAsync('settings.upsert', key, value).catch(error => {
      alert(JSON.stringify({ error: error.error, message: error.message }, null, 2));
    });
  }, []);

  return (
    <div ref={settingsRef}>
      <SectionCard title={t('settings.title')} ready={ready}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <Row gutter={[16, 16]}>
                  <Col span={24}>
                    <CommunityLogoSettings communityLogo={communityLogo} handleChange={handleChange} t={t} />
                  </Col>
                  <Col xs={24} lg={12}>
                    <CommunityTitleSettings communityTitle={communityTitle} handleChange={handleChange} t={t} />
                  </Col>
                  <Col xs={24} lg={12}>
                    <CommunityColorSettings communityColor={communityColor} handleChange={handleChange} t={t} />
                  </Col>
                  <Col xs={24} lg={12}>
                    <CommunityNameBlackListSettings communityNameBlackList={communityNameBlackList} handleChange={handleChange} t={t} />
                  </Col>
                  <Col xs={24} lg={12}>
                    <CommunityIdBlackListSettings communityIdBlackList={communityIdBlackList} handleChange={handleChange} t={t} />
                  </Col>
                  {Meteor.isDevelopment && (
                    <Col span={24}>
                      <DemoDataSettings t={t} />
                    </Col>
                  )}
                  {Meteor.isDevelopment && (
                    <Col span={24}>
                      <TourSettings t={t} />
                    </Col>
                  )}
                </Row>
              </Col>
            </Row>
          </Col>
        </Row>
      </SectionCard>
    </div>
  );
}

interface SettingTitleProps {
  title?: string;
}

function SettingTitle({ title }: SettingTitleProps) {
  return (
    <Col span={24}>
      <Typography.Title level={3}>{title}</Typography.Title>
    </Col>
  );
}

interface CommunityNameBlackListSettingsProps {
  communityNameBlackList?: string[];
  handleChange?: HandleChangeFn;
  t: TFn;
}

function CommunityNameBlackListSettings({ communityNameBlackList = emptyStringList, handleChange = noopHandleChange, t }: CommunityNameBlackListSettingsProps) {
  const [value, setValue] = useState('');

  const handleClick = useCallback(() => {
    if (value) {
      const newList = [...communityNameBlackList, value];
      handleChange({ target: { value: newList } }, 'community-name-black-list');
      setValue('');
    }
  }, [value, communityNameBlackList, handleChange]);

  const handleDelete = useCallback(
    (item: string) => {
      const newList = communityNameBlackList.filter(name => name !== item);
      handleChange({ target: { value: newList } }, 'community-name-black-list');
    },
    [communityNameBlackList, handleChange],
  );

  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('settings.memberNameBlacklist')} />
      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col flex="auto">
            <Input
              value={value}
              style={{ width: '100%' }}
              placeholder={t('settings.enterBlacklistedName')}
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

interface CommunityIdBlackListSettingsProps {
  communityIdBlackList?: string[];
  handleChange?: HandleChangeFn;
  t: TFn;
}

function CommunityIdBlackListSettings({ communityIdBlackList = emptyStringList, handleChange = noopHandleChange, t }: CommunityIdBlackListSettingsProps) {
  const [value, setValue] = useState('');

  const handleClick = useCallback(() => {
    if (value) {
      const newList = [...communityIdBlackList, value];
      handleChange({ target: { value: newList } }, 'community-id-black-list');
      setValue('');
    }
  }, [value, communityIdBlackList, handleChange]);

  const handleDelete = useCallback(
    (item: string) => {
      const newList = communityIdBlackList.filter(name => name !== item);
      handleChange({ target: { value: newList } }, 'community-id-black-list');
    },
    [communityIdBlackList, handleChange],
  );

  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('settings.memberIdBlacklist')} />
      <Col span={24}>
        <Row gutter={[16, 16]}>
          <Col flex="auto">
            <Input
              value={value}
              style={{ width: '100%' }}
              placeholder={t('settings.enterBlacklistedId')}
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

interface CommunityTitleSettingsProps {
  communityTitle?: string;
  handleChange?: HandleChangeFn;
  t: TFn;
}

function CommunityTitleSettings({ communityTitle, handleChange = () => {}, t }: CommunityTitleSettingsProps) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('settings.communityTitle')} />
      <Col span={24}>
        <Input placeholder={t('settings.enterTitle')} value={communityTitle} onChange={e => handleChange(e, 'community-title')} />
      </Col>
    </Row>
  );
}

interface CommunityLogoSettingsProps {
  communityLogo?: string;
  handleChange?: HandleChangeFn;
  t: TFn;
}

function CommunityLogoSettings({ communityLogo, handleChange = () => {}, t }: CommunityLogoSettingsProps) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('settings.communityLogo')} />
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

interface CommunityColorSettingsProps {
  communityColor?: string;
  handleChange?: HandleChangeFn;
  t: TFn;
}

function CommunityColorSettings({ communityColor, handleChange = () => {}, t }: CommunityColorSettingsProps) {
  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('settings.communityColor')} />
      <Col span={24}>
        <ColorPicker defaultValue={communityColor} onChange={color => handleChange(color, 'community-color')} />
      </Col>
    </Row>
  );
}

interface DemoDataSettingsProps {
  t: TFn;
}

function DemoDataSettings({ t }: DemoDataSettingsProps) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    try {
      await Meteor.callAsync('demoData.generate');
      alert(t('settings.generateDemoDataSuccess'));
      window.location.reload();
    } catch (error) {
      alert(t('settings.generateDemoDataError') + ': ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('settings.generateDemoData')} />
      <Col span={24}>
        <Popconfirm
          title={t('settings.generateDemoDataConfirm')}
          onConfirm={handleGenerate}
          okText={t('common.yes')}
          cancelText={t('common.cancel')}
          okButtonProps={{ danger: true }}
        >
          <Button danger loading={loading}>
            {t('settings.generateDemoData')}
          </Button>
        </Popconfirm>
      </Col>
    </Row>
  );
}

interface TourSettingsProps {
  t: TFn;
}

function TourSettings({ t }: TourSettingsProps) {
  const { startTour } = useContext(TourContext);
  const { setNavigationValue } = useNavigation();

  const handleStartTour = useCallback(() => {
    setNavigationValue('dashboard');
    window.history.pushState(null, '', `${window.location.origin}/dashboard`);
    setTimeout(() => startTour(), 300);
  }, [startTour, setNavigationValue]);

  return (
    <Row gutter={[16, 16]}>
      <SettingTitle title={t('tour.startTour')} />
      <Col span={24}>
        <Popconfirm
          title={t('tour.startTourConfirm')}
          onConfirm={handleStartTour}
          okText={t('common.yes')}
          cancelText={t('common.cancel')}
        >
          <Button type="primary">{t('tour.startTour')}</Button>
        </Popconfirm>
      </Col>
    </Row>
  );
}
