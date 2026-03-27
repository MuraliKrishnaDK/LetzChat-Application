import React, { useEffect, useRef, useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { updateProfileRoute } from "../utils/APIRoutes";
import { MdCheck, MdClose, MdPhone, MdPerson, MdEdit } from "react-icons/md";
import { useChatAppearance } from "../context/ChatAppearanceContext";

function EditableField({ icon, label, value, placeholder, type = "text", maxLength, onSave, $light }) {
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const activate = () => {
    setDraft(value || "");
    setError("");
    setActive(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => { setActive(false); setError(""); };

  const save = async () => {
    const trimmed = draft.trim();
    if (label === "Name" && !trimmed) { setError("Name cannot be empty."); return; }
    setSaving(true);
    const err = await onSave(trimmed);
    setSaving(false);
    if (err) { setError(err); return; }
    setActive(false);
    setError("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancel();
  };

  return (
    <FieldRow $light={$light} onClick={!active ? activate : undefined} active={active}>
      <div className="field-icon">{icon}</div>
      <div className="field-body">
        <span className="label">{label}</span>
        {active ? (
          <div className="input-row">
            <input
              ref={inputRef}
              className="edit-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              type={type}
              maxLength={maxLength}
              onKeyDown={onKeyDown}
            />
            <button
              className="icon-btn confirm"
              title="Save"
              onClick={(e) => { e.stopPropagation(); save(); }}
              disabled={saving}
            >
              <MdCheck />
            </button>
            <button
              className="icon-btn discard"
              title="Cancel"
              onClick={(e) => { e.stopPropagation(); cancel(); }}
            >
              <MdClose />
            </button>
          </div>
        ) : (
          <span className={`value${!value ? " empty" : ""}`}>
            {value || placeholder}
          </span>
        )}
        {error && <span className="field-error">{error}</span>}
      </div>
    </FieldRow>
  );
}

export default function ProfileView() {
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY));
    if (data) setUser(data);
  }, []);

  const saveField = async (patch) => {
    try {
      const { data } = await axios.patch(updateProfileRoute(user._id), patch);
      if (!data.status) return data.msg || "Failed to save.";
      const updated = { ...user, ...patch, username: data.user.username, phone: data.user.phone || "" };
      setUser(updated);
      localStorage.setItem(process.env.REACT_APP_LOCALHOST_KEY, JSON.stringify(updated));
      return null; // no error
    } catch {
      return "Network error. Try again.";
    }
  };

  if (!user) return <Container $light={isLight} />;

  return (
    <Container $light={isLight}>
      <div className="card">
        {/* ── Avatar ── */}
        <div className="avatar-wrap">
          <div className="avatar-ring">
            <img
              className="avatar"
              src={`data:image/svg+xml;base64,${user.avatarImage}`}
              alt="profile"
            />
            <button
              className="avatar-edit-btn"
              title="Change profile photo"
              onClick={() => navigate("/setAvatar")}
            >
              <MdEdit />
            </button>
          </div>
        </div>

        {/* ── Name ── */}
        <EditableField
          $light={isLight}
          icon={<MdPerson />}
          label="Name"
          value={user.username}
          placeholder="Enter name"
          maxLength={20}
          onSave={(val) => saveField({ username: val })}
        />

        <div className="row-divider" />

        {/* ── Phone ── */}
        <EditableField
          $light={isLight}
          icon={<MdPhone />}
          label="Phone"
          value={user.phone}
          placeholder="Add phone number"
          type="tel"
          maxLength={15}
          onSave={(val) => saveField({ phone: val })}
        />
      </div>
    </Container>
  );
}

/* ── Styled components ─────────────────────────────────────────────────── */

const FieldRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1rem 1.4rem;
  cursor: ${({ active }) => (active ? "default" : "pointer")};
  transition: background 0.15s;

  &:hover {
    background: ${({ active, $light }) =>
      active ? "transparent" : $light ? "#f3f4f6" : "#ffffff07"};
  }

  .field-icon {
    font-size: 1.3rem;
    color: ${({ $light }) => ($light ? "#6b7280" : "#6b7280")};
    margin-top: 0.3rem;
    flex-shrink: 0;
    display: flex;
  }

  .field-body {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    flex: 1;
    min-width: 0;

    .label {
      font-size: 0.72rem;
      color: ${({ $light }) => ($light ? "#374151" : "#6b7280")};
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
    }

    .value {
      font-size: 0.95rem;
      color: ${({ $light }) => ($light ? "#18181b" : "#e8e8e8")};
      word-break: break-word;
      &.empty {
        color: ${({ $light }) => ($light ? "#9ca3af" : "#ffffff33")};
        font-style: italic;
      }
    }

    .input-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;

      .edit-input {
        flex: 1;
        background: transparent;
        border: none;
        border-bottom: 1.5px solid #6b7280;
        color: ${({ $light }) => ($light ? "#18181b" : "white")};
        font-size: 0.95rem;
        font-family: inherit;
        outline: none;
        padding: 0.15rem 0.1rem;
        min-width: 0;
        &::placeholder {
          color: ${({ $light }) => ($light ? "#9ca3af" : "#ffffff33")};
        }
      }

      .icon-btn {
        flex-shrink: 0;
        width: 1.7rem;
        height: 1.7rem;
        border-radius: 50%;
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1rem;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;

        &.confirm {
          background: #4b5563;
          color: white;
          &:hover {
            background: #6b7280;
            transform: scale(1.1);
          }
          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }
        }

        &.discard {
          background: ${({ $light }) => ($light ? "#f3f4f6" : "#ffffff15")};
          color: ${({ $light }) => ($light ? "#52525b" : "#d1d1d1")};
          &:hover {
            background: #ff4d4d33;
            color: #ff6b6b;
            transform: scale(1.1);
          }
        }
      }
    }

    .field-error {
      font-size: 0.72rem;
      color: #ff6b6b;
      margin-top: 0.1rem;
    }
  }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#171717")};
  height: 100%;
  padding: 2.5rem 1.5rem;
  overflow-y: auto;

  .card {
    width: 100%;
    max-width: 480px;
    background: ${(p) => (p.$light ? "#ffffff" : "#1f1f23")};
    border-radius: 1.2rem;
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff0d")};
    overflow: hidden;
    box-shadow: ${(p) =>
      p.$light ? "0 4px 24px rgba(26, 26, 46, 0.08)" : "0 8px 32px rgba(0,0,0,0.4)"};
  }

  .avatar-wrap {
    display: flex;
    justify-content: center;
    padding: 2.2rem 0 1.8rem;
    background: ${(p) =>
      p.$light
        ? "linear-gradient(160deg, #f3f4f6 0%, #ffffff 100%)"
        : "linear-gradient(160deg, #18181b 0%, #1f1f23 100%)"};
  }

  .avatar-ring {
    position: relative;
    width: 7rem;
    height: 7rem;

    .avatar {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 3px solid #6b7280;
      object-fit: cover;
      display: block;
    }

    .avatar-edit-btn {
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 1.9rem;
      height: 1.9rem;
      border-radius: 50%;
      background: #4b5563;
      border: 2.5px solid ${(p) => (p.$light ? "#ffffff" : "#1f1f23")};
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      cursor: pointer;
      transition: background 0.15s, transform 0.15s;
      &:hover {
        background: #6b7280;
        transform: scale(1.12);
      }
    }
  }

  .row-divider {
    height: 1px;
    background: ${(p) => (p.$light ? "#e5e7eb" : "#ffffff08")};
    margin: 0 1.4rem;
  }
`;
