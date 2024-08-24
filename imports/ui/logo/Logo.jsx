import { Space } from "antd";
import React from "react";

export default function Logo({ src = "", alt = "Logo" }) {
  return (
    <Space className="logo">
      <img src={src} alt={alt} decoding="async" loading="lazy" />
    </Space>
  );
}
