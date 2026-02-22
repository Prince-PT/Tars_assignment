import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Typing indicators older than this are considered stale. */
const TYPING_TIMEOUT = 3_000; // 3 seconds

/**
 * Signal that the current user is typing in a conversation.
 * Called on every keystroke (debounced on the client).
 */
export const setTyping = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const clerkId = identity.subject;
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_user_conversation", (q) =>
        q.eq("clerkId", clerkId).eq("conversationId", args.conversationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { typingAt: Date.now() });
    } else {
      await ctx.db.insert("typing", {
        conversationId: args.conversationId,
        clerkId,
        typingAt: Date.now(),
      });
    }
  },
});

/**
 * Clear the typing indicator (e.g. when a message is sent).
 */
export const clearTyping = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const existing = await ctx.db
      .query("typing")
      .withIndex("by_user_conversation", (q) =>
        q.eq("clerkId", identity.subject).eq("conversationId", args.conversationId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Query who is currently typing in a conversation (excluding yourself).
 * Returns an array of clerkIds.
 */
export const whoIsTyping = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const myId = identity?.subject;

    const rows = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const now = Date.now();
    return rows
      .filter((r) => r.clerkId !== myId && now - r.typingAt < TYPING_TIMEOUT)
      .map((r) => r.clerkId);
  },
});

/**
 * Returns the set of conversation IDs where someone OTHER than the
 * current user is actively typing. Used by the sidebar.
 */
export const typingConversations = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const myId = identity.subject;
    const now = Date.now();

    // Grab every active typing row in the whole table.
    // For a small-to-medium app this is fine; for scale you'd filter on
    // the user's conversation list.
    const rows = await ctx.db.query("typing").collect();

    const ids = new Set<string>();
    for (const r of rows) {
      if (r.clerkId !== myId && now - r.typingAt < TYPING_TIMEOUT) {
        ids.add(r.conversationId as string);
      }
    }

    return Array.from(ids);
  },
});
