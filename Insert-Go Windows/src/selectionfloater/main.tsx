/**
 * Entry for the selection review floater window (selfloater.html). A
 * separate webview = a fresh JS context: stores start empty here, so
 * SelectionReviewFloater loads settings/providers and auth itself on mount
 * (mirroring App.tsx and the skill bar entry).
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { SelectionReviewFloater } from "@/components/SelectionFloater/SelectionReviewFloater";
import { listenGlassMode } from "@/store/settingsStore";
import "@/styles/global.css";
import "@/styles/fontawesome.css";
import "@/styles/components.css";

// This window carries its own DWM acrylic (selection_floater.rs); react to
// the backend's acrylic/flat report so CSS can raise the tint without frost.
listenGlassMode();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* No AuthGuard (same rule as skillbar/main.tsx): the backend shows this
        transparent window, so a null render would leave it invisible but
        click-eating. Auth is enforced per run via useProviderRun's
        requiresLogin check; the floater hydrates the store itself (init()). */}
    <SelectionReviewFloater />
  </React.StrictMode>
);
