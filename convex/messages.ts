import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Send a message in a conversation. Also updates the conversation's
 * lastMessageText and lastMessageAt for sidebar previews.
 */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderClerkId: v.string(),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderClerkId: args.senderClerkId,
      text: args.text,
      createdAt: now,
    });

    // Update conversation preview
    await ctx.db.patch(args.conversationId, {
      lastMessageText: args.text,
      lastMessageAt: now,
    });
  },
});

/**
 * List messages for a conversation, ordered by creation time.
 * Real-time via Convex subscription.
 */
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();
  },
});
