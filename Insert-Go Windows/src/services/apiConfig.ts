// InsertGo.AI website — hosts the Better Auth server (PKCE sign-in, sessions).
// Override per-environment via VITE_API_URL (e.g. https://insertgo.ai in prod).
// The localhost fallback below is DEV-ONLY by construction: vite.config.ts fails
// a production build whose VITE_API_URL is unset or points at localhost, so a
// shipped bundle can never send `Authorization: Bearer <session token>` to
// whatever happens to be listening on the user's port 3000.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
