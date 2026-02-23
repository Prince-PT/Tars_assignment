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

    // Unified: get all conversations via membership table
    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .collect();

    const allConvs = (
      await Promise.all(myMemberships.map((m) => ctx.db.get(m.conversationId)))
    ).filter((c): c is NonNullable<typeof c> => c != null);

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

      // Only fetch messages created after lastReadAt using the index range,
      // then filter out messages sent by the current user.
      const unreadMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", conv._id).gt("createdAt", lastReadAt)
        )
        .collect();

      const unread = unreadMessages.filter(
        (m) => m.senderClerkId !== clerkId && !m.deletedAt
      ).length;

      if (unread > 0) {
        counts[conv._id] = unread;
      }
    }

    return counts;
  },
});
