import React, { useState, useEffect, useRef, useCallback } from "react";
import styled, { keyframes } from "styled-components";
import axios from "axios";
import {
  IoClose, IoChevronBack, IoChevronForward, IoTrashOutline,
  IoEyeOutline,
} from "react-icons/io5";
import { viewStatusRoute, deleteStatusRoute } from "../utils/APIRoutes";

const PHOTO_DURATION = 5000;
const TEXT_DURATION = 6000;
const VIDEO_MAX_DURATION = 30000;

export default function StatusViewer({ groups, initialGroupIdx = 0, currentUser, onClose, onDeleted }) {
  const [groupIdx, setGroupIdx] = useState(initialGroupIdx);
  const [statusIdx, setStatusIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);

  const timerRef = useRef();
  const startTimeRef = useRef();
  const elapsedRef = useRef(0);
  const videoRef = useRef();

  const group = groups[groupIdx];
  const status = group?.statuses[statusIdx];
  const isOwn = status && String(status.userId._id) === String(currentUser._id);
  const duration = status?.type === "text" ? TEXT_DURATION : PHOTO_DURATION;

  // Mark as viewed when status changes
  useEffect(() => {
    if (!status) return;
    if (isOwn) return;
    axios.post(viewStatusRoute, {
      statusId: status._id,
      viewerId: currentUser._id,
    }).catch(() => {});
  }, [status, isOwn, currentUser._id]);

  // Progress timer
  const startTimer = useCallback((from = 0) => {
    clearInterval(timerRef.current);
    elapsedRef.current = from;
    startTimeRef.current = Date.now() - from;

    // For videos let the video element drive timing
    if (status?.type === "video") return;

    timerRef.current = setInterval(() => {
      if (paused) return;
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setProgress(pct);
      if (elapsed >= duration) advance();
    }, 40);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, paused, duration]);

  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    startTimer(0);
    return () => clearInterval(timerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIdx, statusIdx]);

  const advance = useCallback(() => {
    if (!group) return;
    if (statusIdx < group.statuses.length - 1) {
      setStatusIdx((i) => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx((i) => i + 1);
      setStatusIdx(0);
    } else {
      onClose();
    }
  }, [group, groupIdx, groups.length, statusIdx, onClose]);

  const retreat = () => {
    if (statusIdx > 0) {
      setStatusIdx((i) => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx((i) => i - 1);
      setStatusIdx(groups[groupIdx - 1].statuses.length - 1);
    }
  };

  // Video ended → advance
  const handleVideoEnd = () => advance();
  // Video plays → update progress bar
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration: dur } = videoRef.current;
    if (dur) setProgress((currentTime / dur) * 100);
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this status?")) return;
    try {
      await axios.delete(deleteStatusRoute(status._id), { data: { userId: currentUser._id } });
      onDeleted(status._id);
      // advance or close
      if (group.statuses.length > 1) {
        if (statusIdx < group.statuses.length - 1) {
          setStatusIdx((i) => i + 1);
        } else {
          setStatusIdx((i) => i - 1);
        }
      } else if (groupIdx < groups.length - 1) {
        setGroupIdx((i) => i + 1);
        setStatusIdx(0);
      } else {
        onClose();
      }
    } catch {
      /* ignore */
    }
  };

  if (!group || !status) return null;

  return (
    <Overlay
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
    >
      {/* Progress bars */}
      <ProgressRow>
        {group.statuses.map((_, i) => (
          <ProgressBar key={i}>
            <ProgressFill
              $pct={i < statusIdx ? 100 : i === statusIdx ? progress : 0}
            />
          </ProgressBar>
        ))}
      </ProgressRow>

      {/* Header */}
      <Header>
        <UserInfo>
          <img
            src={`data:image/svg+xml;base64,${group.user.avatarImage}`}
            alt={group.user.username}
          />
          <span className="name">{group.user.username}</span>
          <span className="time">{relativeTime(status.createdAt)}</span>
        </UserInfo>
        <HeaderActions>
          {isOwn && (
            <>
              <ActionBtn onClick={() => setShowViewers((v) => !v)} title="View viewers">
                <IoEyeOutline />
                <span>{status.viewers?.length || 0}</span>
              </ActionBtn>
              <ActionBtn onClick={handleDelete} title="Delete status" $danger>
                <IoTrashOutline />
              </ActionBtn>
            </>
          )}
          <ActionBtn onClick={onClose} title="Close">
            <IoClose />
          </ActionBtn>
        </HeaderActions>
      </Header>

      {/* Nav zones */}
      <NavZone $side="left" onClick={(e) => { e.stopPropagation(); retreat(); }} />
      <NavZone $side="right" onClick={(e) => { e.stopPropagation(); advance(); }} />

      {/* Status content */}
      <Content>
        {status.type === "text" && (
          <TextStatus style={{ background: status.bgColor }}>
            <p>{status.content}</p>
          </TextStatus>
        )}
        {status.type === "image" && (
          <img src={status.content} alt="status" className="media" />
        )}
        {status.type === "video" && (
          <video
            ref={videoRef}
            src={status.content}
            autoPlay
            playsInline
            className="media"
            onEnded={handleVideoEnd}
            onTimeUpdate={handleVideoTimeUpdate}
          />
        )}
        {status.caption && <Caption>{status.caption}</Caption>}
      </Content>

      {/* Nav arrow hints */}
      {(statusIdx > 0 || groupIdx > 0) && (
        <NavHint $side="left" onClick={(e) => { e.stopPropagation(); retreat(); }}>
          <IoChevronBack />
        </NavHint>
      )}
      {(statusIdx < group.statuses.length - 1 || groupIdx < groups.length - 1) && (
        <NavHint $side="right" onClick={(e) => { e.stopPropagation(); advance(); }}>
          <IoChevronForward />
        </NavHint>
      )}

      {/* Viewers panel (own status) */}
      {isOwn && showViewers && (
        <ViewersList>
          <div className="title"><IoEyeOutline /> Seen by {status.viewers?.length || 0}</div>
          {(status.viewers || []).length === 0 ? (
            <p className="empty">No views yet</p>
          ) : (
            status.viewers.map((v) => (
              <div key={v.userId} className="viewer-row">
                <span className="id">{v.userId}</span>
                <span className="time">{relativeTime(v.viewedAt)}</span>
              </div>
            ))
          )}
        </ViewersList>
      )}
    </Overlay>
  );
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return "1d ago";
}

