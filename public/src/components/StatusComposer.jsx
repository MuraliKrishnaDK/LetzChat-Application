import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";
import axios from "axios";
import { IoClose, IoSend, IoCamera, IoVideocam, IoText, IoAttach, IoSwapHorizontal } from "react-icons/io5";
import { BsStopCircle, BsRecordCircle } from "react-icons/bs";
import { postTextStatusRoute, postMediaStatusRoute } from "../utils/APIRoutes";

const BG_COLORS = [
  "#1a1a2e", "#16213e", "#0f3460", "#533483",
  "#2d6a4f", "#1b4332", "#6d4c41", "#37474f",
  "#b5451b", "#880e4f", "#4a148c", "#0d47a1",
];

const TABS = ["text", "upload", "camera"];

export default function StatusComposer({ currentUser, isLight, onClose, onPosted }) {
  const [tab, setTab] = useState("text");

  // ── Text state ────────────────────────────────────────────────────────────
  const [textContent, setTextContent] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);

  // ── Upload state ──────────────────────────────────────────────────────────
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadCaption, setUploadCaption] = useState("");
  const fileInputRef = useRef();

  // ── Camera state ──────────────────────────────────────────────────────────
  const [cameraMode, setCameraMode] = useState("photo"); // 'photo' | 'video'
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingFront, setFacingFront] = useState(true);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [capturedUrl, setCapturedUrl] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraCaption, setCameraCaption] = useState("");

  const videoRef = useRef();
  const streamRef = useRef();
  const mediaRecorderRef = useRef();
  const chunksRef = useRef([]);
  const timerRef = useRef();

  // ── Shared ────────────────────────────────────────────────────────────────
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  // Start camera when on camera tab
  useEffect(() => {
    if (tab === "camera" && !capturedBlob) {
      startCamera();
    }
    return () => {
      if (tab !== "camera") stopCamera();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, facingFront, cameraMode]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError("");
    setCameraReady(false);
    try {
      const constraints = {
        video: {
          facingMode: facingFront ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: cameraMode === "video",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError("Camera access denied. Allow camera permissions and try again.");
    }
  }, [facingFront, cameraMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    clearInterval(timerRef.current);
  }, []);

  const handleClose = () => {
    stopCamera();
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    onClose();
  };

  // ── Capture photo ─────────────────────────────────────────────────────────
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedUrl(url);
      stopCamera();
    }, "image/jpeg", 0.92);
  };

  // ── Record video ──────────────────────────────────────────────────────────
  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const mr = new MediaRecorder(streamRef.current, { mimeType });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setCapturedBlob(blob);
      setCapturedUrl(url);
      stopCamera();
    };
    mr.start();
    mediaRecorderRef.current = mr;
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    setIsRecording(false);
    if (mediaRecorderRef.current?.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const retakeCamera = () => {
    if (capturedUrl) URL.revokeObjectURL(capturedUrl);
    setCapturedBlob(null);
    setCapturedUrl(null);
    setCameraCaption("");
    startCamera();
  };

  // ── Upload file ───────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    setError("");
  };

  // ── Post status ───────────────────────────────────────────────────────────
  const handlePost = async () => {
    setError("");
    setPosting(true);
    try {
      if (tab === "text") {
        if (!textContent.trim()) { setError("Write something first."); setPosting(false); return; }
        const { data } = await axios.post(postTextStatusRoute, {
          userId: currentUser._id,
          content: textContent,
          bgColor,
        });
        if (!data.status) { setError(data.msg || "Failed to post."); setPosting(false); return; }
        onPosted(data.data);
      } else {
        const file = tab === "upload" ? uploadFile : capturedBlob;
        const caption = tab === "upload" ? uploadCaption : cameraCaption;
        const filename = tab === "upload"
          ? (uploadFile?.name || "status.jpg")
          : (cameraMode === "photo" ? "status.jpg" : "status.webm");

        if (!file) { setError("No media selected."); setPosting(false); return; }
        const form = new FormData();
        form.append("userId", currentUser._id);
        form.append("caption", caption || "");
        form.append("status", file, filename);
        const { data } = await axios.post(postMediaStatusRoute, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (!data.status) { setError(data.msg || "Failed to post."); setPosting(false); return; }
        onPosted(data.data);
      }
      handleClose();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setPosting(false);
    }
  };

  const fmt = (s) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return ReactDOM.createPortal(
    <Overlay>
      <Modal $light={isLight}>
        {/* Header */}
        <ModalHeader $light={isLight}>
          <span>Add Status</span>
          <button type="button" className="close-btn" onClick={handleClose}><IoClose /></button>
        </ModalHeader>

        {/* Tabs */}
        <TabRow>
          {TABS.map((t) => (
            <TabBtn key={t} $active={tab === t} onClick={() => { setTab(t); setError(""); }}>
              {t === "text" ? <IoText /> : t === "upload" ? <IoAttach /> : <IoCamera />}
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </TabBtn>
          ))}
        </TabRow>

        {/* Content */}
        <Body>
          {/* ── TEXT ── */}
          {tab === "text" && (
            <TextArea style={{ background: bgColor }}>
              <textarea
                placeholder="What's on your mind?"
                value={textContent}
                maxLength={200}
                onChange={(e) => setTextContent(e.target.value)}
              />
              <div className="char-count">{textContent.length}/200</div>
              <ColorRow>
                {BG_COLORS.map((c) => (
                  <ColorDot
                    key={c}
                    style={{ background: c }}
                    $selected={bgColor === c}
                    onClick={() => setBgColor(c)}
                  />
                ))}
              </ColorRow>
            </TextArea>
          )}

          {/* ── UPLOAD ── */}
          {tab === "upload" && (
            <UploadArea $light={isLight}>
              {!uploadPreview ? (
                <DropZone $light={isLight} onClick={() => fileInputRef.current?.click()}>
                  <IoAttach className="drop-icon" />
                  <p>Click to choose a photo or video</p>
                  <span>Max 50 MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                </DropZone>
              ) : (
                <MediaPreview>
                  {uploadFile?.type?.startsWith("video") ? (
                    <video src={uploadPreview} controls />
                  ) : (
                    <img src={uploadPreview} alt="preview" />
                  )}
                  <button type="button" className="retake" onClick={() => { setUploadFile(null); setUploadPreview(null); }}>
                    Choose different
                  </button>
                </MediaPreview>
              )}
              {uploadPreview && (
                <CaptionInput
                  $light={isLight}
                  placeholder="Add a caption (optional)…"
                  value={uploadCaption}
                  maxLength={120}
                  onChange={(e) => setUploadCaption(e.target.value)}
                />
              )}
            </UploadArea>
          )}

          {/* ── CAMERA ── */}
          {tab === "camera" && (
            <CameraArea>
              {/* Mode toggle */}
              {!capturedBlob && (
                <ModeRow>
                  <ModeBtn $active={cameraMode === "photo"} onClick={() => { setCameraMode("photo"); setCapturedBlob(null); setCapturedUrl(null); }}>
                    <IoCamera /> Photo
                  </ModeBtn>
                  <ModeBtn $active={cameraMode === "video"} onClick={() => { setCameraMode("video"); setCapturedBlob(null); setCapturedUrl(null); }}>
                    <IoVideocam /> Video
                  </ModeBtn>
                </ModeRow>
              )}

              {cameraError && <ErrMsg>{cameraError}</ErrMsg>}

              {!capturedBlob ? (
                <Viewfinder>
                  <video ref={videoRef} autoPlay muted playsInline />
                  {!cameraReady && !cameraError && <LoadingLabel>Starting camera…</LoadingLabel>}
                  {/* Controls */}
                  <CameraControls>
                    <CtrlBtn type="button" title="Flip camera" onClick={() => setFacingFront((v) => !v)}>
                      <IoSwapHorizontal />
                    </CtrlBtn>

                    {cameraMode === "photo" ? (
                      <ShutterBtn type="button" disabled={!cameraReady} onClick={capturePhoto} />
                    ) : isRecording ? (
                      <RecordBtn $recording onClick={stopRecording}>
                        <BsStopCircle />
                        <span>{fmt(recordingTime)}</span>
                      </RecordBtn>
                    ) : (
                      <RecordBtn type="button" disabled={!cameraReady} onClick={startRecording}>
                        <BsRecordCircle />
                        <span>Record</span>
                      </RecordBtn>
                    )}
                  </CameraControls>
                </Viewfinder>
              ) : (
                <MediaPreview>
                  {cameraMode === "video" ? (
                    <video src={capturedUrl} controls />
                  ) : (
                    <img src={capturedUrl} alt="captured" />
                  )}
                  <button type="button" className="retake" onClick={retakeCamera}>Retake</button>
                </MediaPreview>
              )}

              {capturedBlob && (
                <CaptionInput
                  $light={isLight}
                  placeholder="Add a caption (optional)…"
                  value={cameraCaption}
                  maxLength={120}
                  onChange={(e) => setCameraCaption(e.target.value)}
                />
              )}
            </CameraArea>
          )}
        </Body>

        {/* Footer */}
        {error && <ErrorMsg>{error}</ErrorMsg>}
        <Footer>
          <PostBtn
            type="button"
            disabled={posting}
            onClick={handlePost}
          >
            {posting ? "Posting…" : <><IoSend /> Post Status</>}
          </PostBtn>
        </Footer>
      </Modal>
    </Overlay>,
    document.body
  );
}

