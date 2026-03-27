import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import styled from "styled-components";
import axios from "axios";
import { searchMessagesRoute } from "../utils/APIRoutes";
import { IoSearchOutline, IoCloseCircle } from "react-icons/io5";
import { AiOutlineFile, AiOutlineFileImage, AiOutlineVideoCamera } from "react-icons/ai";
import { BsMicFill, BsThreeDotsVertical, BsCheckSquare } from "react-icons/bs";
import { MdGroups, MdPushPin, MdOutlineBlock, MdOutlineDeleteSweep, MdDeleteForever } from "react-icons/md";
import { useChatAppearance } from "../context/ChatAppearanceContext";
import { brandLogoUrl } from "../brand";

const FileIcon = ({ fileType }) => {
  if (fileType === "image") return <AiOutlineFileImage className="preview-icon" />;
  if (fileType === "video") return <AiOutlineVideoCamera className="preview-icon" />;
  if (fileType === "audio") return <BsMicFill className="preview-icon" />;
  return <AiOutlineFile className="preview-icon" />;
};

const MessagePreview = ({ preview }) => {
  if (!preview) return null;
  if (preview.deleted) return <span className="preview deleted">This message was deleted</span>;

  const prefix = preview.fromSelf ? <span className="you">You: </span> : null;

  if (preview.fileType) {
    const label =
      preview.fileType === "image" ? "Photo" :
      preview.fileType === "video" ? "Video" :
      preview.fileType === "audio" ? "Voice message" :
      preview.fileName || "File";
    return (
      <span className="preview file-preview-row">
        {prefix}<FileIcon fileType={preview.fileType} />{label}
      </span>
    );
  }

  return <span className="preview">{prefix}{preview.text}</span>;
};

