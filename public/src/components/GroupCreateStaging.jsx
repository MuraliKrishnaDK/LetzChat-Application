import React, { useState } from "react";
import styled from "styled-components";
import { IoClose } from "react-icons/io5";
import { MdGroups } from "react-icons/md";
import { useChatAppearance } from "../context/ChatAppearanceContext";

export default function GroupCreateStaging({
  selected = [],
  groupName = "",
  onGroupNameChange,
  onRemoveMember,
  onCreate,
  onCancel,
  canCreate,
  creating,
}) {
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";
  const [nameError, setNameError] = useState(false);

  const handleCreateClick = () => {
    if (!groupName.trim()) {
      setNameError(true);
      return;
    }
    onCreate?.();
  };

  return (
    <Wrap $light={isLight}>
      <div className="staging-inner">
        <header className="staging-header">
          <div className="title-row">
            <MdGroups className="title-icon" aria-hidden />
            <div className="title-text-block">
              <h2>New group</h2>
              <p className="subtitle">Add more than 1 chat, then create your group.</p>
              <input
                id="new-group-name-input"
                type="text"
                className={`group-name-input${nameError ? " has-error" : ""}`}
                value={groupName}
                onChange={(e) => onGroupNameChange?.(e.target.value)}
                onFocus={() => setNameError(false)}
                placeholder="Group Name"
                maxLength={80}
                autoComplete="off"
                aria-label="Group name"
                aria-invalid={nameError}
              />
            </div>
          </div>
          <button type="button" className="close-btn" title="Cancel" onClick={onCancel}>
            <IoClose />
          </button>
        </header>

        <section className="selected-section">
          <h3 className="section-title">Selected ({selected.length})</h3>
          {selected.length === 0 ? (
            <p className="empty-hint">Click names in the list to add them here.</p>
          ) : (
            <ul className="chip-list">
              {selected.map((c) => (
                <li key={c._id}>
                  <button
                    type="button"
                    className="chip"
                    title={`Remove ${c.username}`}
                    onClick={() => onRemoveMember(c._id)}
                  >
                    <span className="chip-avatar">
                      <img src={`data:image/svg+xml;base64,${c.avatarImage}`} alt="" />
                    </span>
                    <span className="chip-name">{c.username}</span>
                    <span className="chip-x" aria-hidden>
                      ×
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="staging-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={creating}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn-primary${canCreate ? " active" : ""}`}
            disabled={!canCreate || creating}
            onClick={handleCreateClick}
          >
            {creating ? "Creating…" : "Create Group"}
          </button>
        </footer>
      </div>
    </Wrap>
  );
}

const Wrap = styled.div`
  flex: 1;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  background: ${(p) => (p.$light ? "#f3f4f6" : "#171717")};
  padding: 1.25rem 1.5rem;

  .staging-inner {
    flex: 1;
    max-width: 32rem;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: ${(p) => (p.$light ? "#ffffff" : "#252528")};
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#6b728044")};
    border-radius: 1rem;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }

  .staging-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.25rem 1.25rem 1rem;
    border-bottom: 1px solid ${(p) => (p.$light ? "#f3f4f6" : "#ffffff12")};
  }

  .title-row {
    display: flex;
    gap: 0.85rem;
    align-items: flex-start;
    min-width: 0;
    flex: 1;
  }

  .title-text-block {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .group-name-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.55rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff30")};
    background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff10")};
    color: ${(p) => (p.$light ? "#18181b" : "white")};
    font-size: 0.92rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
    &::placeholder {
      color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff44")};
    }
    &:focus {
      border-color: #6b7280;
    }
    &.has-error {
      border-color: #ff4d4d;
      box-shadow: 0 0 0 1px #ff4d4d;
    }
    &.has-error:focus {
      border-color: #6b7280;
      box-shadow: none;
    }
  }

  .title-icon {
    font-size: 2rem;
    color: #6b7280;
    flex-shrink: 0;
    margin-top: 0.15rem;
  }

  h2 {
    margin: 0;
    font-size: 1.35rem;
    color: ${(p) => (p.$light ? "#18181b" : "white")};
    font-weight: 700;
  }

  .subtitle {
    margin: 0.35rem 0 0;
    font-size: 0.85rem;
    color: ${(p) => (p.$light ? "#52525b" : "#ffffff88")};
    line-height: 1.4;
  }

  .close-btn {
    background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff12")};
    border: none;
    color: ${(p) => (p.$light ? "#52525b" : "#ffffffaa")};
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.35rem;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s;
    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff22")};
      color: ${(p) => (p.$light ? "#18181b" : "white")};
    }
  }

  .selected-section {
    flex: 1;
    min-height: 12rem;
    overflow-y: auto;
    padding: 1rem 1.25rem 1.25rem;
  }

  .section-title {
    margin: 0 0 0.75rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    font-weight: 600;
  }

  .empty-hint {
    margin: 0;
    font-size: 0.9rem;
    color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff55")};
    line-height: 1.5;
  }

  .chip-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.35rem 0.55rem 0.35rem 0.35rem;
    border-radius: 999px;
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff28")};
    background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff10")};
    color: ${(p) => (p.$light ? "#18181b" : "white")};
    font-size: 0.88rem;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
    max-width: 100%;
    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff18")};
      border-color: #6b7280;
    }
  }

  .chip-avatar img {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .chip-name {
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chip-x {
    font-size: 1.1rem;
    line-height: 1;
    opacity: 0.65;
    padding-right: 0.15rem;
  }

  .staging-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.65rem;
    padding: 1rem 1.25rem 1.25rem;
    border-top: 1px solid ${(p) => (p.$light ? "#f3f4f6" : "#ffffff12")};
    flex-shrink: 0;
  }

  .btn-secondary {
    padding: 0.55rem 1.1rem;
    border-radius: 0.5rem;
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff30")};
    background: transparent;
    color: ${(p) => (p.$light ? "#18181b" : "#d1d1d1")};
    font-size: 0.9rem;
    font-family: inherit;
    cursor: pointer;
    &:hover:not(:disabled) {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff10")};
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-primary {
    padding: 0.55rem 1.25rem;
    border-radius: 0.5rem;
    border: none;
    background: ${(p) => (p.$light ? "#d1d5db" : "#ffffff20")};
    color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff55")};
    font-size: 0.9rem;
    font-weight: 600;
    font-family: inherit;
    cursor: not-allowed;
    transition: background 0.2s, color 0.2s, box-shadow 0.2s;

    &.active {
      background: linear-gradient(135deg, #6b7280, #4b5563);
      color: white;
      cursor: pointer;
      box-shadow: 0 4px 18px rgba(107, 114, 128, 0.45);
      &:hover:not(:disabled) {
        filter: brightness(1.05);
      }
    }
    &:disabled {
      cursor: not-allowed;
    }
  }
`;
