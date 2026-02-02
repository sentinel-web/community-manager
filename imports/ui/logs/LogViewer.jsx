import { CopyOutlined } from '@ant-design/icons';
import { App, Button, Descriptions, Typography } from 'antd';
import dayjs from 'dayjs';
import PropTypes from 'prop-types';
import React, { useCallback, useContext } from 'react';
import { DrawerContext } from '../app/App';

const { Text } = Typography;

const LogViewer = ({ setOpen }) => {
  const { drawerModel: log } = useContext(DrawerContext);
  const { message } = App.useApp();

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(log?._id || '');
      message.success('ID copied to clipboard');
    } catch {
      message.error('Failed to copy ID');
    }
  }, [log?._id, message]);

  const items = [
    {
      key: 'id',
      label: 'ID',
      children: (
        <span>
          <Text code>{log?._id}</Text>
          <Button type="link" icon={<CopyOutlined />} onClick={handleCopyId} size="small" />
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      children: <Text>{log?.action || '-'}</Text>,
    },
    {
      key: 'timestamp',
      label: 'Timestamp',
      children: <Text>{log?.timestamp ? dayjs(log.timestamp).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>,
    },
    {
      key: 'createdAt',
      label: 'Created At',
      children: <Text>{log?.createdAt ? dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') : '-'}</Text>,
    },
    {
      key: 'payload',
      label: 'Payload',
      children: (
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '300px', overflow: 'auto' }}>
          {log?.payload ? JSON.stringify(log.payload, null, 2) : '-'}
        </pre>
      ),
    },
  ];

  return <Descriptions column={1} bordered items={items} />;
};

LogViewer.propTypes = {
  setOpen: PropTypes.func,
};

export default LogViewer;