/* ─── Styled components ─────────────────────────────────────────────────── */

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0,0,0,0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
`;

const Modal = styled.div`
  width: min(520px, 100%);
  max-height: 90vh;
  background: ${(p) => (p.$light ? "#fff" : "#18181b")};
  border-radius: 1rem;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 64px rgba(0,0,0,0.5);
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.2rem;
  border-bottom: 1px solid ${(p) => (p.$light ? "#e5e7eb" : "#ffffff12")};
  span { font-weight: 700; font-size: 1rem; color: ${(p) => (p.$light ? "#18181b" : "#fff")}; }
  .close-btn {
    background: none; border: none; color: #6b7280; font-size: 1.3rem;
    cursor: pointer; padding: 0.2rem; border-radius: 50%; display: flex;
    &:hover { color: #ef4444; }
  }
`;

const TabRow = styled.div`
  display: flex;
  border-bottom: 1px solid #ffffff12;
`;

const TabBtn = styled.button`
  flex: 1; background: none; border: none;
  padding: 0.65rem 0;
  color: ${(p) => (p.$active ? "#6b7280" : "#9ca3af")};
  font-weight: ${(p) => (p.$active ? "700" : "400")};
  font-size: 0.85rem;
  border-bottom: 2px solid ${(p) => (p.$active ? "#6b7280" : "transparent")};
  cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  transition: color 0.15s;
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  min-height: 0;
`;

const TextArea = styled.div`
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  transition: background 0.3s;
  textarea {
    width: 100%; background: transparent; border: none; outline: none;
    color: white; font-size: 1.25rem; text-align: center; resize: none;
    min-height: 120px; line-height: 1.5;
    &::placeholder { color: rgba(255,255,255,0.5); }
  }
  .char-count { font-size: 0.7rem; color: rgba(255,255,255,0.45); margin-top: 0.3rem; }
`;

const ColorRow = styled.div`
  display: flex; gap: 0.5rem; flex-wrap: wrap;
  justify-content: center; margin-top: 1rem;
`;

const ColorDot = styled.div`
  width: 1.5rem; height: 1.5rem; border-radius: 50%; cursor: pointer;
  border: 2px solid ${(p) => (p.$selected ? "#fff" : "transparent")};
  box-shadow: ${(p) => (p.$selected ? "0 0 0 2px #6b7280" : "none")};
  transition: transform 0.15s;
  &:hover { transform: scale(1.2); }
`;

const UploadArea = styled.div`
  padding: 1rem;
  display: flex; flex-direction: column; gap: 0.75rem;
`;

const DropZone = styled.div`
  border: 2px dashed ${(p) => (p.$light ? "#d1d5db" : "#ffffff25")};
  border-radius: 0.75rem;
  min-height: 160px;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; cursor: pointer; transition: border-color 0.2s;
  &:hover { border-color: #6b7280; }
  .drop-icon { font-size: 2.5rem; color: #6b7280; }
  p { color: #9ca3af; font-size: 0.9rem; margin: 0; }
  span { color: #6b7280; font-size: 0.75rem; }
`;

const MediaPreview = styled.div`
  position: relative;
  img, video {
    width: 100%; max-height: 260px; object-fit: contain;
    border-radius: 0.75rem; display: block; background: #000;
  }
  .retake {
    margin-top: 0.5rem; background: #374151; border: none; color: #d1d5db;
    padding: 0.4rem 1rem; border-radius: 2rem; cursor: pointer; font-size: 0.8rem;
    &:hover { background: #4b5563; }
  }
`;

const CaptionInput = styled.input`
  width: 100%; padding: 0.6rem 0.9rem;
  background: ${(p) => (p.$light ? "#f3f4f6" : "#27272a")};
  border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff18")};
  border-radius: 0.6rem; color: ${(p) => (p.$light ? "#18181b" : "#fff")};
  font-size: 0.88rem; outline: none;
  &::placeholder { color: #9ca3af; }
`;

const CameraArea = styled.div`
  padding: 0.75rem; display: flex; flex-direction: column; gap: 0.6rem;
`;

const ModeRow = styled.div`
  display: flex; gap: 0.5rem;
`;

const ModeBtn = styled.button`
  flex: 1; padding: 0.45rem 0; border-radius: 0.5rem; border: none;
  cursor: pointer; font-size: 0.82rem; display: flex; align-items: center;
  justify-content: center; gap: 0.35rem;
  background: ${(p) => (p.$active ? "#6b7280" : "#27272a")};
  color: ${(p) => (p.$active ? "#fff" : "#9ca3af")};
  transition: background 0.15s;
`;

const Viewfinder = styled.div`
  position: relative; border-radius: 0.75rem; overflow: hidden; background: #000;
  video { width: 100%; max-height: 280px; object-fit: cover; display: block; }
`;

const LoadingLabel = styled.div`
  position: absolute; inset: 0; display: flex; align-items: center;
  justify-content: center; color: #9ca3af; font-size: 0.85rem;
`;

const CameraControls = styled.div`
  position: absolute; bottom: 0.75rem; left: 0; right: 0;
  display: flex; align-items: center; justify-content: center; gap: 1.5rem;
`;

const CtrlBtn = styled.button`
  background: rgba(0,0,0,0.5); border: none; color: #fff;
  width: 2.4rem; height: 2.4rem; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.1rem; cursor: pointer;
`;

const ShutterBtn = styled.button`
  width: 3.5rem; height: 3.5rem; border-radius: 50%;
  background: #fff; border: 3px solid rgba(255,255,255,0.6);
  cursor: pointer; transition: transform 0.1s;
  &:hover:not(:disabled) { transform: scale(1.05); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const RecordBtn = styled.button`
  display: flex; flex-direction: column; align-items: center;
  gap: 0.2rem; background: ${(p) => (p.$recording ? "#ef4444" : "rgba(0,0,0,0.6)")};
  border: none; color: #fff; padding: 0.5rem 1rem; border-radius: 2rem;
  cursor: pointer; font-size: 1.1rem;
  span { font-size: 0.7rem; }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
`;

const ErrMsg = styled.p`
  color: #ef4444; font-size: 0.8rem; text-align: center; margin: 0 1rem;
`;

const ErrorMsg = styled.p`
  color: #ef4444; font-size: 0.8rem; text-align: center; margin: 0.5rem 1rem 0;
`;

const Footer = styled.div`
  padding: 0.9rem 1.2rem;
  border-top: 1px solid #ffffff12;
  display: flex; justify-content: flex-end;
`;

const PostBtn = styled.button`
  display: flex; align-items: center; gap: 0.5rem;
  background: #6b7280; color: #fff; border: none;
  padding: 0.65rem 1.5rem; border-radius: 2rem;
  font-size: 0.9rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s, opacity 0.15s;
  &:hover:not(:disabled) { background: #4b5563; }
  &:disabled { opacity: 0.55; cursor: not-allowed; }
`;
