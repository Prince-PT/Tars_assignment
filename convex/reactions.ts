import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const EMOJI_VALUES = v.union(
  v.literal("thumbsup"),
  v.literal("heart"),
  v.literal("laugh"),
  v.literal("sad"),
  v.literal("angry"),
);

const EMOJI_DISPLAY: Record<string, string> = {
  thumbsup: "👍",
  heart: "❤️",
  laugh: "😂",
  sad: "😢",
  angry: "😠",
};

/**
 * Toggle a reaction on a message.
 * If the user already reacted with this emoji, remove it; otherwise add it.
 * When adding, also sends a message with the emoji into the conversation.
 */
export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: EMOJI_VALUES,
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    // Check user already reacted with this emoji
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_user", (q) =>
        q.eq("messageId", args.messageId).eq("clerkId", identity.subject)
      )
      .collect();

    const sameEmoji = existing.find((r) => r.emoji === args.emoji);

    if (sameEmoji) {
      // Remove the reaction (toggle off)
      await ctx.db.delete(sameEmoji._id);
    } else {
      // Add the reaction
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        clerkId: identity.subject,
        emoji: args.emoji,
      });

      // Update sidebar preview to show the reaction
      const message = await ctx.db.get(args.messageId);
      if (message) {
        const emojiChar = EMOJI_DISPLAY[args.emoji] ?? args.emoji;
        await ctx.db.patch(message.conversationId, {
          lastMessageText: `Reacted ${emojiChar}`,
          lastMessageAt: Date.now(),
        });
      }
    }
  },
});

/**
 * Get all reactions for a list of messages (batched for efficiency).
 * Returns a map of messageId -> { emoji, count, userReacted }[]
 */
export const getForMessages = query({
  args: { messageIds: v.array(v.id("messages")) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const result: Record<
      string,
      { emoji: string; count: number; userReacted: boolean }[]
    > = {};

    for (const messageId of args.messageIds) {
      const reactions = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .collect();

      // Group by emoji
      const emojiMap: Record<
        string,
        { count: number; userReacted: boolean }
      > = {};

      for (const r of reactions) {
        if (!emojiMap[r.emoji]) {
          emojiMap[r.emoji] = { count: 0, userReacted: false };
        }
        emojiMap[r.emoji].count++;
        if (r.clerkId === identity.subject) {
          emojiMap[r.emoji].userReacted = true;
        }
      }

      const entries = Object.entries(emojiMap).map(([emoji, data]) => ({
        emoji,
        ...data,
      }));

      if (entries.length > 0) {
        result[messageId] = entries;
      }
    }

    return result;
  },
});
