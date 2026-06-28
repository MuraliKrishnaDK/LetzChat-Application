import React, { useEffect, useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { logoutRoute } from "../utils/APIRoutes";
import { IoChatbubblesOutline, IoPersonCircleOutline } from "react-icons/io5";
import { BiPowerOff } from "react-icons/bi";
import { useChatAppearance } from "../context/ChatAppearanceContext";

export default function ProfilePanel({ activeSection = "profile", onOpenProfile, onOpenChatsSettings }) {
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
    if (data) setUser(data);
  }, []);

  const handleLogout = async () => {
    if (!user) return;
    const { data } = await axios.get(logoutRoute(user._id));
    if (data.status === 200 || true) {
      localStorage.clear();
      navigate("/login");
    }
  };

  return (
    <Container $light={isLight}>
      {/* User summary at top */}
      {user && (
        <div className="user-summary">
          <img
            className="avatar"
            src={`data:image/svg+xml;base64,${user.avatarImage}`}
            alt="avatar"
          />
          <div className="info">
            <span className="name">{user.username}</span>
            <span className="sub">Your account</span>
          </div>
        </div>
      )}

      <div className="divider" />

      {/* Menu items */}
      <nav className="menu">
        <button
          type="button"
          className={`menu-item${activeSection === "profile" ? " active" : ""}`}
          onClick={onOpenProfile}
        >
          <IoPersonCircleOutline className="item-icon" />
          <span>Profile</span>
        </button>
        <button
          type="button"
          className={`menu-item${activeSection === "chats" ? " active" : ""}`}
          onClick={onOpenChatsSettings}
        >
          <IoChatbubblesOutline className="item-icon" />
          <span>Chats</span>
        </button>
      </nav>

      {/* Logout pinned to bottom */}
      <div className="bottom">
        <div className="divider" />
        <button className="menu-item logout" onClick={handleLogout}>
          <BiPowerOff className="item-icon" />
          <span>Logout</span>
        </button>
      </div>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};
  border-right: ${(p) => (p.$light ? "1px solid #d1d5db" : "none")};
  height: 100%;
  overflow: hidden;

  .user-summary {
    display: flex;
    align-items: center;
    gap: 0.9rem;
    padding: 1.1rem 1.2rem 1rem;
    flex-shrink: 0;

    .avatar {
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      border: 2px solid #6b7280;
      object-fit: cover;
      flex-shrink: 0;
    }

    .info {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;

      .name {
        color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
        font-size: 0.95rem;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .sub {
        color: ${(p) => (p.$light ? "#52525b" : "#ffffff55")};
        font-size: 0.72rem;
      }
    }
  }

  .divider {
    height: 1px;
    background: ${(p) => (p.$light ? "#d1d5db" : "#ffffff0d")};
    flex-shrink: 0;
    margin: 0;
  }

  .menu {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0;
    flex: 1;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    padding: 0.8rem 1.4rem;
    background: transparent;
    border: none;
    color: ${(p) => (p.$light ? "#18181b" : "#d1d1d1")};
    font-size: 0.92rem;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;

    .item-icon {
      font-size: 1.3rem;
      color: ${(p) => (p.$light ? "#6b7280" : "#6b7280")};
      flex-shrink: 0;
    }

    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff0d")};
      color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
    }

    &.active {
      background: ${(p) => (p.$light ? "#e5e7eb" : "#6b728018")};
      color: ${(p) => (p.$light ? "#374151" : "#9ca3af")};
      .item-icon {
        color: ${(p) => (p.$light ? "#374151" : "#9ca3af")};
      }
    }

    &.logout {
      color: #e11d48;
      .item-icon {
        color: #e11d48;
      }
      &:hover {
        background: ${(p) => (p.$light ? "#ffe4e6" : "#ff4d4d18")};
      }
    }
  }

  .bottom {
    flex-shrink: 0;
    padding-bottom: 0.4rem;
  }
`;
