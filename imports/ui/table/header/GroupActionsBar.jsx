import { Alert, Button, Space } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from '../../../i18n/LanguageContext';

export default function GroupActionsBar({ selectedCount = 0, onDelete, groupActions = [], onClearSelection, loading = false }) {
  const { t } = useTranslation();

  const actions = (
    <Space>
      {onDelete && (
        <Button danger size="small" icon={<DeleteOutlined />} onClick={onDelete} loading={loading}>
          {t('common.delete')}
        </Button>
      )}
      {groupActions.map(action => (
        <Button key={action.key} size="small" onClick={action.handler} loading={loading}>
          {action.label}
        </Button>
      ))}
      <Button type="link" size="small" onClick={onClearSelection}>
        {t('common.clearSelection')}
      </Button>
    </Space>
  );

  return (
    <Alert
      type="info"
      message={t('common.selectedCount', { count: selectedCount })}
      action={actions}
      style={{ marginBottom: 16 }}
    />
  );
}
GroupActionsBar.propTypes = {
  selectedCount: PropTypes.number,
  onDelete: PropTypes.func,
  groupActions: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      handler: PropTypes.func.isRequired,
    })
  ),
  onClearSelection: PropTypes.func,
  loading: PropTypes.bool,
};
