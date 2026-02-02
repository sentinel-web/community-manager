import { CloudDownloadOutlined, CloudUploadOutlined, InboxOutlined, SafetyOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Col, Descriptions, Modal, Progress, Row, Space, Typography, message } from 'antd';
import Dragger from 'antd/es/upload/Dragger';
import dayjs from 'dayjs';
import JSZip from 'jszip';
import { Meteor } from 'meteor/meteor';
import React, { useCallback, useState } from 'react';
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
      message.success('Backup downloaded successfully');
    } catch (error) {
      message.error(error.reason || error.message || 'Failed to create backup');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFileUpload = useCallback(async file => {
    // Validate file size
    if (file.size > MAX_BACKUP_SIZE) {
      message.error(`Backup file too large. Maximum size is 50MB.`);
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
          message.error('Invalid backup archive. Missing backup.json file.');
          return false;
        }

        const text = await jsonFile.async('string');
        data = JSON.parse(text);
      } else if (file.name.endsWith('.json')) {
        // Legacy support for plain JSON files
        const text = await file.text();
        data = JSON.parse(text);
      } else {
        message.error('Invalid file type. Please upload a .zip or .json backup file.');
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
        message.error('Invalid backup file. JSON parsing failed.');
      } else {
        message.error(error.reason || error.message || 'Failed to read backup file');
      }
    }
    return false; // Prevent default upload behavior
  }, []);

  const handleRestore = useCallback(async () => {
    if (!backupData) return;

    setRestoring(true);
    try {
      const result = await Meteor.callAsync('backup.restore', backupData, { createSafetyBackup });

      if (result.success) {
        message.success('Backup restored successfully');
        // Store safety backup for download if one was created
        if (result.safetyBackup) {
          setSafetyBackupData(result.safetyBackup);
        } else {
          setRestoreModalOpen(false);
          setBackupData(null);
          setValidationResult(null);
        }
      } else {
        message.warning(`Restore completed with ${result.errors.length} error(s)`);
        if (result.safetyBackup) {
          setSafetyBackupData(result.safetyBackup);
        }
      }
    } catch (error) {
      message.error(error.reason || error.message || 'Failed to restore backup');
    } finally {
      setRestoring(false);
    }
  }, [backupData, createSafetyBackup]);

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
      message.success('Safety backup downloaded');
    } catch (error) {
      message.error('Failed to download safety backup');
    }
  }, [safetyBackupData]);

  const handleCloseSafetyBackupModal = useCallback(() => {
    setSafetyBackupData(null);
    setRestoreModalOpen(false);
    setBackupData(null);
    setValidationResult(null);
    setCreateSafetyBackup(true);
  }, []);

  return (
    <SectionCard title="Backup & Recovery" ready={true}>
      <Row gutter={[24, 24]}>
        <Col xs={24} lg={12}>
          <BackupSection loading={loading} onBackup={handleBackup} />
        </Col>
        <Col xs={24} lg={12}>
          <RestoreSection onFileUpload={handleFileUpload} />
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
      />

      <SafetyBackupModal
        open={!!safetyBackupData}
        onDownload={handleDownloadSafetyBackup}
        onClose={handleCloseSafetyBackupModal}
      />
    </SectionCard>
  );
}

function BackupSection({ loading, onBackup }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={3}>
          <CloudDownloadOutlined /> Create Backup
        </Typography.Title>
      </Col>
      <Col span={24}>
        <Typography.Paragraph>
          Download a complete backup of all your data as a JSON file. This includes users, events, tasks, settings, and all other data.
        </Typography.Paragraph>
      </Col>
      <Col span={24}>
        <Button type="primary" size="large" icon={<CloudDownloadOutlined />} loading={loading} onClick={onBackup}>
          {loading ? 'Creating Backup...' : 'Download Backup'}
        </Button>
      </Col>
    </Row>
  );
}

