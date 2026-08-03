/**
 * Design tokens mirrored from app/globals.css (@theme block).
 * Source of truth: InsertGo-AI dark palette — Charcoal / Off-white / Cobalt.
 */
export const T = {
  bg: "#1c1c1e", // Charcoal — canvas
  dark: "#121214", // deep panels (InsertGo overlay)
  dark2: "#232329", // panel inner
  ink: "#f5f5f7", // Off-white — primary text
  muted: "rgba(245,245,247,0.68)",
  faint: "rgba(245,245,247,0.30)",
  line: "rgba(245,245,247,0.12)",
  lineSubtle: "rgba(245,245,247,0.08)",
  surface: "rgba(245,245,247,0.09)",
  card: "rgba(245,245,247,0.07)",
  accent: "#2f6bff", // Brand cobalt
  accentSoft: "rgba(47,107,255,0.26)",
  accentTint: "rgba(47,107,255,0.14)",
  accentGlow: "rgba(47,107,255,0.38)",
  brand: "#2f6bff", // kickers ride the brand cobalt
  success: "#74b478",
  danger: "#e0655c",
  tileSand: "rgba(142,142,147,0.16)",

  fontSans:
    '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI Variable Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontSerif: '"Fraunces", Georgia, serif',

  radiusPanel: 18,
  radiusGlass: 16,
  radiusCard: 12,
  radiusBtn: 9,

  shadowCardMd: "0 6px 18px rgba(0,0,0,0.28)",
  shadowOverlay:
    "0 1px 2px rgba(0,0,0,0.32), 0 12px 32px rgba(0,0,0,0.42), 0 32px 80px rgba(0,0,0,0.55)",
} as const;
