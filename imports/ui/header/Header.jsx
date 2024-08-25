import React from "react";
import Logo from "../logo/Logo";
import Title from "../title/Title";
import Navigation from "../navigation/Navigation";
import useSettings from "../settings/settings.hook";

export default function Header() {
  const { communityTitle, communityLogo } = useSettings();

  return (
    <header>
      <Logo src={communityLogo} />
      <Title text={communityTitle?.length > 0 ? communityTitle : undefined} />
      <Navigation />
    </header>
  );
}
