import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const STORAGE_THEME = "LetzChat-chat-theme";
const STORAGE_WALLPAPER = "LetzChat-chat-wallpaper";
const STORAGE_CUSTOM_WALLPAPER = "LetzChat-chat-wallpaper-custom";

/** Use uploaded image as wallpaper */
export const WALLPAPER_ID_CUSTOM = "custom";

export const CHAT_WALLPAPERS = [
  { id: "default", label: "Default", bg: "#171717" },
  {
    id: "aurora",
    label: "Aurora",
    bg: "linear-gradient(145deg, #0c0c0e 0%, #3f3f46 45%, #27272a 100%)",
  },
  {
    id: "nebula",
    label: "Nebula",
    bg: "linear-gradient(160deg, #18181b 0%, #404040 40%, #0f0f12 100%)",
  },
  {
    id: "ocean",
    label: "Ocean",
    bg: "linear-gradient(180deg, #0a0a0c 0%, #2a2a2e 50%, #171717 100%)",
  },
  {
    id: "ember",
    label: "Ember",
    bg: "linear-gradient(165deg, #1a0a0a 0%, #3d1f1f 45%, #1f0f1a 100%)",
  },
];

function loadTheme() {
  try {
    const v = localStorage.getItem(STORAGE_THEME);
    return v === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function loadCustomWallpaper() {
  try {
    const v = localStorage.getItem(STORAGE_CUSTOM_WALLPAPER);
    return v && v.startsWith("data:image/") ? v : null;
  } catch {
    return null;
  }
}

function loadWallpaper() {
  try {
    const v = localStorage.getItem(STORAGE_WALLPAPER);
    if (v === WALLPAPER_ID_CUSTOM) {
      return loadCustomWallpaper() ? WALLPAPER_ID_CUSTOM : "default";
    }
    if (v && CHAT_WALLPAPERS.some((w) => w.id === v)) return v;
  } catch {
    /* ignore */
  }
  return "default";
}

function cssBackgroundFromDataUrl(dataUrl) {
  if (!dataUrl) return "";
  const escaped = dataUrl.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `url('${escaped}') center/cover no-repeat`;
}

const ChatAppearanceContext = createContext(null);

export function ChatAppearanceProvider({ children }) {
  const [themeMode, setThemeModeState] = useState(loadTheme);
  const [wallpaperId, setWallpaperIdState] = useState(loadWallpaper);
  const [customWallpaperDataUrl, setCustomWallpaperState] = useState(loadCustomWallpaper);

  const setThemeMode = useCallback((mode) => {
    const next = mode === "light" ? "light" : "dark";
    setThemeModeState(next);
    try {
      localStorage.setItem(STORAGE_THEME, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setWallpaperId = useCallback((id) => {
    if (id !== WALLPAPER_ID_CUSTOM && !CHAT_WALLPAPERS.some((w) => w.id === id)) return;
    setWallpaperIdState(id);
    try {
      localStorage.setItem(STORAGE_WALLPAPER, id);
    } catch {
      /* ignore */
    }
  }, []);

  const setCustomWallpaper = useCallback((dataUrl) => {
    if (!dataUrl || typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return;
    try {
      localStorage.setItem(STORAGE_CUSTOM_WALLPAPER, dataUrl);
      localStorage.setItem(STORAGE_WALLPAPER, WALLPAPER_ID_CUSTOM);
    } catch {
      alert("Could not save image. Try a smaller file (under ~2 MB).");
      return;
    }
    setCustomWallpaperState(dataUrl);
    setWallpaperIdState(WALLPAPER_ID_CUSTOM);
  }, []);

  const getChatMessagesBackground = useCallback(
    (forActiveChat = true) => {
      if (!forActiveChat) {
        return themeMode === "light" ? "#f3f4f6" : "#171717";
      }

      if (wallpaperId === WALLPAPER_ID_CUSTOM && customWallpaperDataUrl) {
        const imgBg = cssBackgroundFromDataUrl(customWallpaperDataUrl);
        if (themeMode === "light") {
          return `linear-gradient(0deg, rgba(248, 250, 252, 0.88), rgba(248, 250, 252, 0.88)), ${imgBg}`;
        }
        return imgBg;
      }

      const wp = CHAT_WALLPAPERS.find((w) => w.id === wallpaperId) || CHAT_WALLPAPERS[0];
      if (themeMode === "light") {
        return `linear-gradient(0deg, rgba(248, 250, 252, 0.93), rgba(248, 250, 252, 0.93)), ${wp.bg}`;
      }
      return wp.bg;
    },
    [themeMode, wallpaperId, customWallpaperDataUrl]
  );

  const value = useMemo(
    () => ({
      themeMode,
      setThemeMode,
      wallpaperId,
      setWallpaperId,
      setCustomWallpaper,
      customWallpaperDataUrl,
      getChatMessagesBackground,
    }),
    [
      themeMode,
      setThemeMode,
      wallpaperId,
      setWallpaperId,
      setCustomWallpaper,
      customWallpaperDataUrl,
      getChatMessagesBackground,
    ]
  );

  return (
    <ChatAppearanceContext.Provider value={value}>{children}</ChatAppearanceContext.Provider>
  );
}

export function useChatAppearance() {
  const ctx = useContext(ChatAppearanceContext);
  if (!ctx) {
    return {
      themeMode: "dark",
      setThemeMode: () => {},
      wallpaperId: "default",
      setWallpaperId: () => {},
      setCustomWallpaper: () => {},
      customWallpaperDataUrl: null,
      getChatMessagesBackground: (forActiveChat = true) =>
        !forActiveChat ? "#171717" : "#171717",
    };
  }
  return ctx;
}
