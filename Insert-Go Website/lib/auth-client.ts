"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";
import { ssoClient } from "@better-auth/sso/client";

/** Browser-side auth client. Base URL defaults to the current origin. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient(), ssoClient()],
});

export const { useSession, signIn, signOut } = authClient;
