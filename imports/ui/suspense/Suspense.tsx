import { Col, Row } from 'antd';
import React, { ReactNode } from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

// Also rendered directly (not only as the lazy-import fallback) while Main is
// waiting for the user's role — "still loading" must never look like a refusal.
export function SuspenseFallback() {
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
