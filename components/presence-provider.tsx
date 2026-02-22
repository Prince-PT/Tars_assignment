"use client";

import { usePresenceHeartbeat } from "@/hooks/use-presence-heartbeat";

/**
 * Mount once in the layout to keep the presence heartbeat running.
 * Renders nothing.
 */
export function PresenceProvider() {
  usePresenceHeartbeat();
  return null;
}
