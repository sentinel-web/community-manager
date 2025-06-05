import { Button, Col, Input, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

export default function TableHeader({ handleChange = console.warn, value = '', handleCreate = console.warn, extra = <></> }) {
  return (
    <Row gutter={[16, 16]}>
      <Col flex="auto">
        <Input.Search placeholder="Search..." value={value} onChange={handleChange} />
      </Col>
      {extra}
      <Col>
        <Button type="primary" onClick={handleCreate}>
          Create
        </Button>
      </Col>
    </Row>
  );
}
TableHeader.propTypes = {
  handleChange: PropTypes.func,
  value: PropTypes.string,
  handleCreate: PropTypes.func,
  extra: PropTypes.node,
};
