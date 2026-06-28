import React, { useEffect, useState, useCallback } from "react";
import styled from "styled-components";
import axios from "axios";
import { IoAdd, IoRefreshOutline } from "react-icons/io5";
import { useChatAppearance } from "../context/ChatAppearanceContext";
import { getStatusesRoute } from "../utils/APIRoutes";
import StatusComposer from "./StatusComposer";
import StatusViewer from "./StatusViewer";

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : "1d ago";
}

export default function StatusPage({ currentUser, contacts = [] }) {
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerGroupIdx, setViewerGroupIdx] = useState(0);

  const fetchStatuses = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const { data } = await axios.post(getStatusesRoute, {
        userId: currentUser._id,
        contactIds: contacts.map((c) => c._id),
      });

      // Group statuses by userId
      const map = new Map();
      data.forEach((s) => {
        const uid = String(s.userId._id);
        if (!map.has(uid)) {
          map.set(uid, { user: s.userId, statuses: [] });
        }
        map.get(uid).statuses.push(s);
      });

      // Own statuses first, then contacts sorted by latest
      const grouped = Array.from(map.values()).sort((a, b) => {
        const aIsMe = String(a.user._id) === String(currentUser._id);
        const bIsMe = String(b.user._id) === String(currentUser._id);
        if (aIsMe) return -1;
        if (bIsMe) return 1;
        const aLatest = new Date(a.statuses.at(-1).createdAt);
        const bLatest = new Date(b.statuses.at(-1).createdAt);
        return bLatest - aLatest;
      });

      setGroups(grouped);
    } catch {
      /* silently fail */
    } finally {
      setLoading(false);
    }
  }, [currentUser, contacts]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const handlePosted = (newStatus) => {
    setGroups((prev) => {
      const uid = String(newStatus.userId._id);
      const existing = prev.find((g) => String(g.user._id) === uid);
      if (existing) {
        return prev.map((g) =>
          String(g.user._id) === uid
            ? { ...g, statuses: [...g.statuses, newStatus] }
            : g
        );
      }
      return [{ user: newStatus.userId, statuses: [newStatus] }, ...prev];
    });
  };

  const handleDeleted = (deletedId) => {
    setGroups((prev) =>
      prev
        .map((g) => ({ ...g, statuses: g.statuses.filter((s) => s._id !== deletedId) }))
        .filter((g) => g.statuses.length > 0)
    );
  };

  const openViewer = (groupIdx) => {
    setViewerGroupIdx(groupIdx);
    setViewerOpen(true);
  };

  const myGroup = groups.find((g) => String(g.user._id) === String(currentUser?._id));
  const contactGroups = groups.filter((g) => String(g.user._id) !== String(currentUser?._id));

  const hasUnread = (group) =>
    group.statuses.some(
      (s) => !s.viewers?.some((v) => String(v.userId) === String(currentUser?._id))
    );

  return (
    <Container $light={isLight}>
      <SectionTitle $light={isLight}>
        Status
        <RefreshBtn $light={isLight} onClick={fetchStatuses} title="Refresh">
          <IoRefreshOutline />
        </RefreshBtn>
      </SectionTitle>

      {/* ── My status ─────────────────────────────────────────────────── */}
      {currentUser && (
        <StatusRow
          $light={isLight}
          onClick={() =>
            myGroup ? openViewer(groups.findIndex((g) => String(g.user._id) === String(currentUser._id))) : setComposerOpen(true)
          }
        >
          <AvatarWrap $ring={!!myGroup} $unread={false}>
            <img
              src={`data:image/svg+xml;base64,${currentUser.avatarImage}`}
              alt="avatar"
            />
            {!myGroup && (
              <button
                className="add-btn"
                title="Add status"
                onClick={(e) => { e.stopPropagation(); setComposerOpen(true); }}
              >
                <IoAdd />
              </button>
            )}
          </AvatarWrap>
          <div className="info">
            <span className="name">{currentUser.username}</span>
            <span className="hint">
              {myGroup
                ? `${myGroup.statuses.length} update${myGroup.statuses.length > 1 ? "s" : ""} · ${relativeTime(myGroup.statuses.at(-1).createdAt)}`
                : "Click to add Status"}
            </span>
          </div>
          {myGroup && (
            <button
              className="add-more"
              title="Add another status"
              onClick={(e) => { e.stopPropagation(); setComposerOpen(true); }}
            >
              <IoAdd />
            </button>
          )}
        </StatusRow>
      )}

      <Divider />

      {/* ── Contacts' statuses ─────────────────────────────────────────── */}
      <ScrollArea>
        {loading ? (
          <EmptyState $light={isLight}><p>Loading statuses…</p></EmptyState>
        ) : contactGroups.length === 0 ? (
          <EmptyState $light={isLight}><p>No recent status updates from contacts</p></EmptyState>
        ) : (
          contactGroups.map((group, i) => {
            const globalIdx = groups.findIndex((g) => String(g.user._id) === String(group.user._id));
            const unread = hasUnread(group);
            return (
              <StatusRow key={group.user._id} $light={isLight} onClick={() => openViewer(globalIdx)}>
                <AvatarWrap $ring $unread={unread}>
                  <img
                    src={`data:image/svg+xml;base64,${group.user.avatarImage}`}
                    alt={group.user.username}
                  />
                </AvatarWrap>
                <div className="info">
                  <span className="name">{group.user.username}</span>
                  <span className="hint">
                    {relativeTime(group.statuses.at(-1).createdAt)}
                    {group.statuses.length > 1 ? ` · ${group.statuses.length} updates` : ""}
                  </span>
                </div>
              </StatusRow>
            );
          })
        )}
      </ScrollArea>

      {/* ── Composer modal ──────────────────────────────────────────────── */}
      {composerOpen && (
        <StatusComposer
          currentUser={currentUser}
          isLight={isLight}
          onClose={() => setComposerOpen(false)}
          onPosted={handlePosted}
        />
      )}

      {/* ── Viewer ─────────────────────────────────────────────────────── */}
      {viewerOpen && groups.length > 0 && (
        <StatusViewer
          groups={groups}
          initialGroupIdx={viewerGroupIdx}
          currentUser={currentUser}
          onClose={() => setViewerOpen(false)}
          onDeleted={handleDeleted}
        />
      )}
    </Container>
  );
}

