import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Check if a clerkId is a participant of a conversation */
function isParticipant(
  conv: { participantOneId: string; participantTwoId: string; isGroup?: boolean; participantIds?: string[] },
  clerkId: string,
) {
  if (conv.isGroup && conv.participantIds) {
    return conv.participantIds.includes(clerkId);
  }
  return conv.participantOneId === clerkId || conv.participantTwoId === clerkId;
}

/**
 * Send a message in a conversation. Also updates the conversation's
 * lastMessageText and lastMessageAt for sidebar previews.
 */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!isParticipant(conversation, identity.subject)) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();

    await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderClerkId: identity.subject,
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
 * Soft-delete a message the current user sent.
 * Sets deletedAt instead of removing the record.
 */
export const deleteMessage = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderClerkId !== identity.subject) {
      throw new Error("You can only delete your own messages");
    }

    await ctx.db.patch(args.messageId, { deletedAt: Date.now() });

    // If this was the last message, update conversation preview
    const conversation = await ctx.db.get(message.conversationId);
    if (conversation && conversation.lastMessageText === message.text) {
      await ctx.db.patch(message.conversationId, {
        lastMessageText: "This message was deleted",
      });
    }
  },
});

/**
 * List messages for a conversation, ordered by creation time.
 * Real-time via Convex subscription.
 */
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!isParticipant(conversation, identity.subject)) {
      throw new Error("Unauthorized");
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
  },
});
