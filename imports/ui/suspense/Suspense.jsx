import { Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

function SuspenseFallback() {
  const { t } = useTranslation();
  return (
    <Row gutter={[16, 16]}>
      <Col>{t('common.loading')}</Col>
    </Row>
  );
}

export default function Suspense({ children }) {
  return (
    <React.Suspense fallback={<SuspenseFallback />}>
      {children}
    </React.Suspense>
  );
}
Suspense.propTypes = {
  children: PropTypes.node,
};
