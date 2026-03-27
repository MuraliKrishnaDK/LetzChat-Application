import React, { useRef } from "react";
import styled from "styled-components";
import { useChatAppearance, CHAT_WALLPAPERS, WALLPAPER_ID_CUSTOM } from "../context/ChatAppearanceContext";
import { IoMoon, IoSunny } from "react-icons/io5";
import { MdWallpaper, MdUpload } from "react-icons/md";

const MAX_WALLPAPER_BYTES = 2 * 1024 * 1024;

export default function ChatsSettingsView() {
  const { themeMode, setThemeMode, wallpaperId, setWallpaperId, setCustomWallpaper, customWallpaperDataUrl } =
    useChatAppearance();
  const isLight = themeMode === "light";
  const fileInputRef = useRef(null);

  const handleWallpaperFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > MAX_WALLPAPER_BYTES) {
      alert(`Please choose an image under ${MAX_WALLPAPER_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl === "string") setCustomWallpaper(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Container $light={isLight}>
      <div className="header">
        <h1>Chats</h1>
      </div>

      <section className="section">
        <div className="section-title">
          <MdWallpaper />
          <span>Chat wallpaper</span>
        </div>
        <div className="wallpaper-grid">
          {CHAT_WALLPAPERS.map((wp) => (
            <button
              key={wp.id}
              type="button"
              className={`wall-thumb${wallpaperId === wp.id ? " selected" : ""}`}
              title={wp.label}
              onClick={() => setWallpaperId(wp.id)}
            >
              <span className="thumb-preview" style={{ background: wp.bg }} />
              <span className="thumb-label">{wp.label}</span>
            </button>
          ))}
        </div>
        <div className={`wallpaper-upload-row${wallpaperId === WALLPAPER_ID_CUSTOM ? " selected-custom" : ""}`}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="wallpaper-file-input"
            onChange={handleWallpaperFile}
            aria-hidden
            tabIndex={-1}
          />
          <button
            type="button"
            className="wallpaper-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <MdUpload className="upload-icon" aria-hidden />
            <span>Upload</span>
          </button>
          <p className="upload-hint">Use custom wallpaper</p>
          {wallpaperId === WALLPAPER_ID_CUSTOM && customWallpaperDataUrl && (
            <div className="custom-thumb-wrap" aria-hidden>
              <span
                className="custom-thumb"
                style={{ backgroundImage: `url(${JSON.stringify(customWallpaperDataUrl)})` }}
              />
              <span className="custom-thumb-label">Custom</span>
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          {themeMode === "dark" ? <IoMoon /> : <IoSunny />}
          <span>Theme</span>
        </div>
        <div className="theme-row">
          <span className="theme-hint">Toggle for light or dark mode</span>
          <button
            type="button"
            className={`theme-toggle${themeMode === "light" ? " is-light" : ""}`}
            onClick={() => setThemeMode(themeMode === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${themeMode === "dark" ? "light" : "dark"} theme`}
          >
            <span className="knob">
              <IoMoon className="icon moon" />
              <IoSunny className="icon sun" />
            </span>
          </button>
        </div>
      </section>
    </Container>
  );
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  background-color: ${(p) => (p.$light ? "#f3f4f6" : "#171717")};
  height: 100%;
  padding: 2rem 1.75rem;
  overflow-y: auto;

  .header {
    h1 {
      color: ${(p) => (p.$light ? "#18181b" : "#ffffff")};
      font-size: 1.35rem;
      font-weight: 700;
      margin: 0;
    }
  }

  .section {
    background: ${(p) => (p.$light ? "#ffffff" : "#1f1f23")};
    border: 1px solid ${(p) => (p.$light ? "#d1d5db" : "#ffffff12")};
    border-radius: 1rem;
    padding: 1.1rem 1.2rem;
  }

  .section-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 1rem;

    svg {
      font-size: 1.1rem;
    }
  }

  .wallpaper-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
    gap: 0.75rem;
  }

  .wall-thumb {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.35rem;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    border-radius: 0.65rem;
    overflow: hidden;

    .thumb-preview {
      aspect-ratio: 1;
      border-radius: 0.55rem;
      border: 2px solid transparent;
      transition: border-color 0.15s, transform 0.15s;
    }

    .thumb-label {
      font-size: 0.72rem;
      color: ${(p) => (p.$light ? "#52525b" : "#ffffffaa")};
      text-align: center;
    }

    &:hover .thumb-preview {
      transform: scale(1.04);
    }

    &.selected .thumb-preview {
      border-color: #6b7280;
      box-shadow: 0 0 0 2px #6b728055;
    }
  }

  .wallpaper-upload-row {
    margin-top: 1.1rem;
    padding-top: 1rem;
    border-top: 1px solid ${(p) => (p.$light ? "#e5e7eb" : "#ffffff18")};
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;

    &.selected-custom {
      outline: 2px solid #6b7280;
      outline-offset: 4px;
      border-radius: 0.65rem;
      padding: 0.75rem;
      margin-left: -0.25rem;
      margin-right: -0.25rem;
    }
  }

  .wallpaper-file-input {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .wallpaper-upload-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.55rem 1.15rem;
    border-radius: 0.55rem;
    border: 1px solid #6b728055;
    background: ${(p) => (p.$light ? "#f3f4f6" : "#252528")};
    color: #6b7280;
    font-size: 0.88rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;

    .upload-icon {
      font-size: 1.15rem;
    }

    &:hover {
      background: ${(p) => (p.$light ? "#f3f4f6" : "#3f3f46")};
      border-color: #6b7280;
    }
  }

  .upload-hint {
    flex: 1 1 12rem;
    margin: 0;
    font-size: 0.78rem;
    color: ${(p) => (p.$light ? "#6b7280" : "#ffffff88")};
    line-height: 1.4;
  }

  .custom-thumb-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.3rem;
    width: 5.5rem;
    flex-shrink: 0;
  }

  .custom-thumb {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 0.55rem;
    background-size: cover;
    background-position: center;
    border: 2px solid #6b7280;
    box-shadow: 0 0 0 2px #6b728055;
  }

  .custom-thumb-label {
    font-size: 0.72rem;
    color: ${(p) => (p.$light ? "#52525b" : "#ffffffaa")};
    text-align: center;
  }

  .theme-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .theme-hint {
    color: ${(p) => (p.$light ? "#4b5563" : "#ffffff99")};
    font-size: 0.88rem;
    flex: 1;
    min-width: 10rem;
  }

  .theme-toggle {
    position: relative;
    width: 4.5rem;
    height: 2.25rem;
    border-radius: 999px;
    border: 2px solid #ffffff22;
    background: #252528;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: background 0.2s, border-color 0.2s;

    .knob {
      position: absolute;
      top: 3px;
      left: 3px;
      right: auto;
      width: 1.75rem;
      height: 1.75rem;
      border-radius: 50%;
      background: #4b5563;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: left 0.22s ease, right 0.22s ease, background 0.2s;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);

      .icon {
        position: absolute;
        font-size: 0.95rem;
        color: white;
        transition: opacity 0.15s;
      }
      .moon {
        opacity: 1;
      }
      .sun {
        opacity: 0;
      }
    }

    &.is-light {
      background: #e5e7eb;
      border-color: #9ca3af;

      .knob {
        left: auto;
        right: 3px;
        background: #f59e0b;

        .moon {
          opacity: 0;
        }
        .sun {
          opacity: 1;
        }
      }
    }
  }
`;