/* ─── Styled ────────────────────────────────────────────────────────────── */

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};
  height: 100%;
  overflow: hidden;
`;

const SectionTitle = styled.div`
  padding: 1.1rem 1.2rem 0.6rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
  letter-spacing: 0.02em;
  border-bottom: 1px solid #ffffff0d;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const RefreshBtn = styled.button`
  background: none;
  border: none;
  color: ${(p) => (p.$light ? "#6b7280" : "#6b7280")};
  font-size: 1.1rem;
  cursor: pointer;
  padding: 0.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  &:hover { color: ${(p) => (p.$light ? "#374151" : "#fff")}; }
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.75rem 1.2rem;
  cursor: pointer;
  transition: background 0.18s;
  flex-shrink: 0;
  position: relative;
  &:hover { background: ${(p) => (p.$light ? "#00000008" : "#ffffff0a")}; }

  .info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .name {
    color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
    font-size: 0.93rem;
    font-weight: 600;
  }
  .hint {
    color: #6b7280;
    font-size: 0.77rem;
  }
  .add-more {
    background: #374151;
    border: none;
    color: #d1d5db;
    width: 1.8rem;
    height: 1.8rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    cursor: pointer;
    &:hover { background: #4b5563; }
  }
`;

const AvatarWrap = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;

  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: block;
    border: 2.5px solid ${(p) =>
      p.$ring ? (p.$unread ? "#22c55e" : "#6b7280") : "#6b7280"};
    padding: ${(p) => (p.$ring ? "2px" : "0")};
    box-sizing: border-box;
  }

  .add-btn {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 1.2rem;
    height: 1.2rem;
    border-radius: 50%;
    background: #4b5563;
    border: 2px solid #0a0a0c;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    cursor: pointer;
    padding: 0;
    transition: background 0.15s, transform 0.15s;
    &:hover { background: #6b7280; transform: scale(1.15); }
  }
`;

const Divider = styled.div`
  height: 6px;
  background: #ffffff06;
  flex-shrink: 0;
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  p {
    color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff22")};
    font-size: 0.83rem;
    font-style: italic;
    text-align: center;
  }
`;
