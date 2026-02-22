import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Mark a conversation as read up to "now".
 * Call this whenever the user opens / views a conversation.
 */
export const markRead = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const clerkId = identity.subject;
    const existing = await ctx.db
      .query("readStatus")
      .withIndex("by_user_conversation", (q) =>
        q.eq("clerkId", clerkId).eq("conversationId", args.conversationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastReadAt: Date.now() });
    } else {
      await ctx.db.insert("readStatus", {
        conversationId: args.conversationId,
        clerkId,
        lastReadAt: Date.now(),
      });
    }
  },
});

/**
 * Get unread message counts for all conversations belonging to the current user.
 * Returns a map of conversationId → unread count.
 */
export const unreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const clerkId = identity.subject;

    // Get all conversations for this user
    const asP1 = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantOneId", clerkId))
      .collect();

    const asP2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantTwo", (q) => q.eq("participantTwoId", clerkId))
      .collect();

    const allConvs = [...asP1, ...asP2];

    const counts: Record<string, number> = {};

    for (const conv of allConvs) {
      // Get this user's read status for this conversation
      const readRow = await ctx.db
        .query("readStatus")
        .withIndex("by_user_conversation", (q) =>
          q.eq("clerkId", clerkId).eq("conversationId", conv._id)
        )
        .unique();

      const lastReadAt = readRow?.lastReadAt ?? 0;

      // Count messages after lastReadAt that were NOT sent by me
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
        .collect();

      const unread = messages.filter(
        (m) => m.senderClerkId !== clerkId && m.createdAt > lastReadAt
      ).length;

      if (unread > 0) {
        counts[conv._id] = unread;
      }
    }

    return counts;
  },
});
