import { App, Button, Col, Row } from 'antd';
import React, { useCallback } from 'react';
import type { LogEntry } from '../../api/types/misc';
import { useTranslation } from '/imports/i18n/LanguageContext';

interface LogTableActionsProps {
  record: LogEntry;
  handleDelete: (e: React.MouseEvent<HTMLElement>, record: LogEntry) => void;
  handleView: (e: React.MouseEvent<HTMLElement>, record: LogEntry) => void;
}

export default function LogTableActions({ record, handleDelete, handleView }: LogTableActionsProps) {
  const { modal } = App.useApp();
  const { t } = useTranslation();
  const styles = {
    button: {
      width: '100%',
    },
  };
  const handleRemove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      modal.confirm({
        title: t('logs.deleteLog'),
        content: t('logs.deleteLogConfirm'),
        okText: t('common.yes'),
        cancelText: t('common.cancel'),
        okType: 'danger',
        onOk: () => handleDelete(e, record),
        closable: true,
        maskClosable: true,
      });
    },
    [modal, handleDelete, record, t]
  );

  return (
    <Row gutter={[16, 16]} justify="center">
      <Col flex="auto">
        <Button style={styles.button} onClick={e => handleView(e, record)}>
          {t('logs.view')}
        </Button>
      </Col>
      <Col flex="auto">
        <Button style={styles.button} onClick={e => handleRemove(e)} danger>
          {t('common.delete')}
        </Button>
      </Col>
    </Row>
  );
}
