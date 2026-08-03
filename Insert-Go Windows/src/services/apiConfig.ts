// InsertGo.AI website — hosts the Better Auth server (PKCE sign-in, sessions).
// Override per-environment via VITE_API_URL (e.g. https://insertgo.ai in prod).
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
