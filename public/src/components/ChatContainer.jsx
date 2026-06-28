import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { useChatAppearance } from "../context/ChatAppearanceContext";
import styled, { keyframes } from "styled-components";
import ChatInput from "./ChatInput";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import {
  sendMessageRoute, recieveMessageRoute, sendFileMessageRoute,
  deleteMessageRoute, editMessageRoute, pinMessageRoute,
  reactMessageRoute, forwardMessageRoute,
  clearChatRoute, deleteChatRoute, blockUserRoute, checkBlockRoute,
} from "../utils/APIRoutes";
import { AiOutlineFile } from "react-icons/ai";
import { BsMicFill, BsThreeDotsVertical, BsCheckSquare, BsTelephoneFill, BsCameraVideoFill } from "react-icons/bs";
import { MdEdit, MdDelete, MdPushPin, MdOutlineBlock, MdOutlineDeleteSweep, MdDeleteForever, MdGroups, MdPersonAdd, MdNoAccounts } from "react-icons/md";
import { IoSearchOutline, IoCloseCircle, IoClose, IoChevronDown } from "react-icons/io5";
import { FaReply, FaCopy, FaSmile, FaShare } from "react-icons/fa";

const EDIT_WINDOW_MS = 5 * 60 * 1000;
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];
const SCROLL_BOTTOM_THRESHOLD_PX = 100;

