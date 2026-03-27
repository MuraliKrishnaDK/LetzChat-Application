import React from "react";
import styled from "styled-components";
import { useChatAppearance } from "../context/ChatAppearanceContext";

export default function Welcome() {
  const { themeMode, getChatMessagesBackground } = useChatAppearance();
  return (
    <Container
      $light={themeMode === "light"}
      $chatBg={getChatMessagesBackground(false)}
    />
  );
}

const Container = styled.div`
  height: 100%;
  background: ${(p) => p.$chatBg};
  background-attachment: fixed;
  ${(p) => p.$light && "min-height: 100%;"}
`;
