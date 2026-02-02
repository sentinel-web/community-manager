import { Button, Col, Input, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

export default function TableHeader({ handleChange = console.warn, value = '', handleCreate = console.warn, extra = <></>, canCreate = true }) {
  return (
    <Row gutter={[16, 16]}>
      <Col flex="auto">
        <Input.Search placeholder="Search..." value={value} onChange={handleChange} />
      </Col>
      {extra}
      {canCreate && (
        <Col>
          <Button type="primary" onClick={handleCreate}>
            Create
          </Button>
        </Col>
      )}
    </Row>
  );
}
TableHeader.propTypes = {
  handleChange: PropTypes.func,
  value: PropTypes.string,
  handleCreate: PropTypes.func,
  extra: PropTypes.node,
  canCreate: PropTypes.bool,
};
