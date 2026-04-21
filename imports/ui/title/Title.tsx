import { Typography } from 'antd';
import React from 'react';

interface TitleProps {
  text?: string;
}

export default function Title({ text = 'Community Manager' }: TitleProps) {
  return (
    <Typography.Title level={2} className="title">
      {text}
    </Typography.Title>
  );
}
