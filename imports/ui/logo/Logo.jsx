import PropTypes from 'prop-types';
import React from 'react';

export default function Logo({ src = '/favicon-32x32.png', alt = 'Logo' }) {
  return (
    <div className="logo">
      <img src={src} alt={alt} decoding="async" loading="lazy" />
    </div>
  );
}
Logo.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
};