function RestoreSection({ onFileUpload }) {
  return (
    <Row gutter={[16, 16]}>
      <Col span={24}>
        <Typography.Title level={3}>
          <CloudUploadOutlined /> Restore from Backup
        </Typography.Title>
      </Col>
      <Col span={24}>
        <Typography.Paragraph>Upload a backup file to restore your data. This will replace all existing data with the backup data.</Typography.Paragraph>
      </Col>
      <Col span={24}>
        <Alert
          message="Warning"
          description="Restoring a backup will replace all existing data. Make sure to create a backup of your current data before restoring."
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
          <p className="ant-upload-text">Click or drag backup file to this area</p>
          <p className="ant-upload-hint">Supports .zip (recommended) and .json backup files</p>
        </Dragger>
      </Col>
    </Row>
  );
}

function RestoreConfirmModal({ open, validationResult, restoring, createSafetyBackup, onCreateSafetyBackupChange, onConfirm, onCancel }) {
  return (
    <Modal
      title={
        <Space>
          <WarningOutlined style={{ color: '#faad14' }} />
          Confirm Restore
        </Space>
      }
      open={open}
      onOk={onConfirm}
      onCancel={onCancel}
      confirmLoading={restoring}
      okText="Restore"
      okButtonProps={{ danger: true }}
      width={600}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert message="This action will replace all existing data with the backup data." type="warning" showIcon />
        </Col>
        <Col span={24}>
          <Checkbox checked={createSafetyBackup} onChange={e => onCreateSafetyBackupChange(e.target.checked)}>
            <Space>
              <SafetyOutlined />
              Create safety backup before restore (recommended)
            </Space>
          </Checkbox>
          <Typography.Text type="secondary" style={{ display: 'block', marginLeft: 24, marginTop: 4 }}>
            A backup of current data will be created and available for download after restore completes.
          </Typography.Text>
        </Col>
        {validationResult && (
          <Col span={24}>
            <Typography.Title level={5}>Backup Details</Typography.Title>
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Version">{validationResult.version}</Descriptions.Item>
              <Descriptions.Item label="Created">{validationResult.timestamp ? dayjs(validationResult.timestamp).format('YYYY-MM-DD HH:mm:ss') : 'Unknown'}</Descriptions.Item>
              <Descriptions.Item label="Total Documents">{validationResult.meta?.totalDocuments || 0}</Descriptions.Item>
            </Descriptions>
          </Col>
        )}
        {validationResult?.meta?.collectionCounts && (
          <Col span={24}>
            <Typography.Title level={5}>Collection Counts</Typography.Title>
            <Descriptions bordered size="small" column={2}>
              {Object.entries(validationResult.meta.collectionCounts).map(([name, count]) => (
                <Descriptions.Item key={name} label={name}>
                  {count}
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Col>
        )}
        {restoring && (
          <Col span={24}>
            <Progress percent={100} status="active" showInfo={false} />
            <Typography.Text type="secondary">{createSafetyBackup ? 'Creating safety backup and restoring data...' : 'Restoring data...'}</Typography.Text>
          </Col>
        )}
      </Row>
    </Modal>
  );
}

function SafetyBackupModal({ open, onDownload, onClose }) {
  return (
    <Modal
      title={
        <Space>
          <SafetyOutlined style={{ color: '#52c41a' }} />
          Restore Complete
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Close
        </Button>,
        <Button key="download" type="primary" icon={<CloudDownloadOutlined />} onClick={onDownload}>
          Download Safety Backup
        </Button>,
      ]}
      width={500}
    >
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Alert message="Restore completed successfully!" description="A safety backup of your previous data was created before the restore. You can download it now for safekeeping." type="success" showIcon />
        </Col>
        <Col span={24}>
          <Typography.Text type="secondary">
            This safety backup contains all your data from before the restore. We recommend downloading it in case you need to revert your changes.
          </Typography.Text>
        </Col>
      </Row>
    </Modal>
  );
}
