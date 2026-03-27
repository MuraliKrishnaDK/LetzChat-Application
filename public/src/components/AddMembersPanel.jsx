import React from "react";
import styled from "styled-components";
import { useChatAppearance } from "../context/ChatAppearanceContext";

export default function AddMembersPanel({
  selected = [],
  onRemoveMember,
  onCancel,
  onConfirm,
  canConfirm,
  confirming,
}) {
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";

  return (
    <PanelWrap $light={isLight} role="dialog" aria-label="Add members">
      <div className="panel-inner">
        <section className="selected-section">
          <h3 className="section-title">Selected ({selected.length})</h3>
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
        </section>

        <footer className="panel-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn-primary${canConfirm ? " active" : ""}`}
            disabled={!canConfirm || confirming}
            onClick={onConfirm}
          >
            {confirming ? "Adding…" : "Add to Group"}
          </button>
        </footer>
      </div>
    </PanelWrap>
  );
}

const PanelWrap = styled.div`
  position: absolute;
  left: 50%;
  bottom: 1.25rem;
  transform: translateX(-50%);
  width: min(28rem, calc(100% - 2rem));
  max-height: min(70vh, 22rem);
  z-index: 90;
  display: flex;
  flex-direction: column;

  .panel-inner {
    display: flex;
    flex-direction: column;
    max-height: inherit;
    background: ${(p) => (p.$light ? "#ffffff" : "#252528")};
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#6b728044")};
    border-radius: 1rem;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .selected-section {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1rem 1.15rem 0.85rem;
  }

  .section-title {
    margin: 0 0 0.65rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6b7280;
    font-weight: 600;
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

  .panel-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.65rem;
    padding: 0.85rem 1.15rem 1rem;
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
