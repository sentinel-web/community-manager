import { Button, Col, Input, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from '../../../i18n/LanguageContext';

export default function TableHeader({ handleChange = () => {}, value = '', handleCreate = () => {}, extra = <></>, canCreate = true }) {
  const { t } = useTranslation();

  return (
    <Row gutter={[16, 16]}>
      <Col flex="auto">
        <Input.Search placeholder={t('common.searchPlaceholder')} value={value} onChange={handleChange} />
      </Col>
      {extra}
      {canCreate && (
        <Col>
          <Button type="primary" onClick={handleCreate}>
            {t('common.create')}
          </Button>
        </Col>
      )}
    </Row>
  );
}
TableHeader.propTypes = {
  handleChange: PropTypes.func,
  value: PropTypes.string,
  handleCreate: PropTypes.func,
  extra: PropTypes.node,
  canCreate: PropTypes.bool,
};
