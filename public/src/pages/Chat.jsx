import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import styled from "styled-components";
import {
  allUsersRoute,
  getHost,
  lastMessagesRoute,
  createGroupRoute,
  myGroupsRoute,
  addGroupMembersRoute,
  blockUserRoute,
  checkBlockRoute,
  clearChatRoute,
  deleteChatRoute,
  leaveGroupRoute,
  getStatusesRoute,
  unreadCountsRoute,
  markChatReadRoute,
} from "../utils/APIRoutes";
import ChatContainer from "../components/ChatContainer";
import Contacts from "../components/Contacts";
import GroupCreateStaging from "../components/GroupCreateStaging";
import GroupInfoSidePanel from "../components/GroupInfoSidePanel";
import Welcome from "../components/Welcome";
import NavSidebar from "../components/NavSidebar";
import StatusPage from "../components/StatusPage";
import ProfilePanel from "../components/ProfilePanel";
import ProfileView from "../components/ProfileView";
import ChatsSettingsView from "../components/ChatsSettingsView";
import CallOverlay from "../components/CallOverlay";
import { ChatAppearanceProvider, useChatAppearance } from "../context/ChatAppearanceContext";
import { useWebRTCCall } from "../hooks/useWebRTCCall";

function BlankPane() {
  const { themeMode } = useChatAppearance();
  return <BlankPaneEl $light={themeMode === "light"} />;
}

