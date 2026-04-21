import { Col, Row } from 'antd';
import React, { ReactNode } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

function SuspenseFallback() {
  const { t } = useTranslation();
  return (
    <Row gutter={[16, 16]}>
      <Col>{t('common.loading')}</Col>
    </Row>
  );
}

interface SuspenseProps {
  children?: ReactNode;
}

export default function Suspense({ children }: SuspenseProps) {
  return <React.Suspense fallback={<SuspenseFallback />}>{children}</React.Suspense>;
}
