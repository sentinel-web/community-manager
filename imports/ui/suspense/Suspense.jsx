import { Col, Row } from "antd";
import React from "react";

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
