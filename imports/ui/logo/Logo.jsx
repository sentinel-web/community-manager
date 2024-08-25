import { Space } from "antd";
import React from "react";

export default function Logo({ src = "/favicon-32x32.png", alt = "Logo" }) {
  return (
    <Space className="logo">
      <img src={src} alt={alt} decoding="async" loading="lazy" />
    </Space>
  );
}
