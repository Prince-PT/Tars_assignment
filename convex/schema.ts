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
    participantOneId: v.string(), // clerkId
    participantTwoId: v.string(), // clerkId
    lastMessageText: v.optional(v.string()),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_participant", ["participantOneId"])
    .index("by_participantTwo", ["participantTwoId"])
    .index("by_pair", ["participantOneId", "participantTwoId"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderClerkId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_conversation", ["conversationId", "createdAt"]),
});
