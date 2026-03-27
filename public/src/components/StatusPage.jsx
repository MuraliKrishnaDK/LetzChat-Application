import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { IoAdd } from "react-icons/io5";
import { useChatAppearance } from "../context/ChatAppearanceContext";

export default function StatusPage() {
  const { themeMode } = useChatAppearance();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
    if (data) setUser(data);
  }, []);

  return (
    <Container $light={themeMode === "light"}>
      <div className="section-title">Status</div>

      {user && (
        <div className="my-status">
          <div className="avatar-wrap">
            <img
              className="avatar"
              src={`data:image/svg+xml;base64,${user.avatarImage}`}
              alt="avatar"
            />
            <button className="add-btn" title="Add status">
              <IoAdd />
            </button>
          </div>
          <div className="status-info">
            <span className="name">{user.username}</span>
            <span className="hint">Click to add Status</span>
          </div>
        </div>
      )}

      <div className="empty-state">
        <p>No recent status updates</p>
      </div>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};
  height: 100%;
  overflow: hidden;

  .section-title {
    padding: 1.1rem 1.2rem 0.6rem;
    font-size: 1.05rem;
    font-weight: 700;
    color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
    letter-spacing: 0.02em;
    border-bottom: 1px solid #ffffff0d;
    flex-shrink: 0;
  }

  .my-status {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.85rem 1.2rem;
    cursor: pointer;
    transition: background 0.18s;
    flex-shrink: 0;

    &:hover {
      background: #ffffff0a;
    }
  }

  .avatar-wrap {
    position: relative;
    flex-shrink: 0;
    width: 3.2rem;
    height: 3.2rem;

    .avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid #6b7280;
      object-fit: cover;
      display: block;
    }

    .add-btn {
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 50%;
      background: #4b5563;
      border: 2px solid #0a0a0c;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      cursor: pointer;
      padding: 0;
      transition: background 0.15s, transform 0.15s;

      &:hover {
        background: #6b7280;
        transform: scale(1.15);
      }
    }
  }

  .status-info {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;

    .name {
      color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
      font-size: 0.95rem;
      font-weight: 600;
    }

    .hint {
      color: #6b7280;
      font-size: 0.78rem;
    }
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;

    p {
      color: ${(p) => (p.$light ? "#d1d5db" : "#ffffff22")};
      font-size: 0.85rem;
      font-style: italic;
    }
  }
`;
