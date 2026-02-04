import { App, Button, Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React, { useCallback } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';

export default function TableActions({ record, handleDelete, handleEdit, extra, canUpdate = true, canDelete = true }) {
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
        title: t('modals.deleteEntry'),
        content: t('modals.deleteEntryConfirm'),
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

  // Don't render anything if no actions are available
  if (!canUpdate && !canDelete && !extra) {
    return null;
  }

  return (
    <Row gutter={[16, 16]} justify="center">
      {canUpdate && (
        <Col flex="auto">
          <Button style={styles.button} onClick={e => handleEdit(e, record)}>
            {t('common.edit')}
          </Button>
        </Col>
      )}
      {canDelete && (
        <Col flex="auto">
          <Button style={styles.button} onClick={e => handleRemove(e, record)} danger>
            {t('common.delete')}
          </Button>
        </Col>
      )}
      {extra && React.createElement(extra, { record })}
    </Row>
  );
}
TableActions.propTypes = {
  record: PropTypes.any,
  handleDelete: PropTypes.func,
  handleEdit: PropTypes.func,
  extra: PropTypes.any,
  canUpdate: PropTypes.bool,
  canDelete: PropTypes.bool,
};
