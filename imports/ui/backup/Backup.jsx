import { CloudDownloadOutlined, CloudUploadOutlined, InboxOutlined, SafetyOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Col, Descriptions, Modal, Progress, Row, Space, Typography, message } from 'antd';
import Dragger from 'antd/es/upload/Dragger';
import dayjs from 'dayjs';
import JSZip from 'jszip';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useState } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';
import SectionCard from '../section/SectionCard';

// Maximum backup file size: 50MB
const MAX_BACKUP_SIZE = 50 * 1024 * 1024;

export default function Backup() {
  const [loading, setLoading] = useState(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [backupData, setBackupData] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [createSafetyBackup, setCreateSafetyBackup] = useState(true);
  const [safetyBackupData, setSafetyBackupData] = useState(null);
  const { t } = useTranslation();

  const handleBackup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await Meteor.callAsync('backup.create');

      // Create ZIP archive
      const zip = new JSZip();
      zip.file('backup.json', JSON.stringify(data, null, 2));

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${dayjs().format('YYYY-MM-DD-HHmmss')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('backup.backupDownloaded'));
    } catch (error) {
      message.error(error.reason || error.message || t('backup.backupFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleFileUpload = useCallback(async file => {
    // Validate file size
    if (file.size > MAX_BACKUP_SIZE) {
      message.error(t('backup.fileTooLarge'));
      return false;
    }

    try {
      let data;

      // Check if it's a ZIP file or JSON file
      if (file.name.endsWith('.zip')) {
        // Extract JSON from ZIP
        const zip = await JSZip.loadAsync(file);
        const jsonFile = zip.file('backup.json');

        if (!jsonFile) {
          message.error(t('backup.invalidArchive'));
          return false;
        }

        const text = await jsonFile.async('string');
        data = JSON.parse(text);
      } else if (file.name.endsWith('.json')) {
        // Legacy support for plain JSON files
        const text = await file.text();
        data = JSON.parse(text);
      } else {
        message.error(t('backup.invalidFileType'));
        return false;
      }

      // Validate the backup
      const validation = await Meteor.callAsync('backup.validate', data);

      if (!validation.valid) {
        message.error(validation.error);
        return false;
      }

      setBackupData(data);
      setValidationResult(validation);
      setRestoreModalOpen(true);
    } catch (error) {
      if (error instanceof SyntaxError) {
        message.error(t('backup.invalidBackupJson'));
      } else {
        message.error(error.reason || error.message || t('backup.fileReadFailed'));
      }
    }
    return false; // Prevent default upload behavior
  }, [t]);

  const handleRestore = useCallback(async () => {
    if (!backupData) return;

    setRestoring(true);
    try {
      const result = await Meteor.callAsync('backup.restore', backupData, { createSafetyBackup });

      if (result.success) {
        message.success(t('backup.restoreSuccess'));
        // Store safety backup for download if one was created
        if (result.safetyBackup) {
          setSafetyBackupData(result.safetyBackup);
        } else {
          setRestoreModalOpen(false);
          setBackupData(null);
          setValidationResult(null);
        }
      } else {
        message.warning(t('backup.restoreWithErrors', { count: result.errors.length }));
        if (result.safetyBackup) {
          setSafetyBackupData(result.safetyBackup);
        }
      }
    } catch (error) {
      message.error(error.reason || error.message || t('backup.restoreFailed'));
    } finally {
      setRestoring(false);
    }
  }, [backupData, createSafetyBackup, t]);

  const handleCancelRestore = useCallback(() => {
    setRestoreModalOpen(false);
    setBackupData(null);
    setValidationResult(null);
    setSafetyBackupData(null);
    setCreateSafetyBackup(true);
  }, []);

  const handleDownloadSafetyBackup = useCallback(async () => {
    if (!safetyBackupData) return;

    try {
      const zip = new JSZip();
      zip.file('backup.json', JSON.stringify(safetyBackupData, null, 2));

      const blob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `safety-backup-${dayjs().format('YYYY-MM-DD-HHmmss')}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('backup.safetyBackupDownloaded'));
    } catch (error) {
      message.error(t('backup.safetyBackupFailed'));
    }
  }, [safetyBackupData, t]);

  const handleCloseSafetyBackupModal = useCallback(() => {
    setSafetyBackupData(null);
    setRestoreModalOpen(false);
    setBackupData(null);
    setValidationResult(null);
    setCreateSafetyBackup(true);
  }, []);

  return (
    <SectionCard title={t('backup.title')} ready={true}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <BackupSection loading={loading} onBackup={handleBackup} t={t} />
        </Col>
        <Col xs={24} lg={12}>
          <RestoreSection onFileUpload={handleFileUpload} t={t} />
        </Col>
      </Row>

      <RestoreConfirmModal
        open={restoreModalOpen && !safetyBackupData}
        validationResult={validationResult}
        restoring={restoring}
        createSafetyBackup={createSafetyBackup}
        onCreateSafetyBackupChange={setCreateSafetyBackup}
        onConfirm={handleRestore}
        onCancel={handleCancelRestore}
        t={t}
      />

      <SafetyBackupModal
        open={!!safetyBackupData}
        onDownload={handleDownloadSafetyBackup}
        onClose={handleCloseSafetyBackupModal}
        t={t}
      />
    </SectionCard>
  );
}

function BackupSection({ loading, onBackup, t }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={3}>
          <CloudDownloadOutlined /> {t('backup.createBackup')}
        </Typography.Title>
      </Col>
      <Col span={24}>
        <Typography.Paragraph>{t('backup.backupDescription')}</Typography.Paragraph>
      </Col>
      <Col span={24}>
        <Button type="primary" size="large" icon={<CloudDownloadOutlined />} loading={loading} onClick={onBackup}>
          {loading ? t('backup.creatingBackup') : t('backup.downloadBackup')}
        </Button>
      </Col>
    </Row>
  );
}

function RestoreSection({ onFileUpload, t }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={3}>
          <CloudUploadOutlined /> {t('backup.restoreFromBackup')}
        </Typography.Title>
      </Col>
      <Col span={24}>
        <Typography.Paragraph>{t('backup.restoreDescription')}</Typography.Paragraph>
      </Col>
      <Col span={24}>
        <Alert
          message={t('backup.restoreWarning')}
          description={t('backup.restoreWarningDescription')}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
        />
      </Col>
      <Col span={24}>
        <Dragger beforeUpload={onFileUpload} accept=".zip,.json" multiple={false} showUploadList={false}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('backup.dragDropText')}</p>
          <p className="ant-upload-hint">{t('backup.dragDropHint')}</p>
        </Dragger>
      </Col>
    </Row>
  );
}

function RestoreConfirmModal({ open, validationResult, restoring, createSafetyBackup, onCreateSafetyBackupChange, onConfirm, onCancel, t }) {
  return (
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          {t('backup.confirmRestore')}
        </Space>
      }
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={restoring}
      okText={t('backup.restoreButton')}
      cancelText={t('common.cancel')}
      okButtonProps={{ danger: true }}
      width={600}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert message={t('backup.restoreReplaceWarning')} type="warning" showIcon />
        </Col>
        <Col span={24}>
          <Checkbox checked={createSafetyBackup} onChange={e => onCreateSafetyBackupChange(e.target.checked)}>
            <Space>
              <SafetyOutlined />
              {t('backup.createSafetyBackup')}
            </Space>
          </Checkbox>
          <Typography.Text type="secondary" style={{ display: 'block', marginLeft: 24, marginTop: 4 }}>
            {t('backup.safetyBackupDescription')}
          </Typography.Text>
        </Col>
        {validationResult && (
          <Col span={24}>
            <Typography.Title level={5}>{t('backup.backupDetails')}</Typography.Title>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label={t('backup.version')}>{validationResult.version}</Descriptions.Item>
              <Descriptions.Item label={t('backup.created')}>{validationResult.timestamp ? dayjs(validationResult.timestamp).format('YYYY-MM-DD HH:mm:ss') : 'Unknown'}</Descriptions.Item>
              <Descriptions.Item label={t('backup.totalDocuments')}>{validationResult.meta?.totalDocuments || 0}</Descriptions.Item>
            </Descriptions>
          </Col>
        )}
        {validationResult?.meta?.collectionCounts && (
          <Col span={24}>
            <Typography.Title level={5}>{t('backup.collectionCounts')}</Typography.Title>
            <Descriptions bordered size="small" column={2}>
              {Object.entries(validationResult.meta.collectionCounts).map(([name, count]) => (
                <Descriptions.Item key={name} label={t(`collections.${name}`) || name}>
                  {count}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Col>
        )}
        {restoring && (
          <Col span={24}>
            <Progress percent={100} status="active" showInfo={false} />
            <Typography.Text type="secondary">{createSafetyBackup ? t('backup.restoringWithSafety') : t('backup.restoringData')}</Typography.Text>
          </Col>
        )}
      </Row>
    </Modal>
  );
}

function SafetyBackupModal({ open, onDownload, onClose, t }) {
  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined style={{ color: '#52c41a' }} />
          {t('backup.restoreComplete')}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          {t('backup.close')}
        </Button>,
        <Button key="download" type="primary" icon={<CloudDownloadOutlined />} onClick={onDownload}>
          {t('backup.downloadSafetyBackup')}
        </Button>,
      ]}
      width={500}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert message={t('backup.restoreSuccessMessage')} description={t('backup.restoreSuccessDescription')} type="success" showIcon />
        </Col>
        <Col span={24}>
          <Typography.Text type="secondary">{t('backup.safetyBackupNote')}</Typography.Text>
        </Col>
      </Row>
    </Modal>
  );
}
