/* ────────────────────────────────────────────────────
 *  Shared helpers used across multiple Convex modules.
 *  Keep pure utility functions here to avoid
 *  duplicating them in every mutation/query file.
 * ──────────────────────────────────────────────────── */

/** Conversation shape required by the participant check */
export type ConversationLike = {
  participantOneId?: string;
  participantTwoId?: string;
  isGroup?: boolean;
  participantIds?: string[];
};

/**
 * Check whether a given clerkId is a member of a conversation.
 * Works for both 1-on-1 and group conversations.
 */
export function isParticipant(
  conv: ConversationLike,
  clerkId: string,
): boolean {
  if (conv.isGroup && conv.participantIds) {
    return conv.participantIds.includes(clerkId);
  }
  return conv.participantOneId === clerkId || conv.participantTwoId === clerkId;
}
