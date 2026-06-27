import { useState, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { getIceServers } from "../utils/APIRoutes";

/**
 * WebRTC 1:1 voice/video calls with Socket.IO signaling.
 * Attach the socket via attachSocket() after io(host) is created in Chat.jsx.
 */
export function useWebRTCCall(currentUser) {
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const callIdRef = useRef(null);
  const remoteUserIdRef = useRef(null);
  const remoteOfferRef = useRef(null);

  const [callState, setCallState] = useState("idle");
  const [remoteUser, setRemoteUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const callStateRef = useRef("idle");
  callStateRef.current = callState;

  const cleanupMedia = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    pendingCandidatesRef.current = [];
    remoteOfferRef.current = null;
    callIdRef.current = null;
    remoteUserIdRef.current = null;
    setIsMuted(false);
    setIsVideoOff(false);
  }, []);

  const resetCall = useCallback(() => {
    cleanupMedia();
    setCallState("idle");
    setRemoteUser(null);
    setIsVideoCall(false);
  }, [cleanupMedia]);

  const flushPendingCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    for (const candidate of pendingCandidatesRef.current) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch {
        /* ignore stale candidates */
      }
    }
    pendingCandidatesRef.current = [];
  }, []);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: getIceServers() });
    pc.ontrack = (event) => {
      if (event.streams[0]) setRemoteStream(event.streams[0]);
    };
    pc.onicecandidate = (event) => {
      if (
        event.candidate &&
        socketRef.current &&
        remoteUserIdRef.current &&
        currentUser
      ) {
        socketRef.current.emit("ice-candidate", {
          from: currentUser._id,
          to: remoteUserIdRef.current,
          candidate: event.candidate,
          callId: callIdRef.current,
        });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") resetCall();
    };
    pcRef.current = pc;
    return pc;
  }, [currentUser, resetCall]);

  const getMedia = useCallback(async (video) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const endCall = useCallback(() => {
    if (socketRef.current && remoteUserIdRef.current && callIdRef.current && currentUser) {
      socketRef.current.emit("call-end", {
        from: currentUser._id,
        to: remoteUserIdRef.current,
        callId: callIdRef.current,
      });
    }
    resetCall();
  }, [currentUser, resetCall]);

  const rejectCall = useCallback(() => {
    if (socketRef.current && remoteUserIdRef.current && callIdRef.current && currentUser) {
      socketRef.current.emit("call-reject", {
        from: currentUser._id,
        to: remoteUserIdRef.current,
        callId: callIdRef.current,
      });
    }
    resetCall();
  }, [currentUser, resetCall]);

  const acceptCall = useCallback(async () => {
    if (!currentUser || !remoteOfferRef.current || !remoteUserIdRef.current) return;
    try {
      const video = isVideoCall;
      const stream = await getMedia(video);
      const pc = createPeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(remoteOfferRef.current));
      await flushPendingCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit("call-answer", {
        from: currentUser._id,
        to: remoteUserIdRef.current,
        answer,
        callId: callIdRef.current,
      });
      setCallState("active");
    } catch {
      rejectCall();
    }
  }, [createPeerConnection, currentUser, flushPendingCandidates, getMedia, isVideoCall, rejectCall]);

  const startCall = useCallback(
    async (chatUser, video) => {
      if (!currentUser || !socketRef.current || callStateRef.current !== "idle") return;
      if (chatUser.isGroup) return;

      const callId = uuidv4();
      callIdRef.current = callId;
      remoteUserIdRef.current = chatUser._id;
      setRemoteUser({ _id: chatUser._id, username: chatUser.username });
      setIsVideoCall(video);
      setCallState("outgoing");

      try {
        const stream = await getMedia(video);
        const pc = createPeerConnection();
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current.emit("call-offer", {
          from: currentUser._id,
          to: chatUser._id,
          offer,
          callId,
          isVideo: video,
          callerName: currentUser.username,
        });
      } catch {
        resetCall();
      }
    },
    [createPeerConnection, currentUser, getMedia, resetCall]
  );

  const startVoiceCall = useCallback((chatUser) => startCall(chatUser, false), [startCall]);
  const startVideoCall = useCallback((chatUser) => startCall(chatUser, true), [startCall]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMuted((v) => !v);
  }, []);

  const toggleVideo = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsVideoOff((v) => !v);
  }, []);

  const attachSocket = useCallback(
    (socket) => {
      socketRef.current = socket;

      socket.on("incoming-call", ({ from, offer, callId, isVideo, callerName }) => {
        if (callStateRef.current !== "idle") {
          socket.emit("call-reject", { from: currentUser._id, to: from, callId });
          return;
        }
        callIdRef.current = callId;
        remoteUserIdRef.current = from;
        remoteOfferRef.current = offer;
        setIsVideoCall(!!isVideo);
        setRemoteUser({ _id: from, username: callerName || "Contact" });
        setCallState("incoming");
      });

      socket.on("call-accepted", async ({ answer }) => {
        try {
          const pc = pcRef.current;
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushPendingCandidates();
          setCallState("active");
        } catch {
          endCall();
        }
      });

      socket.on("ice-candidate", async ({ candidate }) => {
        const pc = pcRef.current;
        if (!pc || !candidate) return;
        if (pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {
            /* ignore */
          }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      });

      socket.on("call-rejected", () => resetCall());
      socket.on("call-ended", () => resetCall());
      socket.on("call-busy", () => resetCall());
      socket.on("call-unavailable", () => resetCall());
    },
    [currentUser, endCall, flushPendingCandidates, resetCall]
  );

  const detachSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.off("incoming-call");
      socketRef.current.off("call-accepted");
      socketRef.current.off("ice-candidate");
      socketRef.current.off("call-rejected");
      socketRef.current.off("call-ended");
      socketRef.current.off("call-busy");
      socketRef.current.off("call-unavailable");
    }
    endCall();
    socketRef.current = null;
  }, [endCall]);

  return {
    callState,
    remoteUser,
    localStream,
    remoteStream,
    isMuted,
    isVideoOff,
    isVideoCall,
    inCall: callState !== "idle",
    startVoiceCall,
    startVideoCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    attachSocket,
    detachSocket,
  };
}
