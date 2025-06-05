import { Button, Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

const FormFooter = ({ setOpen, cancelText = 'Cancel', submitText = 'Submit' }) => {
  return (
    <Row gutter={[16, 16]} align="middle" justify="end">
      <Col>
        <Button onClick={() => setOpen(false)} danger>
          {cancelText}
        </Button>
      </Col>
      <Col>
        <Button type="primary" htmlType="submit">
          {submitText}
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
