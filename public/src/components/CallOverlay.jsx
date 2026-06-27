import React, { useEffect, useRef } from "react";
import styled from "styled-components";
import { BsMicMute, BsMicFill, BsCameraVideoFill, BsCameraVideoOffFill, BsTelephoneFill } from "react-icons/bs";

export default function CallOverlay({
  callState,
  remoteUser,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  isVideoCall,
  isLight,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  if (callState === "idle") return null;

  const name = remoteUser?.username || "Contact";
  const showVideo = isVideoCall && callState === "active";

  return (
    <Overlay $light={isLight}>
      <Panel $light={isLight}>
        {callState === "incoming" && (
          <>
            <StatusLabel $light={isLight}>Incoming {isVideoCall ? "video" : "voice"} call</StatusLabel>
            <CallerName $light={isLight}>{name}</CallerName>
            <AvatarRing $video={isVideoCall}>
              {isVideoCall ? <BsCameraVideoFill /> : <BsTelephoneFill />}
            </AvatarRing>
            <ActionRow>
              <RejectBtn type="button" onClick={onReject} title="Decline">
                <BsTelephoneFill />
              </RejectBtn>
              <AcceptBtn type="button" onClick={onAccept} title="Accept">
                <BsTelephoneFill />
              </AcceptBtn>
            </ActionRow>
          </>
        )}

        {callState === "outgoing" && (
          <>
            <StatusLabel $light={isLight}>Calling…</StatusLabel>
            <CallerName $light={isLight}>{name}</CallerName>
            <AvatarRing $video={isVideoCall}>
              {isVideoCall ? <BsCameraVideoFill /> : <BsTelephoneFill />}
            </AvatarRing>
            <ActionRow>
              <RejectBtn type="button" onClick={onEnd} title="Cancel">
                <BsTelephoneFill />
              </RejectBtn>
            </ActionRow>
          </>
        )}

        {callState === "active" && (
          <>
            <VideoArea $showVideo={showVideo}>
              {showVideo ? (
                <>
                  <RemoteVideo ref={remoteVideoRef} autoPlay playsInline />
                  <LocalVideo ref={localVideoRef} autoPlay playsInline muted />
                </>
              ) : (
                <VoiceOnly $light={isLight}>
                  <AvatarRing $video={false} $large>
                    <BsTelephoneFill />
                  </AvatarRing>
                  <CallerName $light={isLight}>{name}</CallerName>
                  <StatusLabel $light={isLight}>Voice call in progress</StatusLabel>
                </VoiceOnly>
              )}
            </VideoArea>
            <Controls>
              <CtrlBtn type="button" $light={isLight} $active={isMuted} onClick={onToggleMute} title={isMuted ? "Unmute" : "Mute"}>
                {isMuted ? <BsMicMute /> : <BsMicFill />}
              </CtrlBtn>
              {isVideoCall && (
                <CtrlBtn type="button" $light={isLight} $active={isVideoOff} onClick={onToggleVideo} title={isVideoOff ? "Turn camera on" : "Turn camera off"}>
                  {isVideoOff ? <BsCameraVideoOffFill /> : <BsCameraVideoFill />}
                </CtrlBtn>
              )}
              <HangUpBtn type="button" onClick={onEnd} title="End call">
                <BsTelephoneFill />
              </HangUpBtn>
            </Controls>
          </>
        )}
      </Panel>
    </Overlay>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: ${(p) => (p.$light ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.85)")};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Panel = styled.div`
  width: min(420px, 100%);
  background: ${(p) => (p.$light ? "#ffffff" : "#1a1a1e")};
  border-radius: 1rem;
  padding: 2rem 1.5rem 1.5rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
`;

const StatusLabel = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: ${(p) => (p.$light ? "#6b7280" : "#a1a1aa")};
`;

const CallerName = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
  text-align: center;
`;

const AvatarRing = styled.div`
  width: ${(p) => (p.$large ? "5rem" : "4rem")};
  height: ${(p) => (p.$large ? "5rem" : "4rem")};
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => (p.$large ? "2rem" : "1.5rem")};
  color: white;
  background: ${(p) => (p.$video ? "linear-gradient(135deg, #3b82f6, #2563eb)" : "linear-gradient(135deg, #22c55e, #16a34a)")};
  margin: 0.5rem 0 1rem;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 2rem;
  margin-top: 0.5rem;
`;

const circleBtn = `
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  cursor: pointer;
  color: white;
  transition: transform 0.15s, opacity 0.15s;
  &:hover { transform: scale(1.06); opacity: 0.92; }
`;

const AcceptBtn = styled.button`
  ${circleBtn}
  background: #22c55e;
  svg { transform: rotate(-135deg); }
`;

const RejectBtn = styled.button`
  ${circleBtn}
  background: #ef4444;
  svg { transform: rotate(135deg); }
`;

const VideoArea = styled.div`
  width: 100%;
  position: relative;
  border-radius: 0.75rem;
  overflow: hidden;
  background: #0a0a0c;
  min-height: ${(p) => (p.$showVideo ? "240px" : "auto")};
`;

const RemoteVideo = styled.video`
  width: 100%;
  height: 240px;
  object-fit: cover;
  display: block;
  background: #111;
`;

const LocalVideo = styled.video`
  position: absolute;
  bottom: 0.75rem;
  right: 0.75rem;
  width: 96px;
  height: 72px;
  object-fit: cover;
  border-radius: 0.5rem;
  border: 2px solid rgba(255, 255, 255, 0.85);
  background: #222;
`;

const VoiceOnly = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 0;
  gap: 0.5rem;
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
  align-items: center;
  justify-content: center;
`;

const CtrlBtn = styled.button`
  ${circleBtn}
  background: ${(p) => (p.$active ? "#ef4444" : p.$light ? "#e5e7eb" : "#374151")};
  color: ${(p) => (p.$active ? "white" : p.$light ? "#374151" : "#f3f4f6")};
  width: 2.75rem;
  height: 2.75rem;
  font-size: 1rem;
`;

const HangUpBtn = styled.button`
  ${circleBtn}
  background: #ef4444;
  svg { transform: rotate(135deg); }
`;