/* ─── Styled ────────────────────────────────────────────────────────────── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9100;
  background: #000;
  display: flex;
  flex-direction: column;
  user-select: none;
`;

const ProgressRow = styled.div`
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  right: 0.75rem;
  display: flex;
  gap: 0.25rem;
  z-index: 10;
`;

const ProgressBar = styled.div`
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.35);
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressFill = styled.div`
  height: 100%;
  width: ${(p) => p.$pct}%;
  background: #fff;
  border-radius: 2px;
  transition: width 0.04s linear;
`;

const Header = styled.div`
  position: absolute;
  top: 1.4rem;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  z-index: 10;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  img {
    width: 2.2rem;
    height: 2.2rem;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.6);
  }
  .name { color: #fff; font-weight: 600; font-size: 0.88rem; }
  .time { color: rgba(255,255,255,0.6); font-size: 0.75rem; }
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const ActionBtn = styled.button`
  background: rgba(0,0,0,0.4);
  border: none;
  color: ${(p) => (p.$danger ? "#f87171" : "#fff")};
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  font-size: 1rem;
  cursor: pointer;
  span { font-size: 0.75rem; }
  &:hover { background: rgba(0,0,0,0.65); }
`;

const NavZone = styled.div`
  position: absolute;
  top: 0;
  bottom: 0;
  width: 35%;
  z-index: 5;
  ${(p) => (p.$side === "left" ? "left: 0;" : "right: 0;")}
  cursor: pointer;
`;

const Content = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;

  .media {
    max-width: 100%;
    max-height: 100vh;
    object-fit: contain;
  }
`;

const TextStatus = styled.div`
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  p {
    color: #fff;
    font-size: clamp(1.2rem, 4vw, 2rem);
    text-align: center;
    line-height: 1.5;
    word-break: break-word;
  }
`;

const Caption = styled.div`
  position: absolute;
  bottom: 3.5rem;
  left: 0;
  right: 0;
  text-align: center;
  color: #fff;
  font-size: 0.9rem;
  padding: 0.5rem 2rem;
  text-shadow: 0 1px 4px rgba(0,0,0,0.8);
`;

const NavHint = styled.button`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${(p) => (p.$side === "left" ? "left: 0.75rem;" : "right: 0.75rem;")}
  z-index: 9;
  background: rgba(0,0,0,0.3);
  border: none;
  color: rgba(255,255,255,0.7);
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  cursor: pointer;
  pointer-events: all;
  &:hover { background: rgba(0,0,0,0.55); color: #fff; }
`;

const ViewersList = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.85);
  padding: 1rem 1.2rem;
  z-index: 20;
  max-height: 40vh;
  overflow-y: auto;

  .title {
    color: #fff;
    font-size: 0.88rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.6rem;
  }
  .empty {
    color: #9ca3af;
    font-size: 0.8rem;
    margin: 0;
  }
  .viewer-row {
    display: flex;
    justify-content: space-between;
    padding: 0.3rem 0;
    border-bottom: 1px solid #ffffff0d;
    .id { color: #d1d5db; font-size: 0.8rem; }
    .time { color: #6b7280; font-size: 0.75rem; }
  }
`;
