import { Button, Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';
import { useTranslation } from '../../i18n/LanguageContext';

const FormFooter = ({ setOpen, cancelText, submitText }) => {
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
FormFooter.propTypes = {
  setOpen: PropTypes.func,
  cancelText: PropTypes.string,
  submitText: PropTypes.string,
};

export default FormFooter;
