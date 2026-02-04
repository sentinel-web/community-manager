import { App, Button, Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';

export default function LogTableActions({ record, handleDelete, handleView }) {
  const { modal } = App.useApp();
  const { t } = useTranslation();
  const styles = {
    button: {
      width: '100%',
    },
  };
  const handleRemove = useCallback(
    e => {
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
        <Button style={styles.button} onClick={e => handleRemove(e, record)} danger>
          {t('common.delete')}
        </Button>
      </Col>
    </Row>
  );
}
LogTableActions.propTypes = {
  record: PropTypes.any,
  handleDelete: PropTypes.func,
  handleView: PropTypes.func,
};
