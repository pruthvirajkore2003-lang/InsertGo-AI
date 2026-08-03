import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { FloatingIcon } from "./components/FloatingIcon/FloatingIcon";
import { listenGlassMode, syncThemeFromBackend } from "./store/settingsStore";
import "./styles/global.css";
import "./styles/fontawesome.css";

// Runtime flag, same pattern as data-theme: the DWM acrylic backdrop only
// exists behind a real Tauri window (windowEffects is a Rust-side window-
// creation parameter). In a plain-browser Vite preview there is no acrylic,
// so global.css paints a mesh background on <body> under
// [data-runtime="browser"] for the panel's backdrop-filter to blur.
const runtime = isTauri() ? "tauri" : "browser";
document.documentElement.dataset.runtime = runtime;

// Window-label routing: the `floating-icon` window loads this same bundle
// but must mount only the launcher bubble — App wires stores, hotkeys and
// the Inline Improve pipeline, none of which may run twice.
const label = runtime === "tauri" ? getCurrentWindow().label : "main";

// Material mode from the backend (see listenGlassMode).
listenGlassMode();

// Acrylic is Windows-only (tauri.conf windowEffects; macOSPrivateApi stays
// off — App Store risk). On macOS the effect is skipped, so a translucent
// --ig-bg would expose the raw desktop; flag the platform so CSS can fall
// back to the opaque panel fill there.
if (navigator.userAgent.includes("Mac")) {
  document.documentElement.dataset.platform = "mac";
}

// The bubble never mounts App (no settings load), so it would stay on the
// dark default tokens until the first theme:apply broadcast. Pull the
// persisted theme once at startup; live changes arrive via the broadcast.
if (label === "floating-icon") void syncThemeFromBackend();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* No auth gate on the bubble: this window is created visible+alwaysOnTop
        (tauri.conf.json), so rendering null while logged out would leave an
        invisible click-eating window — and logged-out users need the launcher
        to reach the login screen. */}
    {label === "floating-icon" ? <FloatingIcon /> : <App />}
  </React.StrictMode>
);
