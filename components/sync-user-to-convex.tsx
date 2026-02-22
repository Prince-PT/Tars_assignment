"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

/**
 * Syncs the current Clerk user to Convex on sign-in.
 * Renders nothing — mount it anywhere inside both ClerkProvider and ConvexProvider.
 */
export function SyncUserToConvex() {
  const { user, isSignedIn } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    const name =
      user.fullName ||
      `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
      user.username ||
      "Anonymous";

    upsertUser({
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name,
      imageUrl: user.imageUrl,
    });
  }, [isSignedIn, user, upsertUser]);

  return null;
}
