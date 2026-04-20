import React from 'react';

interface LogoProps {
  src?: string;
  alt?: string;
}

export default function Logo({ src = '/favicon-32x32.png', alt = 'Logo' }: LogoProps) {
  return (
    <div className="logo">
      <img src={src} alt={alt} decoding="async" loading="lazy" />
    </div>
  );
}
