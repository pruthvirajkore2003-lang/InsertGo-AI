/**
 * Mounts the Inline Improve listeners for the lifetime of the app (the main
 * webview is alive-but-hidden from startup, so this hook lives in App — the
 * same always-mounted contract as the selection-review listener). The
 * catch-tolerance keeps plain `vite dev` (no Tauri events) inert.
 */
import { useEffect } from "react";
import {
  onImproveDraft,
  onImproveRoutePalette,
  onRefineContext,
  runInlineImprove,
  runInlineRefine,
} from "@/services/inlineImprove";
import { toast } from "@/store/toastStore";

export function useInlineImprove(): void {
  useEffect(() => {
    const draftSub = onImproveDraft((payload) => {
      void runInlineImprove(payload);
    }).catch(() => () => {});
    const refineSub = onRefineContext((payload) => {
      void runInlineRefine(payload);
    }).catch(() => () => {});
    const routeSub = onImproveRoutePalette(() => {
      toast.info(
        "Terminal input can't be captured — draft here and Insert pastes back"
      );
    }).catch(() => () => {});
    return () => {
      void draftSub.then((unlisten) => unlisten());
      void refineSub.then((unlisten) => unlisten());
      void routeSub.then((unlisten) => unlisten());
    };
  }, []);
}
