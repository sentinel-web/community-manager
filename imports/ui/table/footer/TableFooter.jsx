import { Button, Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from '../../../i18n/LanguageContext';

export default function TableFooter({ count = 0, ready = false, handleLoadMore, disabled = false }) {
  const { t } = useTranslation();

  return (
    <Row gutter={[16, 16]} justify="space-between" align="middle" style={{ marginTop: '16px' }}>
      {handleLoadMore && (
        <Col>
          <Button loading={!ready} onClick={handleLoadMore} disabled={disabled}>
            {t('common.loadMore')}
          </Button>
        </Col>
      )}
      <Col>{t('common.total')}: {!ready ? t('common.loading') : count}</Col>
    </Row>
  );
}
TableFooter.propTypes = {
  count: PropTypes.number,
  ready: PropTypes.bool,
  handleLoadMore: PropTypes.func,
  disabled: PropTypes.bool,
};
