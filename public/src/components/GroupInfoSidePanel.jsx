import React, { useMemo, useState, useRef, useEffect } from "react";
import styled from "styled-components";
import axios from "axios";
import { IoSearchOutline, IoChevronBack, IoLinkOutline, IoClose } from "react-icons/io5";
import { MdGroups, MdPersonAdd, MdEdit, MdCheck, MdClose, MdPerson } from "react-icons/md";
import { AiOutlineFile } from "react-icons/ai";
import { updateGroupProfileRoute, groupSharedContentRoute } from "../utils/APIRoutes";
import { useChatAppearance } from "../context/ChatAppearanceContext";

const SHARED_TABS = [
  { key: "media", label: "Media" },
  { key: "docs", label: "Docs" },
  { key: "links", label: "Links" },
];

function avatarSrc(avatarImage) {
  if (!avatarImage) return null;
  if (String(avatarImage).startsWith("data:")) return avatarImage;
  return `data:image/svg+xml;base64,${avatarImage}`;
}

export default function GroupInfoSidePanel({
  currentChat,
  currentUserId,
  allContacts = [],
  onSubmitAddMembers,
  addMembersSubmitting = false,
  requestOpenAddMembers = false,
  onConsumedRequestAddMembers,
  onClosePanel,
  onGroupProfileUpdated,
}) {
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";
  const [panelSearchOn, setPanelSearchOn] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const editPhotoInputRef = useRef(null);
  const memberSearchInputRef = useRef(null);
  const groupNameInputRef = useRef(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [baselineName, setBaselineName] = useState("");
  const [nameActionsUnlocked, setNameActionsUnlocked] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [sharedTab, setSharedTab] = useState("media");
  const [sharedData, setSharedData] = useState({ media: [], docs: [], links: [] });
  const [sharedLoading, setSharedLoading] = useState(false);
  const [addMembersOpen, setAddMembersOpen] = useState(false);
  const [addMembersSearch, setAddMembersSearch] = useState("");
  const [addMembersSelected, setAddMembersSelected] = useState([]);
  const addMembersSearchRef = useRef(null);

  const sharedTabIndex = Math.max(0, SHARED_TABS.findIndex((t) => t.key === sharedTab));

  const memberIdSet = useMemo(
    () => new Set((currentChat.members || []).map((id) => String(id))),
    [currentChat.members]
  );

  const nonMemberContacts = useMemo(
    () =>
      [...allContacts]
        .filter((c) => c && !c.isGroup && !memberIdSet.has(String(c._id)))
        .sort((a, b) => (a.username || "").localeCompare(b.username || "", undefined, { sensitivity: "base" })),
    [allContacts, memberIdSet]
  );

  const filteredNonMembers = useMemo(() => {
    const q = addMembersSearch.trim().toLowerCase();
    if (!q) return nonMemberContacts;
    return nonMemberContacts.filter((c) => (c.username || "").toLowerCase().includes(q));
  }, [nonMemberContacts, addMembersSearch]);

  const selectedIdSet = useMemo(() => new Set(addMembersSelected.map((c) => String(c._id))), [addMembersSelected]);

  useEffect(() => {
    setAddMembersOpen(false);
    setAddMembersSearch("");
    setAddMembersSelected([]);
  }, [currentChat._id]);

  useEffect(() => {
    if (!requestOpenAddMembers) return;
    setSharedOpen(false);
    setProfileEditOpen(false);
    setAddMembersOpen(true);
    setAddMembersSearch("");
    setAddMembersSelected([]);
    onConsumedRequestAddMembers?.();
    const id = requestAnimationFrame(() => addMembersSearchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [requestOpenAddMembers, onConsumedRequestAddMembers]);

  useEffect(() => {
    if (!sharedOpen || !currentChat?._id || !currentUserId) return;
    let cancelled = false;
    (async () => {
      setSharedLoading(true);
      try {
        const { data } = await axios.post(groupSharedContentRoute, {
          groupId: currentChat._id,
          userId: currentUserId,
        });
        if (!cancelled) setSharedData(data);
      } catch {
        if (!cancelled) setSharedData({ media: [], docs: [], links: [] });
      } finally {
        if (!cancelled) setSharedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sharedOpen, currentChat._id, currentUserId]);

  useEffect(() => {
    if (!panelSearchOn) return;
    const id = requestAnimationFrame(() => memberSearchInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [panelSearchOn]);

  const openSharedPanel = () => {
    setSharedTab("media");
    setSharedOpen(true);
  };

  const closeSharedPanel = () => setSharedOpen(false);

  const openAddMembersFlow = () => {
    setSharedOpen(false);
    setProfileEditOpen(false);
    setAddMembersSearch("");
    setAddMembersSelected([]);
    setAddMembersOpen(true);
  };

  const closeAddMembersFlow = () => {
    setAddMembersOpen(false);
    setAddMembersSearch("");
    setAddMembersSelected([]);
  };

  const toggleAddMemberSelection = (contact) => {
    setAddMembersSelected((prev) => {
      const id = String(contact._id);
      if (prev.some((p) => String(p._id) === id)) return prev.filter((p) => String(p._id) !== id);
      return [...prev, contact];
    });
  };

  const confirmAddMembers = async () => {
    if (!addMembersSelected.length || !onSubmitAddMembers) return;
    try {
      await onSubmitAddMembers(addMembersSelected);
      closeAddMembersFlow();
    } catch {
      /* parent shows alert */
    }
  };

  const openProfileEdit = () => setProfileEditOpen(true);

  const closeProfileEdit = () => {
    setProfileEditOpen(false);
    setNameActionsUnlocked(false);
  };

  const nameIsDirty = nameDraft.trim() !== baselineName.trim();
  const nameActionsEnabled = nameActionsUnlocked;
  const nameActionsHighlighted = nameActionsUnlocked && nameIsDirty;

  useEffect(() => {
    if (!profileEditOpen) return;
    const n = currentChat.username || "";
    setNameDraft(n);
    setBaselineName(n);
    setNameActionsUnlocked(false);
  }, [profileEditOpen, currentChat._id, currentChat.username]);

  const sortedMembers = useMemo(() => {
    const list = [...(currentChat.memberProfiles || [])];
    return list.sort((a, b) =>
      (a.username || "").localeCompare(b.username || "", undefined, { sensitivity: "base" })
    );
  }, [currentChat.memberProfiles]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return sortedMembers;
    return sortedMembers.filter((m) => (m.username || "").toLowerCase().includes(q));
  }, [sortedMembers, memberQuery]);

  const displayMembers = panelSearchOn ? filteredMembers : sortedMembers;

  const imgUrl = avatarSrc(currentChat.avatarImage);

  const saveGroupNameFromEdit = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      alert("Group name cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      await axios.patch(updateGroupProfileRoute(currentChat._id), {
        requesterId: currentUserId,
        name: trimmed,
      });
      onGroupProfileUpdated?.(currentChat._id, { name: trimmed });
      setBaselineName(trimmed);
      setNameDraft(trimmed);
      setNameActionsUnlocked(false);
    } catch (e) {
      alert(e.response?.data?.msg || "Could not update group");
    } finally {
      setSaving(false);
    }
  };

  const cancelGroupNameEdit = () => {
    setNameDraft(baselineName);
    setNameActionsUnlocked(false);
    groupNameInputRef.current?.blur();
  };

  const handleEditPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== "string") return;
      setSaving(true);
      try {
        await axios.patch(updateGroupProfileRoute(currentChat._id), {
          requesterId: currentUserId,
          avatarImage: dataUrl,
        });
        onGroupProfileUpdated?.(currentChat._id, { avatarImage: dataUrl });
      } catch (err) {
        alert(err.response?.data?.msg || "Could not update photo");
      } finally {
        setSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const renderSharedList = () => {
    if (sharedLoading) {
      return <p className="shared-empty">Loading…</p>;
    }
    if (sharedTab === "media") {
      const items = sharedData.media || [];
      if (!items.length) return <p className="shared-empty">No media yet</p>;
      return (
        <ul className="shared-list shared-list--media">
          {items.map((item) => (
            <li key={item._id} className="shared-media-item">
              {item.fileType === "image" ? (
                <a href={item.fileUrl} target="_blank" rel="noreferrer" className="shared-thumb-link">
                  <img src={item.fileUrl} alt="" className="shared-thumb" />
                </a>
              ) : item.fileType === "video" ? (
                <video controls className="shared-video" preload="metadata">
                  <source src={item.fileUrl} />
                </video>
              ) : (
                <div className="shared-audio-wrap">
                  <audio controls src={item.fileUrl} className="shared-audio" />
                </div>
              )}
            </li>
          ))}
        </ul>
      );
    }
    if (sharedTab === "docs") {
      const items = sharedData.docs || [];
      if (!items.length) return <p className="shared-empty">No documents yet</p>;
      return (
        <ul className="shared-list shared-list--docs">
          {items.map((item) => (
            <li key={item._id}>
              <a href={item.fileUrl} target="_blank" rel="noreferrer" className="shared-doc-row">
                <AiOutlineFile className="shared-doc-ic" aria-hidden />
                <span className="shared-doc-name">{item.fileName || "Document"}</span>
              </a>
            </li>
          ))}
        </ul>
      );
    }
    const items = sharedData.links || [];
    if (!items.length) return <p className="shared-empty">No links yet</p>;
    return (
      <ul className="shared-list shared-list--links">
        {items.map((item) => (
          <li key={item._id}>
            <a href={item.url} target="_blank" rel="noreferrer" className="shared-link-row">
              <IoLinkOutline className="shared-link-ic" aria-hidden />
              <span className="shared-link-url">{item.url}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Panel $light={isLight}>
      {onClosePanel && (
        <button type="button" className="panel-close-x" onClick={onClosePanel} aria-label="Close panel">
          <IoClose />
        </button>
      )}
      {addMembersOpen ? (
        <div className="add-members-full">
          <div className="add-members-sticky">
            <div className="add-members-toolbar">
              <button type="button" className="shared-back" onClick={closeAddMembersFlow} aria-label="Back">
                <IoChevronBack />
              </button>
              <h2 className="shared-toolbar-title">Add members</h2>
            </div>
            <div className="add-members-fixed-block">
              <div className="avatar-block add-members-avatar-wrap">
                <div className="avatar-ring">
                  <div className="avatar-display">
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="group-photo" />
                    ) : (
                      <span className="group-photo-fallback" aria-hidden>
                        <MdGroups />
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="action-row add-members-actions-row">
                <div className="action-btn add-member-pill-static" aria-current="true">
                  <MdPersonAdd className="action-ic" aria-hidden />
                  Add Member
                </div>
                <div className="member-search-pill is-input add-members-search">
                  <IoSearchOutline className="ms-icon" aria-hidden />
                  <input
                    ref={addMembersSearchRef}
                    type="search"
                    enterKeyHint="search"
                    className="member-search-input"
                    placeholder="Search"
                    value={addMembersSearch}
                    onChange={(e) => setAddMembersSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="add-members-scroll">
            {filteredNonMembers.length === 0 ? (
              <p className="shared-empty">
                {nonMemberContacts.length === 0 ? "Everyone is already in this group" : "No matching contacts"}
              </p>
            ) : (
              <ul className="add-members-list" aria-label="People you can add">
                {filteredNonMembers.map((c) => {
                  const picked = selectedIdSet.has(String(c._id));
                  return (
                    <li key={c._id}>
                      <button
                        type="button"
                        className={`add-members-row${picked ? " selected" : ""}`}
                        onClick={() => toggleAddMemberSelection(c)}
                      >
                        <span className="am-avatar">
                          <img src={`data:image/svg+xml;base64,${c.avatarImage}`} alt="" />
                        </span>
                        <span className="am-name">{c.username}</span>
                        {picked && <span className="am-check" aria-hidden>✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {addMembersSelected.length > 0 && (
            <div className="add-members-footer">
              <span className="am-footer-count">{addMembersSelected.length} selected</span>
              <button
                type="button"
                className="am-confirm-btn"
                disabled={addMembersSubmitting}
                onClick={confirmAddMembers}
              >
                {addMembersSubmitting ? "Adding…" : "Add to group"}
              </button>
            </div>
          )}
        </div>
      ) : sharedOpen ? (
        <div className="shared-full">
          <div className="shared-toolbar">
            <button type="button" className="shared-back" onClick={closeSharedPanel} aria-label="Back">
              <IoChevronBack />
            </button>
            <h2 className="shared-toolbar-title">Media, links and docs</h2>
          </div>
          <div className="shared-tabs" role="tablist">
            {SHARED_TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={sharedTab === key}
                className={`shared-tab${sharedTab === key ? " active" : ""}`}
                onClick={() => setSharedTab(key)}
              >
                {label}
              </button>
            ))}
            <SharedTabIndicator $index={sharedTabIndex} $count={SHARED_TABS.length} />
          </div>
          <div className="shared-scroll">{renderSharedList()}</div>
        </div>
      ) : profileEditOpen ? (
        <div className="profile-edit-full">
          <div className="profile-edit-toolbar">
            <button type="button" className="shared-back" onClick={closeProfileEdit} aria-label="Back">
              <IoChevronBack />
            </button>
            <h2 className="shared-toolbar-title">Edit group</h2>
          </div>
          <div className="profile-edit-body">
            <div className="profile-edit-avatar-block">
              <div className="profile-edit-avatar-ring">
                <button
                  type="button"
                  className="profile-edit-avatar-hit"
                  title="Change group photo"
                  disabled={saving}
                  onClick={() => editPhotoInputRef.current?.click()}
                >
                  {imgUrl ? (
                    <img src={imgUrl} alt="" className="group-photo" />
                  ) : (
                    <span className="group-photo-fallback" aria-hidden>
                      <MdGroups />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="edit-pencil-btn"
                  title="Upload image"
                  disabled={saving}
                  onClick={() => editPhotoInputRef.current?.click()}
                >
                  <MdEdit />
                </button>
              </div>
              <input
                ref={editPhotoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                aria-hidden
                onChange={handleEditPhotoChange}
              />
            </div>

            <div className="profile-edit-name-block">
              <div className="profile-edit-label-row">
                <MdPerson className="profile-edit-label-ic" aria-hidden />
                <span className="profile-edit-label">Name</span>
              </div>
              <div className="profile-edit-name-elevated">
                <input
                  ref={groupNameInputRef}
                  type="text"
                  className="profile-edit-name-input"
                  maxLength={40}
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onFocus={() => setNameActionsUnlocked(true)}
                  placeholder="Group name"
                />
              </div>
              <div className="profile-edit-name-actions">
                <button
                  type="button"
                  className={`profile-edit-action confirm${nameActionsHighlighted ? " highlighted" : ""}`}
                  disabled={!nameActionsEnabled || saving || !nameDraft.trim() || !nameIsDirty}
                  title="Save name"
                  onClick={saveGroupNameFromEdit}
                >
                  <MdCheck />
                </button>
                <button
                  type="button"
                  className={`profile-edit-action discard${nameActionsHighlighted ? " highlighted" : ""}`}
                  disabled={!nameActionsEnabled || saving}
                  title="Reset name"
                  onClick={cancelGroupNameEdit}
                >
                  <MdClose />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
      <div className="panel-scroll">
        <div className="avatar-block">
          <div className="avatar-ring">
            <div className="avatar-display">
              {imgUrl ? (
                <img src={imgUrl} alt="" className="group-photo" />
              ) : (
                <span className="group-photo-fallback" aria-hidden>
                  <MdGroups />
                </span>
              )}
            </div>
            <button type="button" className="profile-entry-edit-btn" onClick={openProfileEdit}>
              Edit
            </button>
          </div>
        </div>

        <div className="action-row">
          <button type="button" className="action-btn" onClick={openAddMembersFlow}>
            <MdPersonAdd className="action-ic" aria-hidden />
            Add Member
          </button>
          {panelSearchOn ? (
            <div className="member-search-pill is-input">
              <IoSearchOutline className="ms-icon" aria-hidden />
              <input
                ref={memberSearchInputRef}
                type="search"
                enterKeyHint="search"
                className="member-search-input"
                placeholder="Search"
                value={memberQuery}
                onChange={(e) => setMemberQuery(e.target.value)}
                onBlur={(e) => {
                  if (!e.target.value.trim()) {
                    setPanelSearchOn(false);
                    setMemberQuery("");
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setMemberQuery("");
                    setPanelSearchOn(false);
                    e.currentTarget.blur();
                  }
                }}
              />
            </div>
          ) : (
            <button
              type="button"
              className="member-search-pill"
              onClick={() => setPanelSearchOn(true)}
            >
              <IoSearchOutline className="ms-icon" aria-hidden />
              <span className="member-search-label">Search</span>
            </button>
          )}
        </div>

        <ul className="member-list" aria-label="Group members">
          {displayMembers.map((m) => (
            <li key={m._id} className="member-row">
              <div className="m-avatar">
                <img src={`data:image/svg+xml;base64,${m.avatarImage}`} alt="" />
              </div>
              <span className="m-name">{m.username}</span>
            </li>
          ))}
        </ul>
      </div>

      <button type="button" className="media-section" onClick={openSharedPanel}>
        <h3 className="media-title">Media, Links and Docs</h3>
        <p className="media-hint">View shared files and links</p>
      </button>
        </>
      )}
    </Panel>
  );
}

const SharedTabIndicator = styled.div`
  position: absolute;
  left: 0;
  bottom: 0;
  height: 3px;
  width: ${(p) => 100 / p.$count}%;
  background: #25d366;
  border-radius: 2px 2px 0 0;
  transition: transform 0.28s cubic-bezier(0.33, 1, 0.68, 1);
  transform: translateX(${(p) => p.$index * 100}%);
  pointer-events: none;
`;

const Panel = styled.aside`
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};
  border-left: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff18")};

  .panel-close-x {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    z-index: 20;
    width: 2.15rem;
    height: 2.15rem;
    border: none;
    border-radius: 50%;
    background: ${(p) => (p.$light ? "#ffffff" : "#ffffff14")};
    color: ${(p) => (p.$light ? "#52525b" : "#d1d1d1")};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.45rem;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff22")};
      color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
    }
  }

  .shared-full {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .profile-edit-full {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .add-members-full {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .add-members-sticky {
    flex-shrink: 0;
    border-bottom: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
    background: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};
  }

  .add-members-toolbar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.65rem 2.75rem 0.5rem 0.35rem;
  }

  .add-members-fixed-block {
    padding: 0 0.9rem 0.85rem;
  }

  .add-members-avatar-wrap {
    margin-bottom: 0.75rem;
  }

  .add-members-actions-row {
    gap: 0.5rem;
    margin-bottom: 0;
  }

  .add-member-pill-static {
    pointer-events: none;
    opacity: 1;
    cursor: default;
  }

  .add-members-search {
    margin-bottom: 0;
  }

  .add-members-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.5rem 0.75rem 0.75rem;
    &::-webkit-scrollbar {
      width: 0.2rem;
    }
    &::-webkit-scrollbar-thumb {
      background: #ffffff30;
      border-radius: 1rem;
    }
  }

  .add-members-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .add-members-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    width: 100%;
    padding: 0.5rem 0.55rem;
    border-radius: 0.5rem;
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff18")};
    background: ${(p) => (p.$light ? "#ffffff" : "#ffffff08")};
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: border-color 0.15s, background 0.15s;
    &.selected {
      border-color: #6b7280;
      background: ${(p) => (p.$light ? "#f3f4f6" : "#6b728022")};
    }
    &:hover {
      border-color: #6b728088;
    }
  }

  .am-avatar img {
    width: 2.35rem;
    height: 2.35rem;
    border-radius: 50%;
    object-fit: cover;
    display: block;
  }

  .am-name {
    flex: 1;
    font-size: 0.88rem;
    color: ${(p) => (p.$light ? "#18181b" : "#e8e8e8")};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .am-check {
    color: #6b7280;
    font-weight: 700;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .add-members-footer {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.65rem 0.9rem 0.85rem;
    border-top: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
    background: ${(p) => (p.$light ? "#f3f4f6" : "#18181b")};
  }

  .am-footer-count {
    font-size: 0.82rem;
    color: ${(p) => (p.$light ? "#52525b" : "#ffffff88")};
  }

  .am-confirm-btn {
    border: none;
    border-radius: 2rem;
    padding: 0.45rem 1.1rem;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    background: #4b5563;
    color: white;
    transition: filter 0.15s, opacity 0.15s;
    &:hover:not(:disabled) {
      filter: brightness(1.06);
    }
    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  .profile-edit-toolbar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.65rem 2.75rem 0.5rem 0.35rem;
    flex-shrink: 0;
    border-bottom: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
  }

  .profile-edit-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 1.5rem 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    &::-webkit-scrollbar {
      width: 0.2rem;
    }
    &::-webkit-scrollbar-thumb {
      background: #ffffff30;
      border-radius: 1rem;
    }
  }

  .profile-edit-avatar-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    max-width: 20rem;
  }

  .profile-edit-avatar-ring {
    position: relative;
    width: 6.75rem;
    height: 6.75rem;
  }

  .profile-edit-avatar-hit {
    position: absolute;
    inset: 0;
    padding: 0;
    margin: 0;
    border: none;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
    display: block;
    &:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
  }

  .profile-edit-name-block {
    width: 100%;
    max-width: 20rem;
    margin-top: 1.75rem;
  }

  .profile-edit-label-row {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    margin-bottom: 0.5rem;
  }

  .profile-edit-label-ic {
    font-size: 1.15rem;
    color: #6b7280;
  }

  .profile-edit-label {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #6b7280;
  }

  .profile-edit-name-elevated {
    border-radius: 0.65rem;
    padding: 0.65rem 0.85rem;
    background: ${(p) => (p.$light ? "#ffffff" : "#1f1f23")};
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff14")};
    box-shadow: ${(p) =>
      p.$light
        ? "0 10px 26px rgba(26, 26, 46, 0.12), 0 4px 10px rgba(26, 26, 46, 0.08)"
        : "0 10px 28px rgba(0, 0, 0, 0.45), 0 4px 10px rgba(0, 0, 0, 0.25), 0 -2px 0 rgba(255, 255, 255, 0.04) inset"};
    transform: translateY(-3px);
  }

  .profile-edit-name-input {
    width: 100%;
    border: none;
    background: transparent;
    outline: none;
    font-size: 1rem;
    font-family: inherit;
    color: ${(p) => (p.$light ? "#18181b" : "#e8e8e8")};
    &::placeholder {
      color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff40")};
      font-style: italic;
    }
  }

  .profile-edit-name-actions {
    display: flex;
    justify-content: center;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .profile-edit-action {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    cursor: not-allowed;
    opacity: 0.28;
    transition: opacity 0.2s, transform 0.2s, filter 0.2s;
    &.confirm {
      background: #4b5563;
      color: white;
    }
    &.discard {
      background: ${(p) => (p.$light ? "#e5e7eb" : "#ffffff18")};
      color: ${(p) => (p.$light ? "#555" : "#d1d1d1")};
    }
    &:not(:disabled) {
      cursor: pointer;
      opacity: 0.5;
    }
    &:not(:disabled):hover {
      filter: brightness(1.08);
    }
    &.highlighted:not(:disabled) {
      opacity: 1;
      transform: scale(1.06);
    }
    &:disabled {
      pointer-events: none;
    }
  }

  .shared-toolbar {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.65rem 2.75rem 0.5rem 0.35rem;
    flex-shrink: 0;
    border-bottom: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
  }

  .shared-back {
    flex-shrink: 0;
    width: 2.25rem;
    height: 2.25rem;
    border: none;
    border-radius: 50%;
    background: ${(p) => (p.$light ? "#ffffff" : "#ffffff12")};
    color: ${(p) => (p.$light ? "#18181b" : "#e8e8e8")};
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.35rem;
    cursor: pointer;
    transition: background 0.15s;
    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff1a")};
    }
  }

  .shared-toolbar-title {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #6b7280;
  }

  .shared-tabs {
    position: relative;
    display: flex;
    flex-shrink: 0;
    padding: 0 0.25rem;
    border-bottom: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
  }

  .shared-tab {
    flex: 1;
    padding: 0.7rem 0.2rem 0.55rem;
    border: none;
    background: transparent;
    font-family: inherit;
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
    color: ${(p) => (p.$light ? "#6b7280" : "#999999")};
    transition: color 0.2s;
    &.active {
      color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
      font-weight: 600;
    }
  }

  .shared-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0.65rem 0.75rem 1rem;
    &::-webkit-scrollbar {
      width: 0.2rem;
    }
    &::-webkit-scrollbar-thumb {
      background: #ffffff30;
      border-radius: 1rem;
    }
  }

  .shared-empty {
    margin: 1.5rem 0 0;
    text-align: center;
    font-size: 0.85rem;
    color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff44")};
  }

  .shared-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .shared-list--media {
    gap: 0.85rem;
  }

  .shared-media-item {
    border-radius: 0.5rem;
    overflow: hidden;
    background: ${(p) => (p.$light ? "#ffffff" : "#ffffff08")};
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
  }

  .shared-thumb-link {
    display: block;
    line-height: 0;
  }

  .shared-thumb {
    width: 100%;
    max-height: 200px;
    object-fit: cover;
    display: block;
  }

  .shared-video {
    width: 100%;
    max-height: 200px;
    display: block;
    background: #000;
  }

  .shared-audio-wrap {
    padding: 0.5rem 0.65rem;
  }

  .shared-audio {
    width: 100%;
    height: 36px;
  }

  .shared-doc-row,
  .shared-link-row {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.55rem 0.65rem;
    border-radius: 0.45rem;
    background: ${(p) => (p.$light ? "#ffffff" : "#ffffff08")};
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
    text-decoration: none;
    color: ${(p) => (p.$light ? "#374151" : "#6b7280")};
    font-size: 0.82rem;
    word-break: break-all;
    transition: background 0.15s, border-color 0.15s;
    &:hover {
      border-color: #6b7280;
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff0f")};
    }
  }

  .shared-doc-ic,
  .shared-link-ic {
    flex-shrink: 0;
    font-size: 1.1rem;
    margin-top: 0.08rem;
  }

  .shared-doc-name {
    font-weight: 500;
    color: ${(p) => (p.$light ? "#18181b" : "#e8e8e8")};
  }

  .shared-link-url {
    color: #25d366;
    font-weight: 500;
  }

  .panel-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 2.65rem 0.9rem 0.75rem;
    &::-webkit-scrollbar {
      width: 0.2rem;
    }
    &::-webkit-scrollbar-thumb {
      background: #ffffff30;
      border-radius: 1rem;
    }
  }

  .avatar-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 1.35rem;
  }

  .avatar-ring {
    position: relative;
    width: 5.5rem;
    height: 5.5rem;
  }

  .avatar-display {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    overflow: hidden;
  }

  .profile-entry-edit-btn {
    position: absolute;
    left: 50%;
    bottom: -0.42rem;
    transform: translateX(-50%);
    z-index: 3;
    border: 1px solid #6b7280;
    background: ${(p) => (p.$light ? "#ffffff" : "rgba(23, 23, 23, 0.92)")};
    color: #6b7280;
    font-size: 0.72rem;
    font-weight: 600;
    padding: 0.22rem 0.85rem;
    border-radius: 2rem;
    cursor: pointer;
    font-family: inherit;
    box-shadow: 0 0 8px rgba(107, 114, 128, 0.4), 0 0 16px rgba(107, 114, 128, 0.14);
    transition: background 0.15s, color 0.15s, box-shadow 0.2s;
    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#252528f2")};
      box-shadow: 0 0 10px rgba(107, 114, 128, 0.5), 0 0 20px rgba(107, 114, 128, 0.2);
    }
  }

  .group-photo {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid ${(p) => (p.$light ? "#d1d5db" : "#6b728055")};
    display: block;
    pointer-events: none;
  }

  .group-photo-fallback {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #6b7280, #4b5563);
    color: white;
    font-size: 2.25rem;
    border: 2px solid ${(p) => (p.$light ? "#d1d5db" : "#6b728055")};
    pointer-events: none;
  }

  .edit-pencil-btn {
    position: absolute;
    right: -0.15rem;
    bottom: -0.15rem;
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 50%;
    border: 2px solid ${(p) => (p.$light ? "#ffffff" : "#252528")};
    background: #6b7280;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 0.95rem;
    z-index: 2;
    transition: filter 0.15s;
    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .action-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.85rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.55rem 0.75rem;
    border-radius: 0.55rem;
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff22")};
    background: ${(p) => (p.$light ? "#ffffff" : "#ffffff10")};
    color: ${(p) => (p.$light ? "#18181b" : "#e8e8e8")};
    font-size: 0.88rem;
    font-family: inherit;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s, border-color 0.15s;
    &:hover {
      border-color: #6b7280;
      background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff16")};
    }
    &.active {
      border-color: #6b7280;
      background: ${(p) => (p.$light ? "#f3f4f6" : "#6b728022")};
    }
  }

  .action-ic {
    font-size: 1.15rem;
    color: #6b7280;
    flex-shrink: 0;
  }

  .member-search-pill {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    width: 100%;
    margin: 0;
    padding: 0.45rem 0.75rem;
    border-radius: 2rem;
    border: 1px solid #6b7280;
    background: ${(p) => (p.$light ? "#ffffff" : "#ffffff10")};
    transition: border-color 0.15s, background 0.15s;
    box-sizing: border-box;
    &.is-input {
      background: ${(p) => (p.$light ? "#ffffff" : "#ffffff12")};
    }
    &:not(.is-input) {
      cursor: pointer;
      font-family: inherit;
      text-align: left;
      &:hover {
        background: ${(p) => (p.$light ? "#f3f4f6" : "#ffffff16")};
      }
    }
    .ms-icon {
      color: #6b7280;
      font-size: 1rem;
      flex-shrink: 0;
    }
  }

  .member-search-label {
    flex: 1;
    min-width: 0;
    font-size: 0.88rem;
    color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
  }

  .member-search-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    outline: none;
    font-size: 0.88rem;
    font-family: inherit;
    color: ${(p) => (p.$light ? "#18181b" : "white")};
    &::placeholder {
      color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff55")};
    }
    &::-webkit-search-cancel-button {
      filter: ${(p) => (p.$light ? "none" : "invert(1)")};
    }
  }

  .member-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .member-row {
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.45rem 0.15rem;
    border-radius: 0.45rem;
    &:hover {
      background: ${(p) => (p.$light ? "#00000006" : "#ffffff08")};
    }
  }

  .m-avatar img {
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    object-fit: cover;
  }

  .m-name {
    font-size: 0.88rem;
    color: ${(p) => (p.$light ? "#18181b" : "#e8e8e8")};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .media-section {
    flex-shrink: 0;
    width: 100%;
    padding: 0.85rem 0.9rem 1rem;
    border: none;
    border-top: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff15")};
    background: ${(p) => (p.$light ? "#f3f4f6" : "#18181b")};
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.15s;
    &:hover {
      background: ${(p) => (p.$light ? "#e4dcf5" : "#0a0828")};
    }
  }

  .media-title {
    margin: 0 0 0.45rem;
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #6b7280;
  }

  .media-hint {
    margin: 0;
    font-size: 0.8rem;
    color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff44")};
  }
`;
