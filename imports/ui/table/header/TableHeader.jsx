import { Button, Col, Form, Input, Row } from 'antd';
import React from 'react';

export default function TableHeader({ handleInputChange = console.warn, disabled = false, inputName = '' }) {
  return (
    <Row gutter={[16, 16]}>
      <Col flex="auto">
        <Form.Item name={inputName} required>
          <Input name={inputName} placeholder={`Enter ${inputName}`} onChange={handleInputChange} disabled={disabled} autoComplete="off" required />
        </Form.Item>
      </Col>
      <Col>
        <Button type="primary" htmlType="submit" title="Submit new entry" disabled={disabled}>
          Submit
        </Button>
      </Col>
    </Row>
  );
}
