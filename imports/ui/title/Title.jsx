import { Typography } from 'antd';
import React from 'react';

export default function Title({ text = 'Community Manager' }) {
  return (
    <Typography.Title level={2} className="title">
      {text}
    </Typography.Title>
  );
}
