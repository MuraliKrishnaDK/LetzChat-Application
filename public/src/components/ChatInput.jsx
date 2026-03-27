import React, { useState, useRef, useEffect } from "react";
import { BsMicFill } from "react-icons/bs";
import { IoMdSend } from "react-icons/io";
import { GrAttachment, GrEmoji } from "react-icons/gr";
import { IoClose } from "react-icons/io5";
import { AiOutlineFile, AiOutlineFileImage, AiOutlineVideoCamera } from "react-icons/ai";
import styled, { keyframes } from "styled-components";
import Picker from "emoji-picker-react";
import { useChatAppearance } from "../context/ChatAppearanceContext";

const ATTACH_TYPES = [
  {
    label: "Document",
    icon: <AiOutlineFile />,
    accept: ".pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx",
  },
  {
    label: "Photo",
    icon: <AiOutlineFileImage />,
    accept: "image/jpeg,image/jpg,image/png,image/gif,image/webp",
  },
  {
    label: "Video",
    icon: <AiOutlineVideoCamera />,
    accept: "video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm",
  },
];

const formatTime = (secs) => {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function ChatInput({ handleSendMsg, handleSendFile, replyingTo, onCancelReply }) {
  const { themeMode } = useChatAppearance();
  const isLight = themeMode === "light";
  const [msg, setMsg] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // file attachment state
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const fileInputRef = useRef();

  // voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  const handleEmojiPickerhideShow = () => {
    setShowEmojiPicker((prev) => !prev);
    setShowAttachMenu(false);
  };

  const handleEmojiClick = (event, emojiObject) => {
    setMsg((prev) => prev + emojiObject.emoji);
  };

  const openFilePicker = (accept) => {
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
    setShowAttachMenu(false);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      setFilePreview({ type: "image", url: URL.createObjectURL(file), name: file.name });
    } else if (file.type.startsWith("video/")) {
      setFilePreview({ type: "video", url: URL.createObjectURL(file), name: file.name });
    } else {
      setFilePreview({ type: "file", name: file.name });
    }
    e.target.value = "";
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  // ── Voice recording ──────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/ogg";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(
        () => setRecordingTime((prev) => prev + 1),
        1000
      );
    } catch (err) {
      alert("Microphone access was denied. Please allow it in your browser settings.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const sendChat = (event) => {
    event.preventDefault();
    if (audioBlob) {
      const ext = audioBlob.type.includes("ogg") ? "ogg" : "webm";
      const audioFile = new File([audioBlob], `voice-message.${ext}`, { type: audioBlob.type });
      handleSendFile(audioFile, msg.trim());
      clearAudio();
      setMsg("");
    } else if (selectedFile) {
      handleSendFile(selectedFile, msg.trim());
      clearFile();
      setMsg("");
    } else if (msg.length > 0) {
      handleSendMsg(msg, replyingTo || null);
      setMsg("");
    }
    setShowEmojiPicker(false);
  };

  const hasContent = audioBlob || selectedFile || msg.length > 0 || isRecording;

  return (
    <Container $light={isLight}>
      {/* ── Reply preview ── */}
      {replyingTo && (
        <div className="reply-bar">
          <div className="reply-bar-content">
            <span className="reply-bar-sender">{replyingTo.senderName}</span>
            <span className="reply-bar-text">
              {replyingTo.text || (replyingTo.fileType ? `[${replyingTo.fileType}]` : "")}
            </span>
          </div>
          <button className="clear-btn" onClick={onCancelReply}><IoClose /></button>
        </div>
      )}

      {/* ── File preview ── */}
      {filePreview && (
        <div className="file-preview">
          {filePreview.type === "image" && <img src={filePreview.url} alt="preview" />}
          {filePreview.type === "video" && <video src={filePreview.url} controls />}
          <div className="file-info">
            <span>{filePreview.name}</span>
            <button className="clear-btn" onClick={clearFile}>
              <IoClose />
            </button>
          </div>
        </div>
      )}

      {/* ── Audio preview ── */}
      {audioUrl && (
        <div className="file-preview audio-preview">
          <audio src={audioUrl} controls />
          <div className="file-info">
            <span>Voice message ({formatTime(recordingTime)})</span>
            <button className="clear-btn" onClick={clearAudio}>
              <IoClose />
            </button>
          </div>
        </div>
      )}

      <div className="input-row">
        {/* ── Left buttons ── */}
        <div className="button-container">
          <div className="emoji">
            <GrEmoji onClick={handleEmojiPickerhideShow} title="Emoji" />
            {showEmojiPicker && <Picker onEmojiClick={handleEmojiClick} />}
          </div>

          <div
            className="attach"
            onMouseEnter={() => setShowAttachMenu(true)}
            onMouseLeave={() => setShowAttachMenu(false)}
          >
            <GrAttachment />
            {showAttachMenu && (
              <div className="attach-menu">
                {ATTACH_TYPES.map(({ label, icon, accept }) => (
                  <button
                    key={label}
                    className="attach-option"
                    onClick={() => openFilePicker(accept)}
                    type="button"
                  >
                    <span className="attach-icon">{icon}</span>
                    <span className="attach-label">{label}</span>
                  </button>
                ))}
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileSelect}
            />
          </div>
        </div>

        {/* ── Text input + mic + send ── */}
        <form className="input-container" onSubmit={sendChat}>
          {isRecording ? (
            <div className="recording-indicator">
              <span className="rec-dot" />
              <span className="rec-label">Recording… {formatTime(recordingTime)}</span>
            </div>
          ) : (
            <input
              type="text"
              placeholder=""
              onChange={(e) => setMsg(e.target.value)}
              value={msg}
            />
          )}

          <button
            type="button"
            className={`mic-btn ${isRecording ? "recording" : ""}`}
            onClick={toggleRecording}
            title={isRecording ? "Stop recording" : "Record voice message"}
          >
            <BsMicFill />
          </button>

          <button type="submit" disabled={!hasContent} title="Send">
            <IoMdSend />
          </button>
        </form>
      </div>
    </Container>
  );
}

// ── Animations ────────────────────────────────────────────────────────────────
const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.4; transform: scale(0.75); }
`;

const micGlow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.5); }
  50%       { box-shadow: 0 0 0 6px rgba(255, 77, 77, 0); }
`;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#0a0a0c")};
  padding: 0.5rem 2rem;
  gap: 0.5rem;
  @media screen and (min-width: 720px) and (max-width: 1080px) {
    padding: 0.5rem 1rem;
  }

  /* ── Previews ── */
  .reply-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.4rem 0.8rem;
    background: #ffffff0d;
    border-left: 3px solid #6b7280;
    border-radius: 0.4rem;
    .reply-bar-content {
      flex: 1;
      min-width: 0;
      .reply-bar-sender { display: block; font-size: 0.72rem; color: #6b7280; font-weight: 600; }
      .reply-bar-text { display: block; font-size: 0.78rem; color: #ffffffaa; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    }
    .clear-btn {
      background: transparent; border: none; color: #ff4d4d; cursor: pointer; font-size: 1.1rem;
      display: flex; align-items: center; padding: 0; flex-shrink: 0;
    }
  }

  .file-preview {
    background-color: #ffffff10;
    border-radius: 0.5rem;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.8rem;
    img {
      max-height: 80px;
      max-width: 120px;
      border-radius: 0.3rem;
      object-fit: cover;
    }
    video {
      max-height: 80px;
      max-width: 160px;
      border-radius: 0.3rem;
    }
    .file-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex: 1;
      span {
        color: #d1d1d1;
        font-size: 0.85rem;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      .clear-btn {
        background: transparent;
        border: none;
        color: #ff4d4d;
        cursor: pointer;
        font-size: 1.2rem;
        display: flex;
        align-items: center;
        padding: 0;
      }
    }
  }

  .audio-preview audio {
    height: 36px;
    flex-shrink: 0;
  }

  /* ── Layout ── */
  .input-row {
    display: grid;
    align-items: center;
    grid-template-columns: 10% 90%;
    @media screen and (min-width: 720px) and (max-width: 1080px) {
      gap: 0.5rem;
    }
  }

  .button-container {
    display: flex;
    align-items: center;
    color: white;
    gap: 0.8rem;

    .emoji {
      position: relative;
      display: flex;
      align-items: center;
      svg {
        font-size: 1.3rem;
        cursor: pointer;
        display: block;
        path {
          fill: #6b7280;
          transition: fill 0.2s;
        }
        &:hover path {
          fill: #9ca3af;
        }
      }
      .emoji-picker-react {
        position: absolute;
        top: -350px;
        background-color: #0a0a0c;
        box-shadow: 0 5px 10px #6b7280;
        border-color: #6b7280;
        .emoji-scroll-wrapper::-webkit-scrollbar {
          background-color: #0a0a0c;
          width: 5px;
          &-thumb { background-color: #6b7280; }
        }
        .emoji-categories button { filter: contrast(0); }
        .emoji-search {
          background-color: transparent;
          border-color: #6b7280;
        }
        .emoji-group:before { background-color: #0a0a0c; }
      }
    }

    .attach {
      position: relative;
      display: flex;
      align-items: center;

      & > svg {
        font-size: 1.3rem;
        cursor: pointer;
        path, polyline, line { stroke: #6b7280; }
      }

      .attach-menu {
        position: absolute;
        bottom: calc(100% + 10px);
        left: 50%;
        transform: translateX(-50%);
        background-color: #252528;
        border: 1px solid #6b728055;
        border-radius: 0.75rem;
        padding: 0.4rem 0;
        display: flex;
        flex-direction: column;
        min-width: 140px;
        box-shadow: 0 -4px 20px rgba(107, 114, 128, 0.25);
        z-index: 100;

        &::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 6px solid transparent;
          border-top-color: #6b728055;
        }

        .attach-option {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.55rem 1rem;
          background: transparent;
          border: none;
          color: #d1d1d1;
          cursor: pointer;
          font-size: 0.9rem;
          text-align: left;
          transition: background 0.15s, color 0.15s;
          &:hover {
            background-color: #6b728022;
            color: #fff;
          }
          .attach-icon {
            display: flex;
            align-items: center;
            font-size: 1.1rem;
            color: #6b7280;
          }
          .attach-label { font-size: 0.88rem; letter-spacing: 0.02em; }
        }
      }
    }
  }

  /* ── Input form ── */
  .input-container {
    width: 100%;
    border-radius: 2rem;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    background-color: ${(p) => (p.$light ? "rgba(255,255,255,0.75)" : "#ffffff34")};
    border: ${(p) => (p.$light ? "1px solid #d1d5db" : "none")};
    padding: 0.5rem 0.4rem 0.5rem 0;
    min-height: 3rem;

    input {
      flex: 1;
      background-color: transparent;
      color: ${(p) => (p.$light ? "#18181b" : "white")};
      border: none;
      padding-left: 1rem;
      font-size: 1.2rem;
      min-width: 0;
      &::selection { background-color: #6b7280; }
      &:focus { outline: none; }
    }

    .recording-indicator {
      flex: 1;
      display: flex;
      align-items: center;
      gap: 0.6rem;
      padding-left: 1rem;

      .rec-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #ff4d4d;
        animation: ${pulse} 1s ease-in-out infinite;
        flex-shrink: 0;
      }

      .rec-label {
        color: #ff4d4d;
        font-size: 0.95rem;
        font-weight: 500;
      }
    }

    /* ── Mic button ── */
    .mic-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 0.3rem 0.4rem;
      border-radius: 50%;
      transition: background 0.2s;

      svg {
        font-size: 1.4rem;
        color: #6b7280;
        transition: color 0.2s;
      }

      &.recording {
        animation: ${micGlow} 1s ease-in-out infinite;
        svg { color: #ff4d4d; }
      }

      &:hover:not(.recording) svg { color: #9ca3af; }
    }

    /* ── Send button ── */
    button[type="submit"] {
      width: 1.9rem;
      height: 1.9rem;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      background-color: #6b7280;
      border: none;
      cursor: pointer;
      flex-shrink: 0;
      margin-right: 0.3rem;
      &:disabled { opacity: 0.45; cursor: default; }
      @media screen and (min-width: 720px) and (max-width: 1080px) {
        width: 1.7rem;
        height: 1.7rem;
        svg { font-size: 0.85rem; }
      }
      svg { font-size: 1rem; color: white; }
    }
  }
`;
