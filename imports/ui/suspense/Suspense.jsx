import React from "react";

export default function Suspense({ children }) {
  return (
    <React.Suspense fallback={<div>Loading...</div>}>{children}</React.Suspense>
  );
}
