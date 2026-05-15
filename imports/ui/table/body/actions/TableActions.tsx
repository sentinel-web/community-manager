import { Button, Col, Row } from 'antd';
import React, { ComponentType, MouseEvent, useCallback } from 'react';
import { useTranslation } from '/imports/i18n/LanguageContext';

type ClickEvent = MouseEvent<HTMLElement>;

interface TableActionsProps<T> {
  record: T;
  handleDelete: (e: ClickEvent, record: T) => void;
  handleEdit: (e: ClickEvent, record: T) => void;
  extra?: ComponentType<{ record: T }>;
  canUpdate?: boolean;
  canDelete?: boolean;
}

export default function TableActions<T>({
  record,
  handleDelete,
  handleEdit,
  extra,
  canUpdate = true,
  canDelete = true,
}: TableActionsProps<T>) {
  const { t } = useTranslation();
  const styles = {
    button: {
      width: '100%',
    },
  };
  // Section.handleDelete owns the confirmation modal (it pre-fetches the
  // integrity preview before showing it). This handler just forwards.
  const handleRemove = useCallback(
    (e: ClickEvent) => {
      handleDelete(e, record);
    },
    [handleDelete, record]
  );

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
          <Button style={styles.button} onClick={e => handleRemove(e)} danger>
            {t('common.delete')}
          </Button>
        </Col>
      )}
      {extra && React.createElement(extra, { record })}
    </Row>
  );
}
