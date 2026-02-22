import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Get or create a 1-on-1 conversation between two users.
 * Stores participants in sorted order so (A,B) and (B,A) map to the same row.
 */
export const getOrCreate = mutation({
  args: {
    myClerkId: v.string(),
    otherClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const [p1, p2] = [args.myClerkId, args.otherClerkId].sort();

    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_pair", (q) =>
        q.eq("participantOneId", p1).eq("participantTwoId", p2)
      )
      .unique();

    if (existing) return existing._id;

    return await ctx.db.insert("conversations", {
      participantOneId: p1,
      participantTwoId: p2,
    });
  },
});

/**
 * List all conversations for a given user, most recent first.
 */
export const listForUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const asP1 = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) =>
        q.eq("participantOneId", args.clerkId)
      )
      .collect();

    const asP2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantTwo", (q) =>
        q.eq("participantTwoId", args.clerkId)
      )
      .collect();

    const all = [...asP1, ...asP2];

    // Sort by most recent message, conversations without messages go last.
    all.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

    // Enrich with the other user's profile
    const enriched = await Promise.all(
      all.map(async (conv) => {
        const otherClerkId =
          conv.participantOneId === args.clerkId
            ? conv.participantTwoId
            : conv.participantOneId;

        const otherUser = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", otherClerkId))
          .unique();

        return {
          _id: conv._id,
          otherUser: otherUser
            ? {
                clerkId: otherUser.clerkId,
                name: otherUser.name,
                imageUrl: otherUser.imageUrl,
              }
            : { clerkId: otherClerkId, name: "Unknown", imageUrl: undefined },
          lastMessageText: conv.lastMessageText,
          lastMessageAt: conv.lastMessageAt,
        };
      })
    );

    return enriched;
  },
});
