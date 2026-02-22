"use client";

import { useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef, useCallback } from "react";

const HEARTBEAT_INTERVAL = 10_000; // 10 seconds

/**
 * Sends a presence heartbeat every 10 s while the user is signed in.
 * Immediately marks the user offline on tab close / navigation away.
 * Mount once at the app root.
 */
export function usePresenceHeartbeat() {
  const { isSignedIn } = useAuth();
  const heartbeat = useMutation(api.presence.heartbeat);
  const goOffline = useMutation(api.presence.goOffline);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    // Fire-and-forget — the page is closing so we can't await
    goOffline().catch(() => {});
  }, [goOffline]);

  useEffect(() => {
    if (!isSignedIn) return;

    const ping = () => {
      heartbeat().catch(() => {});
    };

    // Immediate ping
    ping();

    // Periodic ping
    intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL);

    // Ping on focus, go offline on hidden
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        ping();
      } else {
        cleanup();
      }
    };

    // Immediately go offline when closing / navigating away
    const onBeforeUnload = () => cleanup();
    const onPageHide = () => cleanup();

    window.addEventListener("focus", ping);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("focus", ping);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("pagehide", onPageHide);
      cleanup();
    };
  }, [isSignedIn, heartbeat, cleanup]);
}
