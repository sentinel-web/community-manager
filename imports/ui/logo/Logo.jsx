import React from "react";

export default function Logo({
  src = "https://external-content.duckduckgo.com/iu/?u=http%3A%2F%2Fcompanies.naukri.com%2Facme-services-new-dev%2Fwp-content%2Fuploads%2Fsites%2F33734%2F2020%2F06%2Flogo-web.png&f=1&nofb=1&ipt=10372ca75fb95d00c869e3121499ce26a33630b7c58ff5e8d5265be46c1360f2&ipo=images",
  alt = "Logo",
}) {
  return (
    <div className="logo">
      <img src={src} alt={alt} fetchPriority="high" height={64} width={64} />
    </div>
  );
}
