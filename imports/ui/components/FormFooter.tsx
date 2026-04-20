import { Button, Col, Row } from 'antd';
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

interface FormFooterProps {
  setOpen: (open: boolean) => void;
  cancelText?: string;
  submitText?: string;
}

const FormFooter = ({ setOpen, cancelText, submitText }: FormFooterProps) => {
  const { t } = useTranslation();

  return (
    <Row gutter={[16, 16]} align="middle" justify="end">
      <Col>
        <Button onClick={() => setOpen(false)} danger>
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