function ChatContent() {
  const navigate = useNavigate();
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";
  const socket = useRef();
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [createGroupMode, setCreateGroupMode] = useState(false);
  const [groupCreateSelection, setGroupCreateSelection] = useState([]);
  const [groupCreateLoading, setGroupCreateLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [addMembersLoading, setAddMembersLoading] = useState(false);
  const [groupPanelRequestAddMembers, setGroupPanelRequestAddMembers] = useState(false);
  const [groupInfoPanelOpen, setGroupInfoPanelOpen] = useState(false);
  const [currentChat, setCurrentChat] = useState(undefined);
  const [currentUser, setCurrentUser] = useState(undefined);
  const [activeTab, setActiveTab] = useState("chats");
  const [profileSection, setProfileSection] = useState("profile");

  const [unreadCounts, setUnreadCounts] = useState({});
  const [statusUnreadCount, setStatusUnreadCount] = useState(0);
  const [currentChatUnread, setCurrentChatUnread] = useState(0);
  const [arrivalMsg, setArrivalMsg] = useState(null);
  const [lastMessages, setLastMessages] = useState({});
  const [pinnedChatIds, setPinnedChatIds] = useState([]);
  const [blockedUserIds, setBlockedUserIds] = useState(() => new Set());
  const [chatRefreshNonce, setChatRefreshNonce] = useState(0);
  const [blockRefreshNonce, setBlockRefreshNonce] = useState(0);
  /** DMs removed from sidebar after delete; cleared when user opens chat or new activity */
  const [hiddenDmIds, setHiddenDmIds] = useState(() => new Set());

  const call = useWebRTCCall(currentUser);
  const callRef = useRef(call);
  callRef.current = call;

  const currentChatRef = useRef(currentChat);
  useEffect(() => { currentChatRef.current = currentChat; }, [currentChat]);

  const chatItems = useMemo(() => {
    const gItems = groups.map((gr) => ({
      isGroup: true,
      _id: gr._id,
      username: gr.name,
      avatarImage: gr.avatarImage || "",
      members: gr.members,
      memberProfiles: gr.memberProfiles || [],
    }));
    const uItems = contacts
      .filter((c) => !hiddenDmIds.has(String(c._id)))
      .map((c) => ({
        ...c,
        isGroup: false,
        // Always display "Deleted User" regardless of what's stored in the DB
        username: c.deleted ? "Deleted User" : c.username,
      }));
    return [...gItems, ...uItems].sort((a, b) =>
      a.username.localeCompare(b.username, undefined, { sensitivity: "base" })
    );
  }, [groups, contacts, hiddenDmIds]);

  const sortedChatItems = useMemo(() => {
    const order = pinnedChatIds.map(String);
    const items = [...chatItems];
    items.sort((a, b) => {
      const ai = order.indexOf(String(a._id));
      const bi = order.indexOf(String(b._id));
      const ap = ai >= 0;
      const bp = bi >= 0;
      if (ap && bp) return ai - bi;
      if (ap) return -1;
      if (bp) return 1;
      return a.username.localeCompare(b.username, undefined, { sensitivity: "base" });
    });
    return items;
  }, [chatItems, pinnedChatIds]);

  useEffect(() => {
    if (!currentUser?._id) return;
    try {
      const raw = localStorage.getItem(`LetzChat_pinned_${currentUser._id}`);
      setPinnedChatIds(raw ? JSON.parse(raw) : []);
    } catch {
      setPinnedChatIds([]);
    }
  }, [currentUser?._id]);

  useEffect(() => {
    if (!currentUser?._id) {
      setHiddenDmIds(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(`LetzChat_hiddenDm_${currentUser._id}`);
      setHiddenDmIds(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch {
      setHiddenDmIds(new Set());
    }
  }, [currentUser?._id]);

  const removeHiddenDm = useCallback(
    (userId) => {
      const id = String(userId);
      setHiddenDmIds((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        if (currentUser?._id) {
          try {
            localStorage.setItem(`LetzChat_hiddenDm_${currentUser._id}`, JSON.stringify([...next]));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [currentUser?._id]
  );

  /** After server deletes DM messages: hide row, clear previews, unpin */
  const applyDmDeleteSideEffects = useCallback(
    (partnerId) => {
      const id = String(partnerId);
      setHiddenDmIds((prev) => {
        const next = new Set(prev);
        next.add(id);
        if (currentUser?._id) {
          try {
            localStorage.setItem(`LetzChat_hiddenDm_${currentUser._id}`, JSON.stringify([...next]));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
      setLastMessages((prev) => {
        const n = { ...prev };
        Object.keys(n).forEach((k) => {
          if (String(k) === id) delete n[k];
        });
        return n;
      });
      setUnreadCounts((prev) => {
        const n = { ...prev };
        Object.keys(n).forEach((k) => {
          if (String(k) === id) delete n[k];
        });
        return n;
      });
      setPinnedChatIds((prev) => {
        const strs = prev.map(String);
        if (!strs.includes(id)) return prev;
        const next = strs.filter((x) => x !== id);
        if (currentUser?._id) {
          try {
            localStorage.setItem(`LetzChat_pinned_${currentUser._id}`, JSON.stringify(next));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [currentUser?._id]
  );

  useEffect(() => {
    if (!currentUser || contacts.length === 0) {
      setBlockedUserIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        contacts.map((c) =>
          axios
            .post(checkBlockRoute, { blockerId: currentUser._id, blockedId: c._id })
            .then(({ data }) => [c._id, !!data.blocked])
            .catch(() => [c._id, false])
        )
      );
      if (cancelled) return;
      setBlockedUserIds(new Set(results.filter(([, b]) => b).map(([id]) => id)));
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser, contacts]);

  // Seed unread message counts from server (persists across page refreshes)
  useEffect(() => {
    if (!currentUser) return;
    const allChats = [
      ...contacts.map((c) => ({ id: c._id, isGroup: false })),
      ...groups.map((g) => ({ id: g._id, isGroup: true })),
    ];
    if (!allChats.length) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.post(unreadCountsRoute, {
          userId: currentUser._id,
          chatIds: allChats,
        });
        if (cancelled) return;
        setUnreadCounts((prev) => {
          const merged = { ...prev };
          Object.entries(data).forEach(([chatId, count]) => {
            // Only set if socket hasn't already bumped it higher
            if ((prev[chatId] || 0) < count) merged[chatId] = count;
          });
          return merged;
        });
      } catch { /* non-critical */ }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, contacts, groups]);

  // Background status-unread count — runs on load and whenever contacts change
  useEffect(() => {
    if (!currentUser || contacts.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.post(getStatusesRoute, {
          userId: currentUser._id,
          contactIds: contacts.map((c) => c._id),
        });
        if (cancelled) return;
        const myId = String(currentUser._id);
        const grouped = new Map();
        data.forEach((s) => {
          const uid = String(s.userId._id || s.userId);
          if (uid === myId) return;
          if (!grouped.has(uid)) grouped.set(uid, []);
          grouped.get(uid).push(s);
        });
        let count = 0;
        grouped.forEach((statuses) => {
          const unseen = statuses.some(
            (s) => !s.viewers?.some((v) => String(v.userId) === myId)
          );
          if (unseen) count++;
        });
        setStatusUnreadCount(count);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentUser, contacts]);

  useEffect(() => {
    if (activeTab === "profile") setProfileSection("profile");
  }, [activeTab]);

  useEffect(async () => {
    if (!localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)) {
      navigate("/login");
    } else {
      setCurrentUser(
        await JSON.parse(
          localStorage.getItem(process.env.REACT_APP_LOCALHOST_KEY)
        )
      );
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    socket.current = io(getHost() || undefined);
    socket.current.emit("add-user", currentUser._id);
    callRef.current.attachSocket(socket.current);

    socket.current.on("msg-recieve", ({ msg, messageId, from }) => {
      if (from) removeHiddenDm(from);
      const preview = { text: msg, fileType: "", fileName: "", fromSelf: false, deleted: false };
      setLastMessages((prev) => ({ ...prev, [from]: preview }));

      if (currentChatRef.current && currentChatRef.current._id === from) {
        setArrivalMsg({
          _id: messageId,
          fromSelf: false,
          message: msg,
          createdAt: new Date().toISOString(),
        });
      } else if (from) {
        setUnreadCounts((prev) => ({ ...prev, [from]: (prev[from] || 0) + 1 }));
      }
    });

    socket.current.on("file-msg-recieve", ({ fileUrl, fileType, fileName, messageId, from, message: caption }) => {
      if (from) removeHiddenDm(from);
      const preview = { text: caption || "", fileType, fileName, fromSelf: false, deleted: false };
      setLastMessages((prev) => ({ ...prev, [from]: preview }));

      if (currentChatRef.current && currentChatRef.current._id === from) {
        setArrivalMsg({
          _id: messageId,
          fromSelf: false,
          message: caption || "",
          fileUrl,
          fileType,
          fileName,
          createdAt: new Date().toISOString(),
        });
      } else if (from) {
        setUnreadCounts((prev) => ({ ...prev, [from]: (prev[from] || 0) + 1 }));
      }
    });

    socket.current.on("group-msg-recieve", ({ msg, messageId, from, groupId }) => {
      const preview = { text: msg, fileType: "", fileName: "", fromSelf: false, deleted: false };
      setLastMessages((prev) => ({ ...prev, [groupId]: preview }));
      if (currentChatRef.current?.isGroup && currentChatRef.current._id === groupId) {
        setArrivalMsg({
          _id: messageId,
          fromSelf: false,
          senderId: from,
          message: msg,
          createdAt: new Date().toISOString(),
          replyTo: {},
        });
      } else if (groupId) {
        setUnreadCounts((prev) => ({ ...prev, [groupId]: (prev[groupId] || 0) + 1 }));
      }
    });

    socket.current.on("group-file-msg-recieve", ({ fileUrl, fileType, fileName, messageId, from, groupId, message: caption }) => {
      const preview = { text: caption || "", fileType, fileName, fromSelf: false, deleted: false };
      setLastMessages((prev) => ({ ...prev, [groupId]: preview }));
      if (currentChatRef.current?.isGroup && currentChatRef.current._id === groupId) {
        setArrivalMsg({
          _id: messageId,
          fromSelf: false,
          senderId: from,
          message: caption || "",
          fileUrl,
          fileType,
          fileName,
          createdAt: new Date().toISOString(),
        });
      } else if (groupId) {
        setUnreadCounts((prev) => ({ ...prev, [groupId]: (prev[groupId] || 0) + 1 }));
      }
    });

    socket.current.on("user-deleted", ({ userId }) => {
      const deletedPatch = {
        deleted: true,
        username: "Deleted User",
        avatarImage: "",
        email: "",
        phone: "",
      };
      setContacts((prev) =>
        prev.map((c) => String(c._id) === String(userId) ? { ...c, ...deletedPatch } : c)
      );
      setCurrentChat((prev) =>
        prev && !prev.isGroup && String(prev._id) === String(userId)
          ? { ...prev, ...deletedPatch }
          : prev
      );
    });

    return () => {
      callRef.current.detachSocket();
      if (socket.current) {
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, [currentUser, removeHiddenDm]);

  useEffect(async () => {
    if (currentUser) {
      if (currentUser.isAvatarImageSet) {
        const data = await axios.get(`${allUsersRoute}/${currentUser._id}`);
        setContacts(data.data);
      } else {
        navigate("/setAvatar");
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    (async () => {
      try {
        const { data } = await axios.get(myGroupsRoute(currentUser._id));
        setGroups(data);
        setLastMessages((prev) => {
          const next = { ...prev };
          data.forEach((g) => {
            if (g.lastMessage) next[g._id] = g.lastMessage;
          });
          return next;
        });
      } catch (e) {
        /* non-critical */
      }
    })();
  }, [currentUser]);

  useEffect(async () => {
    if (!currentUser || contacts.length === 0) return;
    try {
      const { data } = await axios.post(lastMessagesRoute, {
        userId: currentUser._id,
        contactIds: contacts.map((c) => c._id),
      });
      setLastMessages((prev) => ({ ...prev, ...data }));
    } catch (e) {
      // non-critical
    }
  }, [contacts]);

  const handleChatChange = (chat) => {
    setCreateGroupMode(false);
    setGroupCreateSelection([]);
    setNewGroupName("");
    setGroupPanelRequestAddMembers(false);
    setGroupInfoPanelOpen(false);
    if (!chat.isGroup) removeHiddenDm(chat._id);
    const unread = unreadCounts[chat._id] || unreadCounts[String(chat._id)] || 0;
    setCurrentChatUnread(unread);
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));
    setCurrentChat(chat);
    setArrivalMsg(null);
    // Persist read state so badge resets after page refresh too
    if (currentUser) {
      axios.post(markChatReadRoute, {
        userId: currentUser._id,
        chatId: chat._id,
      }).catch(() => {});
    }
  };

  const onEnterCreateGroupMode = () => {
    setGroupInfoPanelOpen(false);
    setGroupPanelRequestAddMembers(false);
    setCreateGroupMode(true);
    setCurrentChat(undefined);
    setGroupCreateSelection([]);
    setNewGroupName("");
  };

  const consumeGroupPanelAddMembersRequest = useCallback(() => setGroupPanelRequestAddMembers(false), []);

  const handleSubmitAddMembersFromPanel = useCallback(
    async (selectedContacts) => {
      if (!currentChat?.isGroup || !selectedContacts?.length || !currentUser) return;
      const gid = currentChat._id;
      setAddMembersLoading(true);
      try {
        const { data } = await axios.post(addGroupMembersRoute(gid), {
          requesterId: currentUser._id,
          memberIds: selectedContacts.map((c) => c._id),
        });
        setGroups((prev) =>
          prev.map((g) =>
            g._id === gid ? { ...g, members: data.members, memberProfiles: data.memberProfiles } : g
          )
        );
        setCurrentChat((prev) =>
          prev && prev.isGroup && prev._id === gid
            ? { ...prev, members: data.members, memberProfiles: data.memberProfiles }
            : prev
        );
      } catch (e) {
        alert(e.response?.data?.msg || "Could not add members");
        throw e;
      } finally {
        setAddMembersLoading(false);
      }
    },
    [currentChat, currentUser]
  );

  const onAddToGroupCreate = (contact) => {
    setGroupCreateSelection((prev) => {
      if (prev.some((p) => p._id === contact._id)) return prev;
      return [...prev, contact];
    });
  };

  const onRemoveFromGroupCreate = (id) => {
    setGroupCreateSelection((prev) => prev.filter((p) => p._id !== id));
  };

  const handleCreateGroupConfirm = async () => {
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;
    if (groupCreateSelection.length < 2 || !currentUser) return;
    setGroupCreateLoading(true);
    try {
      const { data } = await axios.post(createGroupRoute, {
        creatorId: currentUser._id,
        memberIds: groupCreateSelection.map((c) => c._id),
        name: trimmedName,
      });
      const g = data.group;
      const newRow = {
        _id: g._id,
        name: g.name,
        avatarImage: g.avatarImage || "",
        members: g.members.map(String),
        createdBy: String(g.createdBy),
        memberProfiles: data.memberProfiles,
        lastMessage: null,
      };
      setGroups((prev) => [newRow, ...prev.filter((x) => x._id !== newRow._id)]);
      const chatObj = {
        isGroup: true,
        _id: newRow._id,
        username: newRow.name,
        avatarImage: newRow.avatarImage || "",
        members: newRow.members,
        memberProfiles: newRow.memberProfiles,
      };
      handleChatChange(chatObj);
    } catch (e) {
      alert(e.response?.data?.msg || "Could not create group");
    } finally {
      setGroupCreateLoading(false);
    }
  };

  const handleMessageSent = (contactId, preview) => {
    removeHiddenDm(contactId);
    setLastMessages((prev) => ({ ...prev, [contactId]: { ...preview, fromSelf: true, deleted: false } }));
  };

  const handleGroupProfileUpdated = (groupId, patch) => {
    setGroups((prev) =>
      prev.map((g) => {
        if (g._id !== groupId) return g;
        return {
          ...g,
          ...(patch.name != null ? { name: patch.name } : {}),
          ...(patch.avatarImage != null ? { avatarImage: patch.avatarImage } : {}),
        };
      })
    );
    setCurrentChat((prev) =>
      prev && prev.isGroup && prev._id === groupId
        ? {
            ...prev,
            ...(patch.name != null ? { username: patch.name } : {}),
            ...(patch.avatarImage != null ? { avatarImage: patch.avatarImage } : {}),
          }
        : prev
    );
  };

  const togglePinChat = useCallback((contact) => {
    const id = String(contact._id);
    setPinnedChatIds((prev) => {
      const strs = prev.map(String);
      const next = strs.includes(id) ? strs.filter((x) => x !== id) : [id, ...strs.filter((x) => x !== id)];
      if (currentUser?._id) {
        try {
          localStorage.setItem(`LetzChat_pinned_${currentUser._id}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
      }
      return next;
    });
  }, [currentUser?._id]);

  const handleChatMenuBlock = useCallback(
    async (contact) => {
      if (!currentUser || contact.isGroup) return;
      try {
        const { data } = await axios.post(blockUserRoute, {
          blockerId: currentUser._id,
          blockedId: contact._id,
        });
        const nowBlocked = !!data.blocked;
        setBlockedUserIds((prev) => {
          const next = new Set(prev);
          if (nowBlocked) next.add(contact._id);
          else next.delete(contact._id);
          return next;
        });
        if (currentChatRef.current?._id === contact._id) {
          setBlockRefreshNonce((n) => n + 1);
        }
      } catch (e) {
        alert(e.response?.data?.msg || "Could not update block");
      }
    },
    [currentUser]
  );

  const handleChatColumnEmptyClick = useCallback(() => {
    if (createGroupMode) return;
    setCurrentChat(undefined);
    setArrivalMsg(null);
    setGroupInfoPanelOpen(false);
    setGroupPanelRequestAddMembers(false);
  }, [createGroupMode]);

  const handleBlockStatusChange = useCallback((contactId, blocked) => {
    const b = !!blocked;
    setBlockedUserIds((prev) => {
      const next = new Set(prev);
      if (b) next.add(contactId);
      else next.delete(contactId);
      return next;
    });
    if (currentChatRef.current?._id === contactId) {
      setBlockRefreshNonce((n) => n + 1);
    }
  }, []);

  const handleChatMenuClear = useCallback(
    async (contact) => {
      if (!currentUser) return;
      const name = contact.username || "this chat";
      if (!window.confirm(`Clear messages in ${name}? This clears history on your side only.`)) return;
      try {
        if (contact.isGroup) {
          await axios.post(clearChatRoute, { from: currentUser._id, groupId: contact._id });
        } else {
          await axios.post(clearChatRoute, { from: currentUser._id, to: contact._id });
        }
        setLastMessages((prev) => ({
          ...prev,
          [contact._id]: { text: "", fileType: "", fileName: "", fromSelf: false, deleted: false },
        }));
        if (currentChatRef.current?._id === contact._id) {
          setChatRefreshNonce((n) => n + 1);
        }
      } catch (e) {
        alert(e.response?.data?.msg || "Could not clear chat");
      }
    },
    [currentUser]
  );

  const handleChatMenuDelete = useCallback(
    async (contact) => {
      if (!currentUser) return;
      const isGroup = contact.isGroup;
      const partnerId = String(contact._id);
      const name = contact.username || "this chat";
      const msg = isGroup
        ? `Leave "${name}"? You will no longer receive group messages.`
        : `Delete chat with ${name}? All messages will be permanently removed.`;
      if (!window.confirm(msg)) return;
      try {
        if (isGroup) {
          await axios.post(leaveGroupRoute(contact._id), { userId: currentUser._id });
          setGroups((prev) => prev.filter((g) => g._id !== contact._id));
        } else {
          await axios.post(deleteChatRoute, {
            from: String(currentUser._id),
            to: partnerId,
          });
          applyDmDeleteSideEffects(partnerId);
        }
        if (isGroup) {
          setLastMessages((prev) => {
            const n = { ...prev };
            delete n[partnerId];
            Object.keys(n).forEach((k) => {
              if (String(k) === partnerId) delete n[k];
            });
            return n;
          });
          setUnreadCounts((prev) => {
            const n = { ...prev };
            delete n[partnerId];
            Object.keys(n).forEach((k) => {
              if (String(k) === partnerId) delete n[k];
            });
            return n;
          });
          setPinnedChatIds((prev) => {
            const strs = prev.map(String);
            if (!strs.includes(partnerId)) return prev;
            const next = strs.filter((x) => x !== partnerId);
            try {
              localStorage.setItem(`LetzChat_pinned_${currentUser._id}`, JSON.stringify(next));
            } catch {
              /* ignore */
            }
            return next;
          });
        }
        if (String(currentChatRef.current?._id) === partnerId) {
          setCurrentChat(undefined);
          setChatRefreshNonce((n) => n + 1);
        }
      } catch (e) {
        alert(e.response?.data?.msg || "Could not complete action");
      }
    },
    [currentUser, applyDmDeleteSideEffects]
  );

  const showGroupPanel =
    groupInfoPanelOpen && currentChat?.isGroup && !createGroupMode && activeTab === "chats";

  // ── Resizable panel divider ──────────────────────────────────────────────
  const MIN_LEFT = 220;
  const MAX_LEFT = 480;
  const [leftWidth, setLeftWidth] = useState(280);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const handleDragStart = (e) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(MAX_LEFT, Math.max(MIN_LEFT, dragStartWidth.current + delta));
      setLeftWidth(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <CallOverlay
        callState={call.callState}
        remoteUser={call.remoteUser}
        localStream={call.localStream}
        remoteStream={call.remoteStream}
        isMuted={call.isMuted}
        isVideoOff={call.isVideoOff}
        isVideoCall={call.isVideoCall}
        isLight={isLight}
        onAccept={call.acceptCall}
        onReject={call.rejectCall}
        onEnd={call.endCall}
        onToggleMute={call.toggleMute}
        onToggleVideo={call.toggleVideo}
      />
      <Container $light={isLight}>
        <div
          className={`container${showGroupPanel ? " with-group-panel" : ""}`}
          style={{
            gridTemplateColumns: showGroupPanel
              ? `65px ${leftWidth}px 6px auto 280px`
              : `65px ${leftWidth}px 6px auto`,
          }}
        >
          {/* ── Col 1: Nav ── */}
          <NavSidebar
            currentUserImage={currentUser?.avatarImage}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            msgBadge={Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
            statusBadge={statusUnreadCount}
          />

          {/* ── Col 2: Left panel ── */}
          {activeTab === "status" ? (
            <StatusPage currentUser={currentUser} contacts={contacts} onUnreadCountChange={setStatusUnreadCount} />
          ) : activeTab === "profile" ? (
            <ProfilePanel
              activeSection={profileSection}
              onOpenProfile={() => setProfileSection("profile")}
              onOpenChatsSettings={() => setProfileSection("chats")}
            />
          ) : (
            <Contacts
              chatItems={sortedChatItems}
              userContacts={contacts}
              changeChat={handleChatChange}
              selectedChatId={currentChat?._id}
              unreadCounts={unreadCounts}
              lastMessages={lastMessages}
              createGroupMode={createGroupMode}
              groupSelectedIds={groupCreateSelection.map((c) => c._id)}
              onAddToGroupCreate={onAddToGroupCreate}
              onEnterCreateGroupMode={onEnterCreateGroupMode}
              pinnedChatIds={pinnedChatIds}
              onTogglePinChat={togglePinChat}
              blockedUserIds={Array.from(blockedUserIds)}
              onChatMenuBlock={handleChatMenuBlock}
              onChatMenuClear={handleChatMenuClear}
              onChatMenuDelete={handleChatMenuDelete}
              onChatColumnEmptyClick={handleChatColumnEmptyClick}
            />
          )}

          {/* ── Col 3: Resize handle ── */}
          <DragHandle $light={isLight} onMouseDown={handleDragStart} />

          {/* ── Col 4: Right content ── */}
          {activeTab === "status" ? (
            <BlankPane />
          ) : activeTab === "profile" ? (
            profileSection === "profile" ? <ProfileView /> : <ChatsSettingsView />
          ) : createGroupMode ? (
            <GroupCreateStaging
              selected={groupCreateSelection}
              groupName={newGroupName}
              onGroupNameChange={setNewGroupName}
              onRemoveMember={onRemoveFromGroupCreate}
              onCreate={handleCreateGroupConfirm}
              onCancel={() => {
                setCreateGroupMode(false);
                setGroupCreateSelection([]);
                setNewGroupName("");
              }}
              canCreate={groupCreateSelection.length > 1}
              creating={groupCreateLoading}
            />
          ) : currentChat === undefined ? (
            <Welcome />
          ) : (
            <ChatPane>
              <ChatContainer
                currentChat={currentChat}
                socket={socket}
                arrivalMsg={arrivalMsg}
                initialUnreadCount={currentChatUnread}
                chatRefreshKey={chatRefreshNonce}
                blockRefreshKey={blockRefreshNonce}
                onMessageSent={(preview) => handleMessageSent(currentChat._id, preview)}
                contacts={contacts}
                onDeleteChat={() => {
                  if (currentChat && !currentChat.isGroup) {
                    applyDmDeleteSideEffects(currentChat._id);
                  }
                  setCurrentChat(undefined);
                  setChatRefreshNonce((n) => n + 1);
                }}
                onRequestAddMembers={() => {
                  setGroupInfoPanelOpen(true);
                  setGroupPanelRequestAddMembers(true);
                }}
                onToggleGroupInfoPanel={
                  currentChat.isGroup ? () => setGroupInfoPanelOpen((v) => !v) : undefined
                }
                onBlockStatusChange={handleBlockStatusChange}
                onStartVoiceCall={call.startVoiceCall}
                onStartVideoCall={call.startVideoCall}
                callDisabled={call.inCall}
              />
            </ChatPane>
          )}

          {/* ── Col 5: Group info panel (conditional) ── */}
          {showGroupPanel && currentUser && (
            <GroupInfoSidePanel
              currentChat={currentChat}
              currentUserId={currentUser._id}
              allContacts={contacts}
              onSubmitAddMembers={handleSubmitAddMembersFromPanel}
              addMembersSubmitting={addMembersLoading}
              requestOpenAddMembers={groupPanelRequestAddMembers}
              onConsumedRequestAddMembers={consumeGroupPanelAddMembersRequest}
              onClosePanel={() => {
                setGroupInfoPanelOpen(false);
                setGroupPanelRequestAddMembers(false);
              }}
              onGroupProfileUpdated={handleGroupProfileUpdated}
            />
          )}
        </div>
      </Container>
    </>
  );
}

export default function Chat() {
  return (
    <ChatAppearanceProvider>
      <ChatContent />
    </ChatAppearanceProvider>
  );
}

const BlankPaneEl = styled.div`
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#171717")};
  height: 100%;
`;

const DragHandle = styled.div`
  width: 6px;
  height: 100%;
  cursor: col-resize;
  background: ${(p) => (p.$light ? "#d1d5db" : "#ffffff0d")};
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s;
  z-index: 10;

  &::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 40px;
    border-radius: 2px;
    background: transparent;
    transition: background 0.15s;
  }

  &:hover,
  &:active {
    background: ${(p) => (p.$light ? "#9ca3af" : "#6b728066")};
    &::after {
      background: ${(p) => (p.$light ? "#6b7280" : "#9ca3af")};
    }
  }
`;

const Container = styled.div`
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background-color: ${(p) => (p.$light ? "#e5e7eb" : "#171717")};
  .container {
    height: 100vh;
    width: 100vw;
    background-color: ${(p) => (p.$light ? "rgba(255,255,255,0.55)" : "#00000076")};
    display: grid;
    /* grid-template-columns driven by inline style from leftWidth state */
  }
  .container.with-group-panel {
    /* grid-template-columns driven by inline style */
  }
`;

const ChatPane = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;
