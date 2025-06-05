import { Col, Row } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

Suspense.propTypes = {
  children: PropTypes.node,
};
export default function Suspense({ children }) {
  return (
    <React.Suspense
      fallback={
        <Row gutter={[16, 16]}>
          <Col>Loading...</Col>
        </Row>
      }
    >
      {children}
    </React.Suspense>
  );
}
