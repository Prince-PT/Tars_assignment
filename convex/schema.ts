import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  conversations: defineTable({
    participantOneId: v.optional(v.string()), // clerkId – DM dedup only
    participantTwoId: v.optional(v.string()), // clerkId – DM dedup only
    lastMessageText: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
    isGroup: v.optional(v.boolean()),
    groupName: v.optional(v.string()),
  }).index("by_pair", ["participantOneId", "participantTwoId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderClerkId: v.string(),
    text: v.string(),
    createdAt: v.number(),
    deletedAt: v.optional(v.number()),
  }).index("by_conversation", ["conversationId", "createdAt"]),

  // ── Online presence ──
  presence: defineTable({
    clerkId: v.string(),
    lastSeenAt: v.number(),
  }).index("by_clerkId", ["clerkId"]),

  // ── Typing indicators ──
  typing: defineTable({
    conversationId: v.id("conversations"),
    clerkId: v.string(),
    typingAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["clerkId", "conversationId"]),

  // ── Read status (tracks last-read timestamp per user per conversation) ──
  readStatus: defineTable({
    conversationId: v.id("conversations"),
    clerkId: v.string(),
    lastReadAt: v.number(),
  }).index("by_user_conversation", ["clerkId", "conversationId"]),

  // ── Message reactions ──
  reactions: defineTable({
    messageId: v.id("messages"),
    clerkId: v.string(),
    emoji: v.union(
      v.literal("thumbsup"),
      v.literal("heart"),
      v.literal("laugh"),
      v.literal("sad"),
      v.literal("angry"),
    ),
  })
    .index("by_message", ["messageId"])
    .index("by_message_user", ["messageId", "clerkId"]),

  // ── Conversation membership (for efficient group lookups) ──
  conversationMembers: defineTable({
    conversationId: v.id("conversations"),
    clerkId: v.string(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_member", ["conversationId", "clerkId"]),
});
