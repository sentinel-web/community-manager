import { Button, Col, Row } from 'antd';
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

interface FormFooterProps {
  setOpen?: (open: boolean) => void;
  onCancel?: () => void;
  cancelText?: string;
  submitText?: string;
}

const FormFooter = ({ setOpen, onCancel, cancelText, submitText }: FormFooterProps) => {
  const { t } = useTranslation();

  const handleCancel = onCancel ?? (() => setOpen?.(false));

  return (
    <Row gutter={[16, 16]} align="middle" justify="end">
      <Col>
        <Button onClick={handleCancel} danger>
          {cancelText || t('common.cancel')}
        </Button>
      </Col>
      <Col>
        <Button type="primary" htmlType="submit">
          {submitText || t('common.submit')}
        </Button>
      </Col>
    </Row>
  );
};

export default FormFooter;
