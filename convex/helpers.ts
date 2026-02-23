/* ────────────────────────────────────────────────────
 *  Shared helpers used across multiple Convex modules.
 *  Keep pure utility functions here to avoid
 *  duplicating them in every mutation/query file.
 * ──────────────────────────────────────────────────── */

import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Check whether a clerkId is a member of a conversation.
 * Uses the compound by_conversation_member index for O(1) lookup.
 * Works for both DMs and groups (unified via conversationMembers).
 */
export async function isMember(
  ctx: Pick<QueryCtx, "db">,
  conversationId: Id<"conversations">,
  clerkId: string,
): Promise<boolean> {
  const row = await ctx.db
    .query("conversationMembers")
    .withIndex("by_conversation_member", (q) =>
      q.eq("conversationId", conversationId).eq("clerkId", clerkId),
    )
    .first();
  return row !== null;
}
