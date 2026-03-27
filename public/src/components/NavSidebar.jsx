import React from "react";
import styled from "styled-components";
import { useChatAppearance } from "../context/ChatAppearanceContext";
import { IoChatbubblesOutline } from "react-icons/io5";
import { IoSyncCircleOutline } from "react-icons/io5";

export default function NavSidebar({ currentUserImage, activeTab = "chats", onTabChange }) {
  const { themeMode } = useChatAppearance();
  return (
    <Sidebar $light={themeMode === "light"}>
      <div className="nav-top">
        <NavBtn
          $light={themeMode === "light"}
          className={activeTab === "chats" ? "active" : ""}
          title="Chats"
          onClick={() => onTabChange && onTabChange("chats")}
        >
          <IoChatbubblesOutline />
        </NavBtn>

        <NavBtn
          $light={themeMode === "light"}
          className={activeTab === "status" ? "active" : ""}
          title="Status"
          onClick={() => onTabChange && onTabChange("status")}
        >
          <IoSyncCircleOutline />
        </NavBtn>
      </div>

      <div className="nav-bottom">
        {currentUserImage && (
          <div
            className={`user-avatar${activeTab === "profile" ? " active-avatar" : ""}`}
            title="Profile"
            onClick={() => onTabChange && onTabChange(activeTab === "profile" ? "chats" : "profile")}
          >
            <img
              src={`data:image/svg+xml;base64,${currentUserImage}`}
              alt="profile"
            />
          </div>
        )}
      </div>
    </Sidebar>
  );
}

const Sidebar = styled.nav`
  width: 65px;
  background-color: ${(p) => (p.$light ? "#e5e7eb" : "#0a0a0c")};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 0;
  border-right: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff0d")};

  .nav-top {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    width: 100%;
  }

  .nav-bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    width: 100%;
  }

  .user-avatar {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid #6b7280;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.15s;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    &:hover {
      border-color: #9ca3af;
      transform: scale(1.07);
    }

    &.active-avatar {
      border-color: #ffffff;
      box-shadow: 0 0 0 3px #6b728055;
    }
  }
`;

const NavBtn = styled.button`
  background: transparent;
  border: none;
  color: ${(p) => (p.$light ? "#52525b" : "#ffffff55")};
  font-size: 1.5rem;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &:hover {
    background: ${(p) => (p.$light ? "#00000010" : "#ffffff12")};
    color: ${(p) => (p.$light ? "#18181b" : "#ffffffcc")};
  }

  &.active {
    background: #6b728022;
    color: #6b7280;
  }
`;
