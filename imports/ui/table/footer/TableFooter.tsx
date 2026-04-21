import { Button, Col, Row } from 'antd';
import React from 'react';
import { useTranslation } from '../../../i18n/LanguageContext';

interface TableFooterProps {
  count?: number;
  ready?: boolean;
  handleLoadMore?: () => void;
  disabled?: boolean;
}

export default function TableFooter({ count = 0, ready = false, handleLoadMore, disabled = false }: TableFooterProps) {
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
      <Col>
        {t('common.total')}: {!ready ? t('common.loading') : count}
      </Col>
    </Row>
  );
}
