/**
 * Fetches the active-app context (process name, window title) from the backend.
 * In v1 this is a stub on the Rust side (real Win32 detection is gated on
 * approval per SPEC §14); the hook is the stable seam for future use.
 */
import { useCallback, useState } from "react";
import type { AppContext } from "@/types";
import { getActiveContext, isTauri } from "@/services/tauriBridge";

export function useActiveContext() {
  const [context, setContext] = useState<AppContext | null>(null);

  const refresh = useCallback(async () => {
    if (!isTauri()) return;
    try {
      setContext(await getActiveContext());
    } catch {
      setContext(null);
    }
  }, []);

  return { context, refresh };
}
