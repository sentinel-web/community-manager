import { Typography } from 'antd';
import PropTypes from 'prop-types';
import React from 'react';

export default function Title({ text = 'Community Manager' }) {
  return (
    <Typography.Title level={2} className="title">
      {text}
    </Typography.Title>
  );
}
Title.propTypes = {
  text: PropTypes.string,
};