export default function Contacts({
  contacts: legacyChatList,
  chatItems,
  userContacts,
  changeChat,
  unreadCounts = {},
  lastMessages = {},
  createGroupMode = false,
  groupSelectedIds = [],
  onAddToGroupCreate,
  onEnterCreateGroupMode,
  selectedChatId,
  pinnedChatIds = [],
  onTogglePinChat,
  blockedUserIds = [],
  onChatMenuBlock,
  onChatMenuClear,
  onChatMenuDelete,
  onChatColumnEmptyClick,
}) {
  const listForSidebar = chatItems ?? legacyChatList;
  const usersOnly = userContacts ?? legacyChatList;

  const availableForGroup = useMemo(() => {
    const selected = new Set(groupSelectedIds);
    return [...usersOnly]
      .filter((c) => !c.isGroup && !selected.has(c._id))
      .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }));
  }, [usersOnly, groupSelectedIds]);

  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";
  const [currentUserId, setCurrentUserId] = useState(undefined);

  const [query, setQuery] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [messageResults, setMessageResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const debounceRef = useRef(null);
  const [showBrandMenu, setShowBrandMenu] = useState(false);
  const brandMenuRef = useRef(null);
  const [openChatMenuId, setOpenChatMenuId] = useState(null);
  const chatRowMenuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (brandMenuRef.current && !brandMenuRef.current.contains(e.target)) setShowBrandMenu(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(async () => {
    const data = await JSON.parse(
      localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
    );
    setCurrentUserId(data._id);
  }, []);

  useEffect(() => {
    if (createGroupMode) setOpenChatMenuId(null);
  }, [createGroupMode]);

  useEffect(() => {
    if (!openChatMenuId) return;
    const close = (e) => {
      if (chatRowMenuRef.current && !chatRowMenuRef.current.contains(e.target)) {
        setOpenChatMenuId(null);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [openChatMenuId]);

  const runSearch = useCallback(
    async (q) => {
      const trimmed = q.trim();
      if (!trimmed) {
        setPeopleResults([]);
        setMessageResults([]);
        setSearching(false);
        return;
      }

      setSearching(true);

      const selected = new Set(groupSelectedIds);
      const people = usersOnly.filter(
        (c) =>
          !c.isGroup &&
          c.username.toLowerCase().includes(trimmed.toLowerCase()) &&
          (!createGroupMode || !selected.has(c._id))
      );
      setPeopleResults(people);

      if (createGroupMode) {
        setMessageResults([]);
        setSearching(false);
        return;
      }

      // ── Message search (server) ────────────────────────────────────────
      try {
        const { data } = await axios.post(searchMessagesRoute, {
          userId: currentUserId,
          query: trimmed,
        });

        // Attach full contact object to each result
        const enriched = data
          .map((r) => {
            const contact = usersOnly.find((c) => c._id === r.otherUserId);
            return contact ? { ...r, contact } : null;
          })
          .filter(Boolean);

        // De-duplicate: keep only the latest message per contact
        const seen = new Set();
        const deduped = enriched.filter((r) => {
          if (seen.has(r.otherUserId)) return false;
          seen.add(r.otherUserId);
          return true;
        });

        setMessageResults(deduped);
      } catch {
        setMessageResults([]);
      }

      setSearching(false);
    },
    [usersOnly, currentUserId, createGroupMode, groupSelectedIds]
  );

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(val), 300);
  };

  const clearSearch = () => {
    setQuery("");
    setPeopleResults([]);
    setMessageResults([]);
    setSearching(false);
  };

  const changeCurrentChat = (contact) => {
    if (createGroupMode) {
      const selected = new Set(groupSelectedIds);
      if (!contact.isGroup && onAddToGroupCreate && !selected.has(contact._id)) {
        onAddToGroupCreate(contact);
      }
      return;
    }
    setOpenChatMenuId(null);
    changeChat(contact);
  };

  const openContactFromSearch = (contact) => {
    if (createGroupMode) {
      const selected = new Set(groupSelectedIds);
      if (!contact.isGroup && onAddToGroupCreate && !selected.has(contact._id)) {
        onAddToGroupCreate(contact);
      }
      clearSearch();
      return;
    }
    changeCurrentChat(contact);
    clearSearch();
  };

  const highlight = (text, q) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i}>{part}</mark>
      ) : (
        part
      )
    );
  };

  const isSearching = query.trim().length > 0;

  const pinnedSet = useMemo(() => new Set(pinnedChatIds.map(String)), [pinnedChatIds]);
  const blockedSet = useMemo(() => new Set(blockedUserIds.map(String)), [blockedUserIds]);

  const handleContactsPaneClick = (e) => {
    if (e.target.closest(".contact")) return;
    onChatColumnEmptyClick?.();
  };

  return (
    <>
      <Container $light={isLight}>
          {/* ── Brand ── */}
          <div className="brand">
            <div className="brand-main">
              <img src={brandLogoUrl} alt="" className="brand-logo" width={36} height={36} />
              <h3>LetzChat</h3>
            </div>
            <div className="brand-menu-wrap" ref={brandMenuRef}>
              <button
                type="button"
                className="brand-kebab"
                aria-expanded={showBrandMenu}
                aria-haspopup="menu"
                title="More options"
                onClick={() => setShowBrandMenu((v) => !v)}
              >
                <BsThreeDotsVertical />
              </button>
              {showBrandMenu && (
                <BrandDropdown $light={isLight} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowBrandMenu(false);
                      onEnterCreateGroupMode?.();
                    }}
                  >
                    <MdGroups className="menu-item-icon" aria-hidden />
                    <span>Create Group</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => setShowBrandMenu(false)}>
                    <BsCheckSquare className="menu-item-icon" aria-hidden />
                    <span>Select chats</span>
                  </button>
                </BrandDropdown>
              )}
            </div>
          </div>

          {/* ── Search bar ── */}
          <div className="search-bar">
            <IoSearchOutline className="search-icon" />
            <input
              type="text"
              placeholder="Search"
              value={query}
              onChange={handleQueryChange}
            />
            {query && (
              <IoCloseCircle className="clear-icon" onClick={clearSearch} />
            )}
          </div>

          {/* ── Contact list / Search results ── */}
          <div className="contacts" onClick={handleContactsPaneClick} role="presentation">
            {createGroupMode && !isSearching && (
              <p className="create-group-hint">Tap on the chats to add to your group</p>
            )}
            {!isSearching &&
              (createGroupMode ? availableForGroup : listForSidebar).map((contact) => {
                const unread = unreadCounts[contact._id] || 0;
                const pickerMode = createGroupMode;
                const cid = String(contact._id);
                const isPinned = pinnedSet.has(cid);
                const isBlocked = !contact.isGroup && blockedSet.has(cid);
                const menuOpen = openChatMenuId === contact._id;
                return (
                  <div
                    key={contact._id}
                    className={`contact ${
                      !pickerMode && contact._id === selectedChatId ? "selected" : ""
                    }`}
                    onClick={() => changeCurrentChat(contact)}
                  >
                    <div className="avatar">
                      {contact.isGroup ? (
                        contact.avatarImage ? (
                          <img
                            src={
                              String(contact.avatarImage).startsWith("data:")
                                ? contact.avatarImage
                                : `data:image/svg+xml;base64,${contact.avatarImage}`
                            }
                            alt=""
                            className="sidebar-group-photo"
                          />
                        ) : (
                          <span className="group-avatar-fallback" aria-hidden>
                            <MdGroups />
                          </span>
                        )
                      ) : (
                        <img
                          src={`data:image/svg+xml;base64,${contact.avatarImage}`}
                          alt=""
                        />
                      )}
                    </div>
                    <div className="username">
                      <h3>{contact.username}</h3>
                      <MessagePreview preview={lastMessages[contact._id]} />
                    </div>
                    {!pickerMode && (
                      <div
                        className="contact-actions"
                        ref={menuOpen ? chatRowMenuRef : undefined}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isPinned && (
                          <span
                            className="contact-pin-indicator"
                            title="Pinned chat"
                            aria-label="Pinned"
                          >
                            <MdPushPin />
                          </span>
                        )}
                        {isBlocked && (
                          <span
                            className="contact-block-indicator"
                            title="You blocked this contact"
                            aria-label="Blocked"
                          >
                            <MdOutlineBlock />
                          </span>
                        )}
                        <div className="contact-menu-wrap">
                        <button
                          type="button"
                          className="contact-kebab"
                          aria-expanded={menuOpen}
                          aria-haspopup="menu"
                          title="Chat options"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenChatMenuId((id) => (id === contact._id ? null : contact._id));
                          }}
                        >
                          <BsThreeDotsVertical />
                        </button>
                        {menuOpen && (
                          <ChatRowDropdown $light={isLight} role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenChatMenuId(null);
                                onTogglePinChat?.(contact);
                              }}
                            >
                              <MdPushPin className="menu-item-icon" aria-hidden />
                              <span>{isPinned ? "Unpin" : "Pin"}</span>
                            </button>
                            {!contact.isGroup && (
                              <button
                                type="button"
                                role="menuitem"
                                className={isBlocked ? "unblock-menu-item" : ""}
                                onClick={() => {
                                  setOpenChatMenuId(null);
                                  onChatMenuBlock?.(contact);
                                }}
                              >
                                <MdOutlineBlock className="menu-item-icon" aria-hidden />
                                <span>{isBlocked ? "Unblock" : "Block"}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenChatMenuId(null);
                                onChatMenuClear?.(contact);
                              }}
                            >
                              <MdOutlineDeleteSweep className="menu-item-icon" aria-hidden />
                              <span>Clear chat</span>
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              onClick={() => {
                                setOpenChatMenuId(null);
                                onChatMenuDelete?.(contact);
                              }}
                            >
                              <MdDeleteForever className="menu-item-icon" aria-hidden />
                              <span>{contact.isGroup ? "Leave group" : "Delete chat"}</span>
                            </button>
                          </ChatRowDropdown>
                        )}
                        </div>
                      </div>
                    )}
                    {!pickerMode && unread > 0 && (
                      <span className="unread-badge">{unread > 99 ? "99+" : unread}</span>
                    )}
                  </div>
                );
              })}

            {isSearching && (
              <>
                {/* People section */}
                {peopleResults.length > 0 && (
                  <>
                    <p className="section-label">People</p>
                    {peopleResults.map((contact) => (
                      <div
                        key={contact._id}
                        className="contact"
                        onClick={() => openContactFromSearch(contact)}
                      >
                        <div className="avatar">
                          <img
                            src={`data:image/svg+xml;base64,${contact.avatarImage}`}
                            alt=""
                          />
                        </div>
                        <div className="username">
                          <h3>{highlight(contact.username, query)}</h3>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Messages section */}
                {messageResults.length > 0 && (
                  <>
                    <p className="section-label">Messages</p>
                    {messageResults.map((r) => (
                      <div
                        key={r.messageId}
                        className="contact message-result"
                        onClick={() => openContactFromSearch(r.contact)}
                      >
                        <div className="avatar">
                          <img
                            src={`data:image/svg+xml;base64,${r.contact.avatarImage}`}
                            alt=""
                          />
                        </div>
                        <div className="username">
                          <h3>{r.contact.username}</h3>
                          <p className="snippet">
                            {r.fromSelf && <span className="you">You: </span>}
                            {highlight(r.text, query)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* No results */}
                {!searching &&
                  peopleResults.length === 0 &&
                  messageResults.length === 0 && (
                    <p className="no-results">No results for "{query}"</p>
                  )}

                {searching && (
                  <p className="no-results">Searching…</p>
                )}
              </>
            )}
          </div>

      </Container>
    </>
  );
}

const Container = styled.div`
  display: grid;
  grid-template-rows: auto auto 1fr;
  overflow: hidden;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};

  /* ── Brand ── */
  .brand {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 1rem 0.8rem 0.6rem 0.6rem;

    .brand-main {
      display: flex;
      align-items: center;
      gap: 0.55rem;
      min-width: 0;
    }

    .brand-logo {
      height: 2rem;
      width: auto;
      max-width: 2.5rem;
      object-fit: contain;
      display: block;
      flex-shrink: 0;
    }

    h3 {
      color: ${(p) => (p.$light ? "#18181b" : "white")};
      font-weight: 600;
      font-size: 1.1rem;
      letter-spacing: -0.02em;
      margin: 0;
    }

    .brand-menu-wrap {
      position: relative;
      flex-shrink: 0;
    }

    .brand-kebab {
      background: transparent;
      border: none;
      color: ${(p) => (p.$light ? "#52525b" : "#ffffff88")};
      font-size: 1.25rem;
      width: 2.1rem;
      height: 2.1rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      &:hover {
        background: ${(p) => (p.$light ? "#00000010" : "#ffffff15")};
        color: ${(p) => (p.$light ? "#18181b" : "white")};
      }
    }
  }

  /* ── Search bar ── */
  .search-bar {
    display: flex;
    align-items: center;
    margin: 0 0.8rem 0.6rem;
    background-color: ${(p) => (p.$light ? "rgba(255,255,255,0.92)" : "#ffffff14")};
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff20")};
    border-radius: 2rem;
    padding: 0.4rem 0.8rem;
    gap: 0.5rem;
    transition: border-color 0.2s;

    &:focus-within {
      border-color: #6b7280;
    }

    .search-icon {
      color: #6b7280;
      font-size: 1.1rem;
      flex-shrink: 0;
    }

    input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: ${(p) => (p.$light ? "#18181b" : "white")};
      font-size: 0.88rem;
      &::placeholder { color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff55")}; }
    }

    .clear-icon {
      color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff55")};
      font-size: 1.1rem;
      cursor: pointer;
      flex-shrink: 0;
      transition: color 0.15s;
      &:hover { color: #ff4d4d; }
    }
  }

  /* ── Contact list ── */
  .contacts {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    gap: 0.5rem;
    padding: 0.3rem 0;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: #ffffff39;
        width: 0.1rem;
        border-radius: 1rem;
      }
    }

    .section-label {
      width: 90%;
      color: #6b7280;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0.3rem 0 0.1rem;
      padding-left: 0.2rem;
    }

    .no-results {
      color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff44")};
      font-size: 0.85rem;
      margin-top: 1rem;
      text-align: center;
      width: 100%;
    }

      .contact {
        position: relative;
        background-color: ${(p) => (p.$light ? "#ffffff" : "#ffffff1a")};
        border: ${(p) => (p.$light ? "1px solid #e5e7eb" : "none")};
        min-height: 4rem;
        cursor: pointer;
        width: 90%;
        border-radius: 0.5rem;
        padding: 0.5rem 0.6rem;
        display: flex;
        gap: 0.5rem;
        align-items: center;
        transition: background 0.2s;

        &:hover { background-color: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff28")}; }

        .contact-actions {
          position: relative;
          flex-shrink: 0;
          align-self: center;
          display: flex;
          align-items: center;
          gap: 0.15rem;
        }

        .contact-pin-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${(p) => (p.$light ? "#6b7280" : "#6b7280")};
          font-size: 1.05rem;
          flex-shrink: 0;
          line-height: 1;
        }

        &.selected .contact-pin-indicator {
          color: rgba(255, 255, 255, 0.92);
        }

        .contact-block-indicator {
          display: flex;
          align-items: center;
          justify-content: center;
          color: ${(p) => (p.$light ? "#6b7280" : "#6b7280")};
          font-size: 1.05rem;
          flex-shrink: 0;
          line-height: 1;
        }

        &.selected .contact-block-indicator {
          color: rgba(255, 255, 255, 0.92);
        }

        .contact-menu-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .contact-kebab {
          background: transparent;
          border: none;
          color: ${(p) => (p.$light ? "#52525b" : "#ffffff88")};
          font-size: 1.15rem;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          &:hover {
            background: ${(p) => (p.$light ? "#00000010" : "#ffffff15")};
            color: ${(p) => (p.$light ? "#18181b" : "white")};
          }
        }

        &.selected .contact-kebab {
          color: rgba(255, 255, 255, 0.92);
          &:hover { background: rgba(255, 255, 255, 0.15); color: white; }
        }

        .avatar img,
        .sidebar-group-photo {
          height: 3rem;
          flex-shrink: 0;
          width: 3rem;
          object-fit: cover;
          border-radius: 50%;
        }

        .group-avatar-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 3rem;
          height: 3rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #6b7280, #4b5563);
          color: white;
          font-size: 1.35rem;
          flex-shrink: 0;
        }

        .username {
          flex: 1;
          min-width: 0;
          overflow: hidden;

          h3 {
            color: ${(p) => (p.$light ? "#18181b" : "white")};
            font-size: 0.95rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            mark {
              background: #6b7280;
              color: white;
              border-radius: 2px;
              padding: 0 1px;
            }
          }

          .preview {
            display: flex;
            align-items: center;
            gap: 0.25rem;
            color: ${(p) => (p.$light ? "#52525b" : "#ffffffa0")};
            font-size: 0.76rem;
            margin-top: 0.15rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;

            &.deleted { font-style: italic; color: #ffffff55; }

            .you { color: #6b7280aa; font-weight: 600; flex-shrink: 0; }

            .preview-icon {
              font-size: 0.8rem;
              flex-shrink: 0;
              color: #ffffffa0;
            }
          }

          .file-preview-row {
            display: flex;
            align-items: center;
          }

          .snippet {
            color: ${(p) => (p.$light ? "#52525b" : "#ffffffa0")};
            font-size: 0.78rem;
            margin-top: 0.15rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 140px;
            mark {
              background: #6b728060;
              color: #d1d1d1;
              border-radius: 2px;
              padding: 0 1px;
            }
            .you { color: #6b7280; font-weight: 600; }
          }
        }
      }

    .selected { background-color: #6b7280 !important; }

    .unread-badge {
      flex-shrink: 0;
      margin-left: 0.15rem;
      background-color: #4b5563;
      color: white;
      font-size: 0.7rem;
      font-weight: 700;
      min-width: 1.35rem;
      height: 1.35rem;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 0.3rem;
      box-shadow: 0 0 0 2px #0a0a0c;
      animation: badgePop 0.2s ease;
    }

    @keyframes badgePop {
      from { transform: scale(0.5); opacity: 0; }
      to   { transform: scale(1);   opacity: 1; }
    }

    .message-result .username h3 { font-size: 0.88rem; }

    .create-group-hint {
      width: 90%;
      color: #6b7280;
      font-size: 0.78rem;
      font-weight: 600;
      margin: 0 0 0.35rem;
      line-height: 1.35;
      letter-spacing: 0.02em;
    }
  }

`;

const ChatRowDropdown = styled.div`
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 160;
  min-width: 12rem;
  background: ${(p) => (p.$light ? "#ffffff" : "#252528")};
  border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#6b728044")};
  border-radius: 0.65rem;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  padding: 0.35rem 0;
  display: flex;
  flex-direction: column;

  button {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    padding: 0.6rem 1rem;
    background: transparent;
    border: none;
    color: ${(p) => (p.$light ? "#18181b" : "#d1d1d1")};
    font-size: 0.88rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s;

    .menu-item-icon {
      font-size: 1.1rem;
      color: #6b7280;
      flex-shrink: 0;
    }

    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff15")};
    }

    &.danger {
      color: #ff6b6b;
      .menu-item-icon {
        color: #ff6b6b;
      }
    }

    &.unblock-menu-item {
      color: ${(p) => (p.$light ? "#a67c00" : "#f5d04a")};
      .menu-item-icon {
        color: ${(p) => (p.$light ? "#a67c00" : "#f5d04a")};
      }
      &:hover {
        background: ${(p) => (p.$light ? "#fff8e1" : "#ffffff12")};
        color: ${(p) => (p.$light ? "#8a6600" : "#f5d04a")};
        .menu-item-icon {
          color: ${(p) => (p.$light ? "#8a6600" : "#f5d04a")};
        }
      }
    }
  }
`;

const BrandDropdown = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 200;
  min-width: 11.5rem;
  background: ${(p) => (p.$light ? "#ffffff" : "#252528")};
  border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#6b728044")};
  border-radius: 0.65rem;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  padding: 0.35rem 0;
  display: flex;
  flex-direction: column;

  button {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    padding: 0.65rem 1.1rem;
    background: transparent;
    border: none;
    color: ${(p) => (p.$light ? "#18181b" : "#d1d1d1")};
    font-size: 0.9rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    transition: background 0.12s;

    .menu-item-icon {
      font-size: 1.1rem;
      color: #6b7280;
      flex-shrink: 0;
    }

    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff15")};
    }
  }
`;
