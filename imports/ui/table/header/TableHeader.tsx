import { Button, Col, Input, Row } from 'antd';
import React, { ChangeEvent, ReactNode } from 'react';
import { useTranslation } from '../../../i18n/LanguageContext';

interface TableHeaderProps {
  handleChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  value?: string;
  handleCreate?: () => void;
  extra?: ReactNode;
  canCreate?: boolean;
}

export default function TableHeader({
  handleChange = () => {},
  value = '',
  handleCreate = () => {},
  extra = <></>,
  canCreate = true,
}: TableHeaderProps) {
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
