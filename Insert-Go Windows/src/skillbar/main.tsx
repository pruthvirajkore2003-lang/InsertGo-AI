/**
 * Entry for the selection skill bar window (skillbar.html). A separate
 * webview = a fresh JS context: stores start empty here, so SelectionBar
 * loads settings/providers itself on mount (mirroring App.tsx).
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { SelectionBar } from "@/components/SelectionBar/SelectionBar";
import "@/styles/global.css";
import "@/styles/fontawesome.css";
import "@/styles/components.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* No AuthGuard here: the guard renders null while logged out / before
        keyring hydration, which leaves this transparent window INVISIBLE while
        the backend still shows it over the selection (bar "never activates",
        and the unpainted window eats clicks). SelectionBar gates auth itself
        at click time with the "Log in to InsertGo" notice. */}
    <SelectionBar />
  </React.StrictMode>
);
