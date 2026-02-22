"use client";

import { useUser, useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

/**
 * Syncs the current Clerk user to Convex on sign-in.
 * Renders nothing — mount it anywhere inside both ClerkProvider and ConvexProvider.
 */
export function SyncUserToConvex() {
  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const upsertUser = useMutation(api.users.upsertUser);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    // Debug: check if Clerk can produce a "convex" JWT
    getToken({ template: "convex" }).then((t) => {
      console.log("[SyncUserToConvex] convex JWT:", t ? `${t.slice(0, 30)}...` : "NULL — JWT template 'convex' not configured in Clerk Dashboard");
    });

    const name =
      user.fullName ||
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      user.username ||
      "Anonymous";

    upsertUser({
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name,
      imageUrl: user.imageUrl,
    }).catch((err) => console.error("Failed to sync user to Convex:", err));
  }, [isSignedIn, user, upsertUser, getToken]);

  return null;
}
