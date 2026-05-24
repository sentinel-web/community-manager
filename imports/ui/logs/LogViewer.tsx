import { CopyOutlined } from '@ant-design/icons';
import { App, Button, Descriptions, Typography } from 'antd';
import dayjs from 'dayjs';
import React, { useCallback, useMemo } from 'react';
import type { LogEntry } from '../../api/types/misc';
import { useDrawerFrame } from '../drawer-stack';
import LogDiffView from './LogDiffView';
import { useTranslation } from '/imports/i18n/LanguageContext';

const { Text } = Typography;

const LogViewer = () => {
  const { model } = useDrawerFrame<void, LogEntry>();
  const log = (model || {}) as unknown as LogEntry;
  const { message } = App.useApp();
  const { t } = useTranslation();
  // Update logs carry { id, changes, before? } — rendered as a before→after
  // diff. All other actions keep the raw JSON payload view.
  const isUpdate = Boolean(log?.action?.endsWith('.updated'));

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(log?._id || '');
      message.success(t('messages.copiedToClipboard'));
    } catch {
      message.error(t('messages.copyFailed'));
    }
  }, [log?._id, message, t]);

  const items = useMemo(
    () => [
      {
        key: 'id',
        label: t('forms.labels.id'),
        children: (
          <span>
            <Text code>{log?._id}</Text>
            <Button type="link" icon={<CopyOutlined />} onClick={handleCopyId} size="small" />
          </span>
        ),
      },
      {
        key: 'action',
        label: t('logs.action'),
        children: <Text>{log?.action || '-'}</Text>,
      },
      {
        key: 'timestamp',
        label: t('logs.timestamp'),
        children: <Text>{log?.timestamp ? dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>,
      },
      {
        key: 'createdAt',
        label: t('logs.createdAt'),
        children: <Text>{log?.createdAt ? dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>,
      },
      {
        key: 'payload',
        label: t('logs.payload'),
        children:
          isUpdate && log?.payload ? (
            <LogDiffView payload={log.payload} />
          ) : (
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '300px', overflow: 'auto' }}>
              {log?.payload ? JSON.stringify(log.payload, null, 2) : '-'}
            </pre>
          ),
      },
    ],
    [log, t, handleCopyId, isUpdate]
  );

  return <Descriptions column={1} bordered items={items} />;
};

export default LogViewer;