export default function ChatContainer({
  currentChat, socket, arrivalMsg, initialUnreadCount, onMessageSent, contacts = [], onDeleteChat,
  onRequestAddMembers,
  onToggleGroupInfoPanel,
  chatRefreshKey = 0,
  blockRefreshKey = 0,
  onBlockStatusChange,
  onStartVoiceCall,
  onStartVideoCall,
  callDisabled = false,
}) {
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef();
  const chatMessagesRef = useRef(null);
  const currentUser = useRef(JSON.parse(localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)));

  // unread divider
  const [unreadDividerIdx, setUnreadDividerIdx] = useState(-1);
  const dividerSetRef = useRef(false);

  // in-chat search
  const [searchQuery, setSearchQuery] = useState("");

  // context menu
  const [ctxMenu, setCtxMenu] = useState(null); // { x, y, message }
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const ctxMenuRef = useRef(null);

  // inline edit
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const editInputRef = useRef(null);

  // reply
  const [replyingTo, setReplyingTo] = useState(null);

  // forward modal
  const [forwardMsg, setForwardMsg] = useState(null);

  // kebab menu (three-dot)
  const [showKebab, setShowKebab] = useState(false);
  const kebabRef = useRef(null);

  // select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());

  // block state
  const [isBlocked, setIsBlocked] = useState(false);

  const { themeMode, getChatMessagesBackground } = useChatAppearance();
  const isLight = themeMode === "light";
  const isGroup = !!currentChat?.isGroup;

  const senderLabel = useCallback(
    (msg) => {
      if (msg.fromSelf) return "You";
      if (isGroup) {
        const p = currentChat.memberProfiles?.find((m) => m._id === msg.senderId);
        return p?.username || "Member";
      }
      return currentChat.username;
    },
    [currentChat, isGroup]
  );

  // clamp context menu inside viewport (fires before paint → no flicker)
  useLayoutEffect(() => {
    if (!ctxMenu || !ctxMenuRef.current) return;
    const rect = ctxMenuRef.current.getBoundingClientRect();
    const margin = 8;
    let { x, y } = ctxMenu;

    if (rect.bottom > window.innerHeight - margin)
      y = Math.max(margin, window.innerHeight - rect.height - margin);
    if (rect.top < margin)
      y = margin;
    if (ctxMenu.fromSelf && rect.left < margin)
      x = margin + rect.width;
    if (!ctxMenu.fromSelf && rect.right > window.innerWidth - margin)
      x = window.innerWidth - rect.width - margin;

    if (y !== ctxMenu.y || x !== ctxMenu.x)
      setCtxMenu((prev) => ({ ...prev, x, y }));
  }, [ctxMenu]);

  // close kebab on outside click
  useEffect(() => {
    const handler = (e) => { if (kebabRef.current && !kebabRef.current.contains(e.target)) setShowKebab(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // check block status whenever chat changes
  useEffect(() => {
    if (!currentChat) return;
    setSelectMode(false);
    setSelectedMessages(new Set());
    if (currentChat.isGroup) {
      setIsBlocked(false);
      return;
    }
    axios.post(checkBlockRoute, {
      blockerId: currentUser.current._id,
      blockedId: currentChat._id,
    }).then(({ data }) => setIsBlocked(data.blocked)).catch(() => {});
  }, [currentChat, blockRefreshKey]);

  // ── Derived ───────────────────────────────────────────────────────────────
  useEffect(() => { setSearchQuery(""); setReplyingTo(null); }, [currentChat]);

  const filteredMessages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    return messages.filter((m) => !m.fileUrl && !m.deleted && m.message?.toLowerCase().includes(q));
  }, [searchQuery, messages]);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.pinned && !m.deleted), [messages]);

  /** When true, new messages / resize will keep the view pinned to the bottom */
  const allowAutoScrollRef = useRef(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);

  const syncScrollStateFromDom = useCallback(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom <= SCROLL_BOTTOM_THRESHOLD_PX;
    allowAutoScrollRef.current = nearBottom;
    const canScroll = el.scrollHeight > el.clientHeight + 1;
    setShowJumpToBottom(canScroll && !nearBottom);
  }, []);

  const scrollToBottomInstant = useCallback(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    allowAutoScrollRef.current = true;
    setShowJumpToBottom(false);
  }, []);

  const handleJumpToLatest = useCallback(() => {
    scrollToBottomInstant();
  }, [scrollToBottomInstant]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(async () => {
    allowAutoScrollRef.current = true;
    dividerSetRef.current = false;
    setUnreadDividerIdx(-1);
    const data = currentUser.current;
    const response = currentChat.isGroup
      ? await axios.post(recieveMessageRoute, { from: data._id, groupId: currentChat._id })
      : await axios.post(recieveMessageRoute, { from: data._id, to: currentChat._id });
    const fetched = response.data;
    setMessages(fetched);

    if (initialUnreadCount > 0 && !dividerSetRef.current) {
      let count = 0, divIdx = -1;
      for (let i = fetched.length - 1; i >= 0; i--) {
        if (!fetched[i].fromSelf) { count++; if (count === initialUnreadCount) { divIdx = i; break; } }
      }
      setUnreadDividerIdx(divIdx);
      dividerSetRef.current = true;
    }
  }, [currentChat, chatRefreshKey]);

  // ── Send text ─────────────────────────────────────────────────────────────
  const handleSendMsg = async (msg, replyTo = null) => {
    const data = currentUser.current;
    const sentAt = new Date().toISOString();
    if (currentChat.isGroup) {
      const response = await axios.post(sendMessageRoute, {
        from: data._id,
        groupId: currentChat._id,
        message: msg,
        replyTo: replyTo || undefined,
      });
      const messageId = response.data.messageId || uuidv4();
    socket.current.emit("send-msg", {
        memberIds: currentChat.members,
      from: data._id,
      msg,
        messageId,
        groupId: currentChat._id,
      });
      setMessages((prev) => [
        ...prev,
        { _id: messageId, fromSelf: true, senderId: data._id, message: msg, createdAt: sentAt, replyTo: replyTo || {} },
      ]);
    } else {
      const response = await axios.post(sendMessageRoute, {
        from: data._id, to: currentChat._id, message: msg,
        replyTo: replyTo || undefined,
      });
      const messageId = response.data.messageId || uuidv4();
      socket.current.emit("send-msg", { to: currentChat._id, from: data._id, msg, messageId, replyTo });
      setMessages((prev) => [...prev, { _id: messageId, fromSelf: true, senderId: data._id, message: msg, createdAt: sentAt, replyTo: replyTo || {} }]);
    }
    onMessageSent?.({ text: msg, fileType: "", fileName: "" });
    setReplyingTo(null);
  };

  // ── Send file ─────────────────────────────────────────────────────────────
  const handleSendFile = async (file, caption = "") => {
    const data = currentUser.current;
    const form = new FormData();
    form.append("file", file);
    form.append("from", data._id);
    if (caption) form.append("caption", caption);
    if (currentChat.isGroup) form.append("groupId", currentChat._id);
    else form.append("to", currentChat._id);
    try {
      const res = await axios.post(sendFileMessageRoute, form, { headers: { "Content-Type": "multipart/form-data" } });
      const { fileUrl, fileType, fileName, messageId, message: captionText } = res.data;
      const mid = messageId || uuidv4();
      const text = captionText != null ? captionText : caption;
      if (currentChat.isGroup) {
        socket.current.emit("send-file-msg", {
          memberIds: currentChat.members,
      from: data._id,
          groupId: currentChat._id,
          fileMsg: { fileUrl, fileType, fileName, messageId: mid, message: text },
        });
      } else {
        socket.current.emit("send-file-msg", {
      to: currentChat._id,
          from: data._id,
          fileMsg: { fileUrl, fileType, fileName, messageId: mid, message: text },
        });
      }
      setMessages((prev) => [
        ...prev,
        {
          _id: mid,
          fromSelf: true,
          senderId: data._id,
          message: text,
          fileUrl,
          fileType,
          fileName,
          createdAt: new Date().toISOString(),
        },
      ]);
      onMessageSent?.({ text: text || "", fileType, fileName });
      setReplyingTo(null);
    } catch (err) { console.error("File upload failed:", err); }
  };

  // ── Socket listeners ──────────────────────────────────────────────────────
  useEffect(() => { if (arrivalMsg) setMessages((prev) => [...prev, arrivalMsg]); }, [arrivalMsg]);

  useEffect(() => {
    if (!socket.current) return;
    socket.current.on("msg-deleted", ({ messageId }) =>
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, deleted: true } : m)));
    socket.current.on("msg-edited", ({ messageId, text }) =>
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, message: text, edited: true } : m)));
    socket.current.on("msg-reacted", ({ messageId, reactions }) =>
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, reactions } : m)));
    socket.current.on("msg-pinned", ({ messageId, pinned }) =>
      setMessages((prev) => prev.map((m) => m._id === messageId ? { ...m, pinned } : m)));
  }, []);

  // Scroll after message updates only if the user was already at the bottom
  useLayoutEffect(() => {
    if (allowAutoScrollRef.current) scrollToBottomInstant();
  }, [messages, scrollToBottomInstant]);

  // Re-scroll on content height change only while pinned to bottom (e.g. images loading)
  useEffect(() => {
    const el = chatMessagesRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (allowAutoScrollRef.current) scrollToBottomInstant();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollToBottomInstant]);

  // ── Context menu ──────────────────────────────────────────────────────────
  const handleContextMenu = useCallback((e, message) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, message, fromSelf: message.fromSelf });
    setShowEmojiPicker(false);
  }, []);

  useEffect(() => {
    const close = () => { setCtxMenu(null); setShowEmojiPicker(false); };
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    return () => { document.removeEventListener("click", close); document.removeEventListener("scroll", close, true); };
  }, []);

  const canEdit = (m) => m.fromSelf && !m.fileUrl && !m.deleted && (Date.now() - new Date(m.createdAt).getTime()) <= EDIT_WINDOW_MS;

  // ── Actions ───────────────────────────────────────────────────────────────
  const emitDeleteMsg = (messageId) => {
    if (currentChat.isGroup) {
      socket.current.emit("delete-msg", {
        memberIds: currentChat.members,
        from: currentUser.current._id,
        messageId,
        groupId: currentChat._id,
      });
    } else {
      socket.current.emit("delete-msg", { to: currentChat._id, from: currentUser.current._id, messageId });
    }
  };

  const handleDelete = async (msg) => {
    setCtxMenu(null);
    await axios.patch(deleteMessageRoute(msg._id));
    setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, deleted: true } : m));
    emitDeleteMsg(msg._id);
  };

  const startEdit = (msg) => {
    setCtxMenu(null);
    setEditingId(msg._id); setEditText(msg.message);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const saveEdit = async (msg) => {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === msg.message) { setEditingId(null); return; }
    await axios.patch(editMessageRoute(msg._id), { text: trimmed });
    setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, message: trimmed, edited: true } : m));
    if (currentChat.isGroup) {
      socket.current.emit("edit-msg", {
        memberIds: currentChat.members,
        from: currentUser.current._id,
        messageId: msg._id,
        text: trimmed,
        groupId: currentChat._id,
      });
    } else {
      socket.current.emit("edit-msg", { to: currentChat._id, from: currentUser.current._id, messageId: msg._id, text: trimmed });
    }
    setEditingId(null);
  };

  const handleCopy = (msg) => {
    setCtxMenu(null);
    navigator.clipboard.writeText(msg.message).catch(() => {});
  };

  const handleReply = (msg) => {
    setCtxMenu(null);
    setReplyingTo({
      messageId: msg._id,
      text: msg.message,
      fileType: msg.fileType || "",
      fileName: msg.fileName || "",
      senderName: senderLabel(msg),
    });
  };

  const handleReact = (e) => {
    e.stopPropagation();
    setShowEmojiPicker((prev) => !prev);
  };

  const applyReaction = async (msg, emoji) => {
    setCtxMenu(null);
    setShowEmojiPicker(false);
    const { data } = await axios.patch(reactMessageRoute(msg._id), { emoji, userId: currentUser.current._id });
    setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, reactions: data.reactions } : m));
    if (currentChat.isGroup) {
      socket.current.emit("react-msg", {
        memberIds: currentChat.members,
        from: currentUser.current._id,
        messageId: msg._id,
        reactions: data.reactions,
        groupId: currentChat._id,
      });
    } else {
      socket.current.emit("react-msg", { to: currentChat._id, from: currentUser.current._id, messageId: msg._id, reactions: data.reactions });
    }
  };

  const handlePin = async (msg) => {
    setCtxMenu(null);
    const isCurrentlyPinned = msg.pinned;

    // If pinning a new message, unpin any existing pinned messages first
    if (!isCurrentlyPinned) {
      const alreadyPinned = messages.filter((m) => m.pinned && m._id !== msg._id);
      await Promise.all(alreadyPinned.map((m) => axios.patch(pinMessageRoute(m._id))));
      setMessages((prev) =>
        prev.map((m) => alreadyPinned.find((p) => p._id === m._id) ? { ...m, pinned: false } : m)
      );
      alreadyPinned.forEach((m) => {
        if (currentChat.isGroup) {
          socket.current.emit("pin-msg", {
            memberIds: currentChat.members,
            from: currentUser.current._id,
            messageId: m._id,
            pinned: false,
            groupId: currentChat._id,
          });
        } else {
          socket.current.emit("pin-msg", { to: currentChat._id, from: currentUser.current._id, messageId: m._id, pinned: false });
        }
      });
    }

    const { data } = await axios.patch(pinMessageRoute(msg._id));
    setMessages((prev) => prev.map((m) => m._id === msg._id ? { ...m, pinned: data.pinned } : m));
    if (currentChat.isGroup) {
      socket.current.emit("pin-msg", {
        memberIds: currentChat.members,
        from: currentUser.current._id,
        messageId: msg._id,
        pinned: data.pinned,
        groupId: currentChat._id,
      });
    } else {
      socket.current.emit("pin-msg", { to: currentChat._id, from: currentUser.current._id, messageId: msg._id, pinned: data.pinned });
    }
  };

  const handleForward = (msg) => { setCtxMenu(null); setForwardMsg(msg); };

  // ── Kebab menu actions ─────────────────────────────────────────────────────
  const handleToggleSelectMode = () => { setShowKebab(false); setSelectMode((v) => !v); setSelectedMessages(new Set()); };

  const toggleMessageSelect = (id) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedMessages.size === 0) return;
    if (!window.confirm(`Delete ${selectedMessages.size} message${selectedMessages.size !== 1 ? "s" : ""}?`)) return;
    const ids = [...selectedMessages];
    await Promise.all(ids.map((id) => axios.patch(deleteMessageRoute(id))));
    setMessages((prev) => prev.map((m) => ids.includes(m._id) ? { ...m, deleted: true } : m));
    ids.forEach((id) => emitDeleteMsg(id));
    setSelectMode(false);
    setSelectedMessages(new Set());
  };

  const handleForwardSelected = () => {
    if (selectedMessages.size === 0) return;
    // Collect selected message objects and open a special forward flow
    const selected = messages.filter((m) => selectedMessages.has(m._id));
    setForwardMsg({ multi: true, messages: selected });
    setSelectMode(false);
    setSelectedMessages(new Set());
  };

  const handleToggleBlock = async () => {
    setShowKebab(false);
    if (currentChat.isGroup) return;
    try {
      const { data } = await axios.post(blockUserRoute, {
        blockerId: currentUser.current._id,
        blockedId: currentChat._id,
      });
      setIsBlocked(!!data.blocked);
      onBlockStatusChange?.(currentChat._id, !!data.blocked);
    } catch (e) {
      alert(e.response?.data?.msg || "Could not update block status");
    }
  };

  const handleClearChat = async () => {
    setShowKebab(false);
    if (!window.confirm(`Clear all messages with ${currentChat.username}? This cannot be undone.`)) return;
    await axios.post(clearChatRoute, { from: currentUser.current._id, to: currentChat._id });
    setMessages([]);
  };

  const handleDeleteChat = async () => {
    setShowKebab(false);
    if (!window.confirm(`Delete chat with ${currentChat.username}? All messages will be permanently removed.`)) return;
    await axios.post(deleteChatRoute, {
      from: String(currentUser.current._id),
      to: String(currentChat._id),
    });
    if (onDeleteChat) onDeleteChat();
  };

  const sendForward = async (contact) => {
    const data = currentUser.current;
    if (forwardMsg.multi) {
      // Forward each selected message in order
      for (const msg of forwardMsg.messages) {
        const res = await axios.post(forwardMessageRoute, {
          from: data._id, to: contact._id,
          text: msg.message || "",
          fileUrl: msg.fileUrl || "",
          fileType: msg.fileType || "",
          fileName: msg.fileName || "",
        });
        socket.current.emit("send-msg", { to: contact._id, from: data._id, msg: msg.message || `[${msg.fileType}]`, messageId: res.data.messageId });
      }
    } else {
      const res = await axios.post(forwardMessageRoute, {
        from: data._id, to: contact._id,
        text: forwardMsg.message || "",
        fileUrl: forwardMsg.fileUrl || "",
        fileType: forwardMsg.fileType || "",
        fileName: forwardMsg.fileName || "",
      });
      socket.current.emit("send-msg", { to: contact._id, from: data._id, msg: forwardMsg.message || `[${forwardMsg.fileType}]`, messageId: res.data.messageId });
    }
    setForwardMsg(null);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderReplyQuote = (replyTo) => {
    if (!replyTo?.messageId) return null;
    return (
      <div className="reply-quote">
        <span className="reply-sender">{replyTo.senderName}</span>
        <span className="reply-text">
          {replyTo.text || (replyTo.fileType ? `[${replyTo.fileType}]` : "")}
        </span>
      </div>
    );
  };

  const renderReactions = (msg) => {
    if (!msg.reactions?.length) return null;
    return (
      <div className="reactions">
        {msg.reactions.map((r) => (
          <button key={r.emoji} className={`reaction-pill ${r.userIds.includes(currentUser.current._id) ? "mine" : ""}`}
            onClick={(e) => { e.stopPropagation(); applyReaction(msg, r.emoji); }}>
            {r.emoji} <span>{r.userIds.length}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderContent = (message) => {
    if (message.deleted) return <p className="deleted-msg">This message has been deleted</p>;

    if (editingId === message._id) {
      return (
        <div className="edit-box">
          <input ref={editInputRef} value={editText} onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") saveEdit(message); if (e.key === "Escape") setEditingId(null); }} />
          <div className="edit-actions">
            <button className="save" onClick={() => saveEdit(message)}>Save</button>
            <button className="cancel" onClick={() => setEditingId(null)}>Cancel</button>
          </div>
        </div>
      );
    }

    return (
      <>
        {renderReplyQuote(message.replyTo)}
        {message.fileUrl ? (
          <>
            {message.fileType === "image" ? (
              <a href={message.fileUrl} target="_blank" rel="noreferrer">
                <img src={message.fileUrl} alt={message.fileName} className="msg-image" />
              </a>
            ) : message.fileType === "video" ? (
              <video controls className="msg-video"><source src={message.fileUrl} /></video>
            ) : message.fileType === "audio" ? (
              <div className="msg-audio"><BsMicFill /><audio controls src={message.fileUrl} /></div>
            ) : (
              <a href={message.fileUrl} target="_blank" rel="noreferrer" className="msg-file">
                <AiOutlineFile /><span>{message.fileName}</span>
              </a>
            )}
            {message.message?.trim() ? <p className="file-caption">{message.message}</p> : null}
          </>
        ) : (
          <p>{message.message}</p>
        )}
        {message.edited && <span className="edited-label">edited</span>}
      </>
    );
  };

  const renderHighlighted = (message, q) => {
    const text = message.message || "";
    const parts = text.split(new RegExp(`(${q})`, "gi"));
    return <p>{parts.map((p, i) => p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : p)}</p>;
  };

  const renderGroupSenderAvatar = (message, inSearch) => {
    if (!currentChat.isGroup || message.fromSelf || inSearch) return null;
    const sid = message.senderId;
    const profile = currentChat.memberProfiles?.find((m) => String(m._id) === String(sid));
    const img = profile?.avatarImage;
    const initial = profile?.username?.charAt(0)?.toUpperCase() || "?";
    return (
      <div className="msg-sender-avatar" title={profile?.username || "Member"}>
        {img ? (
          <img src={`data:image/svg+xml;base64,${img}`} alt="" />
        ) : (
          <span className="msg-sender-placeholder">{initial}</span>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Container $light={isLight} $chatBg={getChatMessagesBackground()}>
      {/* Header */}
      <div className="chat-header">
        <div className="user-details">
          <div className="avatar">
            {currentChat.isGroup ? (
              currentChat.avatarImage ? (
                <img
                  src={
                    String(currentChat.avatarImage).startsWith("data:")
                      ? currentChat.avatarImage
                      : `data:image/svg+xml;base64,${currentChat.avatarImage}`
                  }
              alt=""
                  className="group-header-photo"
                />
              ) : (
                <span className="group-header-avatar" aria-hidden>
                  <MdGroups />
                </span>
              )
            ) : currentChat.deleted ? (
              <span className="deleted-user-header-avatar" aria-label="Deleted user">
                <MdNoAccounts />
              </span>
            ) : (
              <img src={`data:image/svg+xml;base64,${currentChat.avatarImage}`} alt="" />
            )}
          </div>
          <div className="username">
            {currentChat.isGroup && onToggleGroupInfoPanel ? (
              <button type="button" className="group-title-btn" onClick={onToggleGroupInfoPanel}>
                <h3>{currentChat.username}</h3>
                <p className="group-sub">{currentChat.members?.length || 0} members</p>
              </button>
            ) : (
              <>
            <h3>{currentChat.username}</h3>
                {currentChat.isGroup && (
                  <p className="group-sub">{currentChat.members?.length || 0} members</p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="header-search">
          <IoSearchOutline className="search-icon" />
          <input placeholder="Search in chat…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          {searchQuery && <IoCloseCircle className="clear-icon" onClick={() => setSearchQuery("")} />}
          {searchQuery && <span className="match-count">{filteredMessages.length} result{filteredMessages.length !== 1 ? "s" : ""}</span>}
        </div>

        {!currentChat.isGroup && onStartVoiceCall && onStartVideoCall && (
          <div className="call-actions">
            <button
              type="button"
              className="call-btn"
              title="Voice call"
              disabled={callDisabled || isBlocked}
              onClick={() => onStartVoiceCall(currentChat)}
            >
              <BsTelephoneFill />
            </button>
            <button
              type="button"
              className="call-btn"
              title="Video call"
              disabled={callDisabled || isBlocked}
              onClick={() => onStartVideoCall(currentChat)}
            >
              <BsCameraVideoFill />
            </button>
          </div>
        )}

        {/* Three-dot kebab */}
        <div className="kebab-wrap" ref={kebabRef}>
          <button className="kebab-btn" title="More options" onClick={() => setShowKebab((v) => !v)}>
            <BsThreeDotsVertical />
          </button>
          {showKebab && (
            <KebabMenu>
              <button className="km-item" onClick={handleToggleSelectMode}>
                <BsCheckSquare /> Select messages
              </button>
              {currentChat.isGroup && onRequestAddMembers && (
                <>
                  <div className="km-divider" />
                  <button
                    type="button"
                    className="km-item"
                    onClick={() => {
                      setShowKebab(false);
                      onRequestAddMembers();
                    }}
                  >
                    <MdPersonAdd /> Add member(s)
                  </button>
                </>
              )}
              {!currentChat.isGroup && (
                <>
                  <div className="km-divider" />
                  <button className={`km-item${isBlocked ? " active-block" : ""}`} onClick={handleToggleBlock}>
                    <MdOutlineBlock /> {isBlocked ? "Unblock" : "Block"}
                  </button>
                  <button className="km-item" onClick={handleClearChat}>
                    <MdOutlineDeleteSweep /> Clear chat
                  </button>
                  <button className="km-item danger" onClick={handleDeleteChat}>
                    <MdDeleteForever /> Delete chat
                  </button>
                </>
              )}
            </KebabMenu>
          )}
        </div>
      </div>

      {/* Pinned bar */}
      {pinnedMessages.length > 0 && !searchQuery && (
        <div className="pinned-bar">
          <MdPushPin className="pin-icon" />
          <div className="pinned-body">
            <span className="pinned-label">Pinned Message</span>
            <span className="pinned-text">
              {pinnedMessages[pinnedMessages.length - 1].message ||
                `[${pinnedMessages[pinnedMessages.length - 1].fileType}]`}
            </span>
          </div>
          <button
            className="unpin-btn"
            title="Unpin"
            onClick={() => handlePin(pinnedMessages[pinnedMessages.length - 1])}
          >
            <IoClose />
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages-wrap">
        <div
          className="chat-messages"
          ref={chatMessagesRef}
          onScroll={syncScrollStateFromDom}
        >
          {filteredMessages && filteredMessages.length === 0 && (
            <p className="no-search-results">No messages found for "{searchQuery}"</p>
          )}
          {(filteredMessages || messages).map((message, idx) => {
            const isSelected = selectedMessages.has(message._id);
            return (
              <div ref={!filteredMessages ? scrollRef : undefined} key={message._id || uuidv4()}>
                {!filteredMessages && idx === unreadDividerIdx && (
                  <div className="unread-divider">
                    <span>{initialUnreadCount} Unread Message{initialUnreadCount !== 1 ? "s" : ""}</span>
                  </div>
                )}
                <div
                  className={`message ${message.fromSelf ? "sended" : "recieved"} ${filteredMessages ? "search-hit" : ""} ${selectMode && isSelected ? "selected-msg" : ""}`}
                  onContextMenu={(e) => !selectMode && !message.deleted && handleContextMenu(e, message)}
                  onClick={() => selectMode && toggleMessageSelect(message._id)}
                >
                  {selectMode && (
                    <div className={`select-checkbox ${message.fromSelf ? "cb-right" : "cb-left"}`}>
                      <span className={`cb ${isSelected ? "checked" : ""}`}>{isSelected ? "✓" : ""}</span>
                    </div>
                  )}
                  {renderGroupSenderAvatar(message, !!filteredMessages)}
                  <div className="content">
                    {filteredMessages ? renderHighlighted(message, searchQuery) : renderContent(message)}
                  </div>
                </div>
                {!filteredMessages && renderReactions(message)}
              </div>
            );
          })}
        </div>
        {showJumpToBottom && (
          <button
            type="button"
            className="jump-to-bottom-btn"
            title="Latest messages"
            aria-label="Scroll to latest message"
            onClick={handleJumpToLatest}
          >
            <IoChevronDown />
          </button>
        )}
      </div>

      {/* Select mode toolbar */}
      {selectMode && (
        <div className="select-toolbar">
          <span>{selectedMessages.size} selected</span>
          <div className="toolbar-actions">
            {selectedMessages.size > 0 && (
              <>
                <button className="toolbar-icon-btn delete" title="Delete selected" onClick={handleDeleteSelected}>
                  <MdDelete />
                </button>
                <button className="toolbar-icon-btn forward" title="Forward selected" onClick={handleForwardSelected}>
                  <FaShare />
                </button>
              </>
            )}
            <button className="cancel-select" onClick={() => { setSelectMode(false); setSelectedMessages(new Set()); }}>
              <IoClose /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input / blocked / deleted state */}
      {!selectMode && (
        currentChat.deleted ? (
          <div className="deleted-bar">
            <MdNoAccounts />
            <span>This user has deleted their account.</span>
          </div>
        ) : isBlocked ? (
          <div className="blocked-bar">
            <MdOutlineBlock />
            <span>You blocked {currentChat.username}.</span>
            <button onClick={handleToggleBlock}>Unblock</button>
          </div>
        ) : (
          <ChatInput
            handleSendMsg={handleSendMsg}
            handleSendFile={handleSendFile}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        )
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          ref={ctxMenuRef}
          style={{
            top: ctxMenu.y,
            ...(ctxMenu.fromSelf
              ? { right: window.innerWidth - ctxMenu.x }
              : { left: ctxMenu.x }),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="menu-item" onClick={() => handleReply(ctxMenu.message)}>
            <FaReply /> Reply
          </button>
          {!ctxMenu.message.fileUrl && !ctxMenu.message.deleted && (
            <button className="menu-item" onClick={() => handleCopy(ctxMenu.message)}>
              <FaCopy /> Copy
            </button>
          )}
          <div className="menu-item react-item" onClick={handleReact}>
            <FaSmile /> React
            {showEmojiPicker && (
              <div className={`emoji-bar${ctxMenu.fromSelf ? " emoji-bar--left" : ""}`} onClick={(e) => e.stopPropagation()}>
                {QUICK_REACTIONS.map((em) => (
                  <button key={em} className="emoji-btn" onClick={() => applyReaction(ctxMenu.message, em)}>{em}</button>
                ))}
              </div>
            )}
          </div>
          <button className="menu-item" onClick={() => handleForward(ctxMenu.message)}>
            <FaShare /> Forward
          </button>
          {!ctxMenu.message.deleted && (
            <button className="menu-item pin-item" onClick={() => handlePin(ctxMenu.message)}>
              <MdPushPin /> {ctxMenu.message.pinned ? "Unpin" : "Pin"}
            </button>
          )}
          {canEdit(ctxMenu.message) && (
            <button className="menu-item edit" onClick={() => startEdit(ctxMenu.message)}>
              <MdEdit /> Edit
            </button>
          )}
          <button className="menu-item delete" onClick={() => handleDelete(ctxMenu.message)}>
            <MdDelete /> Delete
          </button>
        </ContextMenu>
      )}

      {/* Forward modal */}
      {forwardMsg && (
        <ForwardModal onClick={() => setForwardMsg(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Forward to…</h3>
              <button onClick={() => setForwardMsg(null)}><IoClose /></button>
            </div>
            <div className="modal-preview">
              {forwardMsg.multi
                ? `${forwardMsg.messages.length} message${forwardMsg.messages.length !== 1 ? "s" : ""} selected`
                : (forwardMsg.message || `[${forwardMsg.fileType}]`)}
            </div>
            <div className="contact-list">
              {contacts.filter((c) => !c.isGroup).map((c) => (
                <div key={c._id} className="forward-contact" onClick={() => sendForward(c)}>
                  <img src={`data:image/svg+xml;base64,${c.avatarImage}`} alt="" />
                  <span>{c.username}</span>
                </div>
              ))}
            </div>
          </div>
        </ForwardModal>
      )}
    </Container>
  );
}

// ── Animations ────────────────────────────────────────────────────────────────
const fadeIn = keyframes`from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;

  /* Header */
  .chat-header {
    flex-shrink: 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.6rem 1.5rem;
    gap: 1rem;
    background-color: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};
    .user-details {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex-shrink: 0;
      .avatar img { height: 3rem; width: 3rem; border-radius: 50%; object-fit: cover; }
      .group-header-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border-radius: 50%;
        background: linear-gradient(135deg, #6b7280, #4b5563);
        color: white;
        font-size: 1.35rem;
      }
      .group-header-photo {
          height: 3rem;
        width: 3rem;
        border-radius: 50%;
        object-fit: cover;
        display: block;
      }
      .group-title-btn {
        display: block;
        text-align: left;
        background: none;
        border: none;
        padding: 0;
        margin: 0;
        cursor: pointer;
        font-family: inherit;
        max-width: 100%;
        &:hover h3 {
          color: #6b7280;
        }
      }
      .username h3 { color: ${(p) => (p.$light ? "#18181b" : "white")}; white-space: nowrap; margin: 0; }
      .group-sub {
        margin: 0.1rem 0 0;
        font-size: 0.72rem;
        color: ${(p) => (p.$light ? "#6b7280" : "#ffffff88")};
      }
    }
    .header-search {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      background-color: ${(p) => (p.$light ? "rgba(255,255,255,0.85)" : "#ffffff14")};
      border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff20")};
      border-radius: 2rem;
      padding: 0.35rem 0.8rem;
      flex: 1;
      max-width: 320px;
      margin-left: auto;
      transition: border-color 0.2s;
      &:focus-within { border-color: #6b7280; }
      .search-icon { color: #6b7280; font-size: 1rem; flex-shrink: 0; }
      input { flex: 1; background: transparent; border: none; outline: none; color: ${(p) => (p.$light ? "#18181b" : "white")}; font-size: 0.85rem; min-width: 0; &::placeholder { color: ${(p) => (p.$light ? "#6b7280" : "#ffffff55")}; } }
      .clear-icon { color: ${(p) => (p.$light ? "#6b7280" : "#ffffff55")}; font-size: 1rem; cursor: pointer; &:hover { color: #ff4d4d; } }
      .match-count { font-size: 0.72rem; color: #6b7280; white-space: nowrap; }
    }

    .call-actions {
      display: flex;
      gap: 0.35rem;
      flex-shrink: 0;
    }
    .call-btn {
      background: transparent;
      border: none;
      color: ${(p) => (p.$light ? "#4b5563" : "#ffffff88")};
      font-size: 1.05rem;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      &:hover:not(:disabled) { background: ${(p) => (p.$light ? "#00000012" : "#ffffff15")}; color: ${(p) => (p.$light ? "#18181b" : "white")}; }
      &:disabled { opacity: 0.35; cursor: not-allowed; }
    }

    .kebab-wrap {
      position: relative;
      flex-shrink: 0;
    }
    .kebab-btn {
      background: transparent;
      border: none;
      color: ${(p) => (p.$light ? "#4b5563" : "#ffffff88")};
      font-size: 1.2rem;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      &:hover { background: ${(p) => (p.$light ? "#00000012" : "#ffffff15")}; color: ${(p) => (p.$light ? "#18181b" : "white")}; }
    }
  }

  /* Select toolbar */
  .select-toolbar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1.5rem;
    background: ${(p) => (p.$light ? "#e5e7eb" : "#232326")};
    border-top: 1px solid ${(p) => (p.$light ? "#9ca3af44" : "#4b556344")};

    span { color: #6b7280; font-size: 0.9rem; font-weight: 600; }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .toolbar-icon-btn {
      background: transparent;
      border: none;
      width: 2.2rem;
      height: 2.2rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 1.15rem;
      transition: background 0.15s;
      &.delete { color: #ff6b6b; &:hover { background: #ff4d4d22; } }
      &.forward { color: #6b7280; &:hover { background: #6b728022; } }
    }

    .cancel-select {
      display: flex; align-items: center; gap: 0.4rem;
      background: transparent; border: 1px solid ${(p) => (p.$light ? "#18181b30" : "#ffffff30")};
      color: ${(p) => (p.$light ? "#4b5563" : "#d1d1d1")}; font-size: 0.82rem; padding: 0.3rem 0.8rem;
      border-radius: 2rem; cursor: pointer;
      &:hover { background: #ffffff15; }
      svg { font-size: 0.9rem; }
    }
  }

  /* Blocked bar */
  .deleted-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.9rem 1.5rem;
    background: ${(p) => (p.$light ? "#e5e7eb" : "#232326")};
    border-top: 1px solid #6b728033;
    svg { color: ${(p) => (p.$light ? "#9ca3af" : "#6b7280")}; font-size: 1.2rem; }
    span { color: ${(p) => (p.$light ? "#6b7280" : "#9ca3af")}; font-size: 0.88rem; font-style: italic; }
  }

  .deleted-user-header-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 50%;
    background: ${(p) => (p.$light ? "#d1d5db" : "#374151")};
    color: ${(p) => (p.$light ? "#9ca3af" : "#6b7280")};
    font-size: 1.4rem;
  }

  .blocked-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.6rem;
    padding: 0.9rem 1.5rem;
    background: ${(p) => (p.$light ? "#e5e7eb" : "#232326")};
    border-top: 1px solid #ff4d4d33;
    svg { color: #ff4d4d; font-size: 1.1rem; }
    span { color: ${(p) => (p.$light ? "#4b5563" : "#ffffffaa")}; font-size: 0.88rem; }
    button {
      background: transparent;
      border: 1px solid #6b7280;
      color: #6b7280;
      border-radius: 2rem;
      padding: 0.25rem 0.9rem;
      font-size: 0.82rem;
      cursor: pointer;
      &:hover { background: #6b728020; }
    }
  }

  /* Pinned bar */
  .pinned-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.55rem 1.5rem;
    background-color: ${(p) => (p.$light ? "#e5e7eb" : "#232326")};
    border-bottom: 1px solid #4b556344;

    .pin-icon {
      font-size: 1rem;
      color: #6b7280;
      flex-shrink: 0;
    }

    .pinned-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.1rem;

      .pinned-label {
        font-size: 0.7rem;
        color: #6b7280;
        font-weight: 600;
        letter-spacing: 0.03em;
        text-transform: uppercase;
      }

      .pinned-text {
        font-size: 0.85rem;
        color: ${(p) => (p.$light ? "#52525b" : "#d1d1d1")};
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .unpin-btn {
      background: transparent;
      border: none;
      color: ${(p) => (p.$light ? "#6b7280" : "#ffffff55")};
      cursor: pointer;
      font-size: 1.1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 0.2rem;
      border-radius: 50%;
      transition: color 0.15s, background 0.15s;
      &:hover {
        color: #ff4d4d;
        background: #ff4d4d22;
      }
    }
  }

  /* Messages */
  .chat-messages-wrap {
    flex: 1;
    min-height: 0;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .jump-to-bottom-btn {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 5;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: 1px solid ${(p) => (p.$light ? "#64748b" : "rgba(255,255,255,0.5)")};
    background: ${(p) => (p.$light ? "#ffffff" : "#52525b")};
    color: ${(p) => (p.$light ? "#0f172a" : "#f8fafc")};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.35rem;
    line-height: 1;
    box-shadow: ${(p) =>
      p.$light
        ? "0 2px 14px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(255,255,255,0.8) inset"
        : "0 2px 16px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.12) inset"};
    transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.15s;
    &:hover {
      background: ${(p) => (p.$light ? "#f1f5f9" : "#71717a")};
      color: ${(p) => (p.$light ? "#020617" : "#ffffff")};
      border-color: ${(p) => (p.$light ? "#475569" : "rgba(255,255,255,0.65)")};
    }
    &:active {
      transform: translateX(-50%) scale(0.96);
    }
  }

  .chat-messages {
    flex: 1;
    min-height: 0;
    padding: 1rem 2rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    overflow: auto;
    background: ${(p) => p.$chatBg};
    background-attachment: fixed;
    &::-webkit-scrollbar {
      width: 0.2rem;
      &-thumb {
        background-color: ${(p) => (p.$light ? "#9ca3af66" : "#ffffff39")};
        border-radius: 1rem;
      }
    }

    .message {
      display: flex;
      align-items: flex-end;
      .msg-sender-avatar {
        flex-shrink: 0;
        width: 2.1rem;
        height: 2.1rem;
        margin-right: 0.4rem;
        align-self: flex-end;
        margin-bottom: 0.2rem;
        img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          display: block;
        }
        .msg-sender-placeholder {
          width: 100%;
          height: 100%;
          border-radius: 50%;
      display: flex;
      align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #6b7280, #4b5563);
          color: white;
          font-size: 0.72rem;
          font-weight: 700;
        }
      }
      .content {
        max-width: 55%;
        overflow-wrap: break-word;
        padding: 0.7rem 1rem;
        font-size: 1rem;
        border-radius: 1rem;
        color: ${(p) => (p.$light ? "#18181b" : "#d1d1d1")};
        position: relative;

        p {
          color: inherit;
          margin: 0;
        }

        .reply-quote {
          border-left: 3px solid #6b7280;
          padding: 0.2rem 0.5rem;
          margin-bottom: 0.4rem;
          border-radius: 0 0.3rem 0.3rem 0;
          background: ${(p) => (p.$light ? "rgba(107, 114, 128, 0.14)" : "#ffffff10")};
          .reply-sender {
            display: block;
            font-size: 0.72rem;
            color: ${(p) => (p.$light ? "#374151" : "#6b7280")};
            font-weight: 600;
          }
          .reply-text {
            display: block;
            font-size: 0.78rem;
            color: ${(p) => (p.$light ? "#4b5563" : "#ffffffaa")};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 220px;
          }
        }

        .deleted-msg {
          font-style: italic;
          color: ${(p) => (p.$light ? "#52525b" : "#ffffff55")};
          font-size: 0.9rem;
        }
        .edited-label {
          display: block;
          font-size: 0.68rem;
          color: ${(p) => (p.$light ? "#6b7280" : "#ffffff55")};
          margin-top: 0.2rem;
          text-align: right;
        }

        .edit-box {
          display: flex; flex-direction: column; gap: 0.4rem;
          input {
            background: transparent;
            border: none;
            border-bottom: 1px solid #6b7280;
            color: ${(p) => (p.$light ? "#18181b" : "white")};
            font-size: 1rem;
            outline: none;
            padding: 0.1rem 0.2rem;
            width: 100%;
          }
          .edit-actions { display: flex; gap: 0.4rem; justify-content: flex-end;
            button { border: none; border-radius: 0.3rem; padding: 0.2rem 0.6rem; font-size: 0.75rem; cursor: pointer; }
            .save { background: #6b7280; color: white; }
            .cancel {
              background: ${(p) => (p.$light ? "#e5e7eb" : "#ffffff20")};
              color: ${(p) => (p.$light ? "#4b5563" : "#d1d1d1")};
            }
          }
        }

        .msg-image { max-width: 280px; max-height: 220px; border-radius: 0.5rem; display: block; object-fit: cover; cursor: pointer; &:hover { opacity: 0.85; } }
        .msg-video { max-width: 300px; max-height: 220px; border-radius: 0.5rem; display: block; }
        .msg-audio { display: flex; align-items: center; gap: 0.5rem; svg { font-size: 1rem; color: #6b7280; } audio { height: 32px; min-width: 180px; max-width: 260px; } }
        .msg-file {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: ${(p) => (p.$light ? "#374151" : "#6b7280")};
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: ${(p) => (p.$light ? "600" : "400")};
          &:hover { text-decoration: underline; }
          svg { font-size: 1.4rem; flex-shrink: 0; }
          span { word-break: break-all; color: inherit; }
        }
        .file-caption {
          margin: 0.4rem 0 0;
          font-size: 0.92rem;
          line-height: 1.35;
          word-break: break-word;
          color: inherit;
        }
      }
    }

    .reactions {
      display: flex;
      gap: 0.3rem;
      flex-wrap: wrap;
      padding: 0 0.5rem 0.2rem;
      .reaction-pill {
        background: ${(p) => (p.$light ? "rgba(255,255,255,0.75)" : "#ffffff15")};
        border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff25")};
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
        font-size: 0.82rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 0.2rem;
        color: ${(p) => (p.$light ? "#18181b" : "#d1d1d1")};
        transition: background 0.15s;
        span { font-size: 0.75rem; color: inherit; }
        &:hover { background: ${(p) => (p.$light ? "#ffffff" : "#ffffff25")}; }
        &.mine { background: ${(p) => (p.$light ? "rgba(107, 114, 128, 0.35)" : "#6b728030")}; border-color: #6b7280; }
      }
    }

    .sended {
      justify-content: flex-end;
      .content { background-color: ${(p) => (p.$light ? "rgba(75, 85, 99, 0.2)" : "#52525b30")}; }
    }
    .recieved {
      justify-content: flex-start;
      .content { background-color: ${(p) => (p.$light ? "rgba(107, 114, 128, 0.28)" : "#52525b30")}; }
    }

    .selected-msg .content { outline: 2px solid #6b7280; outline-offset: 2px; border-radius: 1rem; }

    .select-checkbox {
      display: flex; align-items: center; justify-content: center;
      .cb {
        width: 1.15rem; height: 1.15rem; border-radius: 50%;
        border: 2px solid #6b7280; background: transparent;
        display: flex; align-items: center; justify-content: center;
        font-size: 0.7rem; color: white; transition: background 0.15s;
      }
      .cb.checked { background: #6b7280; }
    }
    .cb-left { margin-right: 0.5rem; order: -1; }
    .cb-right { margin-left: 0.5rem; order: 1; }

    .no-search-results {
      text-align: center;
      color: ${(p) => (p.$light ? "#9ca3af" : "#ffffff44")};
      font-size: 0.9rem;
      margin-top: 2rem;
    }
    .search-hit .content mark { background: #4b5563; color: white; border-radius: 2px; padding: 0 2px; }

    .unread-divider {
      display: flex; align-items: center; gap: 0.8rem; margin: 0.4rem 0;
      &::before, &::after { content: ""; flex: 1; height: 1px; background: linear-gradient(90deg, transparent, #4b556388, transparent); }
      span {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 600;
        white-space: nowrap;
        background-color: ${(p) => (p.$light ? "#f3f4f6" : "#232326")};
        padding: 0.2rem 0.8rem;
        border-radius: 999px;
        border: 1px solid ${(p) => (p.$light ? "#9ca3af" : "#4b556355")};
      }
    }
  }
`;

const ContextMenu = styled.div`
  position: fixed;
  z-index: 999;
  background-color: #252528;
  border: 1px solid #6b728044;
  border-radius: 0.6rem;
  padding: 0.3rem 0;
  min-width: 150px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  animation: ${fadeIn} 0.1s ease;

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    width: 100%;
    padding: 0.5rem 1rem;
    background: transparent;
    border: none;
    color: #d1d1d1;
    font-size: 0.88rem;
    cursor: pointer;
    text-align: left;
    position: relative;
    transition: background 0.15s;
    svg { font-size: 0.95rem; color: #6b7280; }
    &:hover { background-color: #ffffff15; }
    &.delete svg { color: #ff4d4d; }
    &.delete:hover { color: #ff4d4d; }
  }

  .react-item {
    user-select: none;
    .emoji-bar {
      position: absolute;
      left: 100%;
      top: 0;
      background: #252528;
      border: 1px solid #6b728044;
      border-radius: 0.6rem;
      padding: 0.4rem 0.5rem;
      display: flex;
      gap: 0.3rem;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      &.emoji-bar--left {
        left: auto;
        right: 100%;
      }
      .emoji-btn {
        background: transparent;
        border: none;
        font-size: 1.3rem;
        cursor: pointer;
        padding: 0.2rem;
        border-radius: 0.3rem;
        transition: background 0.1s;
        &:hover { background: #ffffff20; }
      }
    }
  }
`;

const KebabMenu = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 999;
  background: #252528;
  border: 1px solid #6b728044;
  border-radius: 0.75rem;
  min-width: 190px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.55);
  animation: ${fadeIn} 0.12s ease;
  overflow: hidden;

  .km-divider {
    height: 1px;
    background: #ffffff15;
    margin: 0.2rem 0;
  }

  .km-item {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    width: 100%;
    padding: 0.65rem 1.1rem;
    background: transparent;
    border: none;
    color: #d1d1d1;
    font-size: 0.9rem;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
    svg { font-size: 1.05rem; color: #6b7280; }
    &:hover { background: #ffffff12; }
    &.danger { color: #ff6b6b; svg { color: #ff6b6b; } &:hover { background: #ff4d4d18; } }
    &.active-block {
      color: #f5d04a;
      svg { color: #f5d04a; }
      &:hover {
        background: #ffffff12;
        color: #f5d04a;
        svg { color: #f5d04a; }
      }
    }
  }
`;

const ForwardModal = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: ${fadeIn} 0.15s ease;

  .modal-box {
    background: #252528;
    border: 1px solid #6b728044;
    border-radius: 1rem;
    width: 320px;
    max-height: 480px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.2rem 0.6rem;
    h3 { color: white; font-size: 1rem; margin: 0; }
    button { background: transparent; border: none; color: #ffffff55; cursor: pointer; font-size: 1.2rem; display: flex; &:hover { color: white; } }
  }

  .modal-preview {
    margin: 0 1.2rem 0.8rem;
    padding: 0.5rem 0.8rem;
    background: #ffffff10;
    border-radius: 0.5rem;
    font-size: 0.82rem;
    color: #ffffffaa;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .contact-list {
    overflow-y: auto;
    padding: 0.4rem 0;
    &::-webkit-scrollbar { width: 0.2rem; &-thumb { background: #ffffff39; } }

    .forward-contact {
      display: flex;
      align-items: center;
      gap: 0.8rem;
      padding: 0.6rem 1.2rem;
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: #ffffff10; }
      img { height: 2.4rem; border-radius: 50%; }
      span { color: white; font-size: 0.9rem; }
    }
  }
`;
