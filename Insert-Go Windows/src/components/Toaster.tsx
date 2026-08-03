/** Renders active toasts (SPEC §9.1). Non-blocking, auto-dismissing. */
import { useToastStore } from "@/store/toastStore";

const TOAST_ICONS: Record<string, string> = {
  info: "fa-circle-info",
  success: "fa-circle-check",
  error: "fa-circle-exclamation",
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="ig-toaster">
      {toasts.map((t) => (
        <button
          key={t.id}
          className={`ig-toast ig-toast--${t.kind}`}
          onClick={() => dismiss(t.id)}
          title="Dismiss"
        >
          <i
            className={`fa-solid ${TOAST_ICONS[t.kind] ?? "fa-circle-info"} ig-toast__icon`}
            aria-hidden="true"
          />
          <span>{t.message}</span>
        </button>
      ))}
    </div>
  );
}
