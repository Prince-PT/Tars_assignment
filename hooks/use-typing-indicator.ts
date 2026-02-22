"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCallback, useEffect, useRef } from "react";

/**
 * Hook for typing indicators in a conversation.
 *
 * Returns:
 * - `onKeystroke()` — call on every input change
 * - `clearTyping()` — call when a message is sent
 * - `typingClerkIds` — array of clerkIds currently typing (excluding self)
 */
export function useTypingIndicator(conversationId: Id<"conversations">) {
  const setTyping = useMutation(api.typing.setTyping);
  const clearTypingMut = useMutation(api.typing.clearTyping);
  const typingClerkIds = useQuery(api.typing.whoIsTyping, { conversationId }) ?? [];

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Debounced keystroke handler */
  const onKeystroke = useCallback(() => {
    // Clear the previous debounce timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Fire immediately (the mutation is idempotent — it upserts)
    setTyping({ conversationId }).catch(() => {});

    // After 2.5 s of no keystrokes, clear the indicator
    timerRef.current = setTimeout(() => {
      clearTypingMut({ conversationId }).catch(() => {});
    }, 2500);
  }, [conversationId, setTyping, clearTypingMut]);

  /** Clear typing immediately (call on send) */
  const clearTyping = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearTypingMut({ conversationId }).catch(() => {});
  }, [conversationId, clearTypingMut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTypingMut({ conversationId }).catch(() => {});
    };
  }, [conversationId, clearTypingMut]);

  return { onKeystroke, clearTyping, typingClerkIds };
}
