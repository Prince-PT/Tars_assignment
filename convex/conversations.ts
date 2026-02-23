import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isParticipant } from "./helpers";

/**
 * Get or create a 1-on-1 conversation between the authenticated user and another user.
 * Stores participants in sorted order so (A,B) and (B,A) map to the same row.
 */
export const getOrCreate = mutation({
  args: {
    otherClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const myClerkId = identity.subject;
    const [p1, p2] = [myClerkId, args.otherClerkId].sort();

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

const MAX_GROUP_MEMBERS = 50;

/**
 * Create a group conversation with multiple members and a name.
 */
export const createGroup = mutation({
  args: {
    name: v.string(),
    memberClerkIds: v.array(v.string()), // other members (current user auto-included)
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    if (args.name.trim().length === 0) throw new Error("Group name is required");
    if (args.memberClerkIds.length < 2) throw new Error("Select at least 2 other members");

    const myClerkId = identity.subject;
    const allMembers = Array.from(
      new Set([myClerkId, ...args.memberClerkIds])
    ).sort();

    // Enforce max group size
    if (allMembers.length > MAX_GROUP_MEMBERS) {
      throw new Error(
        `Group cannot exceed ${MAX_GROUP_MEMBERS} members (got ${allMembers.length})`
      );
    }

    // Validate all member IDs exist in the users table
    const foundUsers = await Promise.all(
      allMembers.map((clerkId) =>
        ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
          .unique()
      )
    );
    const missingIds = allMembers.filter((_, i) => !foundUsers[i]);
    if (missingIds.length > 0) {
      throw new Error(
        `The following member IDs were not found: ${missingIds.join(", ")}`
      );
    }

    const convId = await ctx.db.insert("conversations", {
      isGroup: true,
      groupName: args.name.trim(),
      participantIds: allMembers,
    });

    // Insert membership rows for efficient lookups
    await Promise.all(
      allMembers.map((clerkId) =>
        ctx.db.insert("conversationMembers", { conversationId: convId, clerkId })
      )
    );

    return convId;
  },
});

/**
 * List all conversations for the authenticated user, most recent first.
 */
export const listForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const clerkId = identity.subject;

    // 1-on-1 conversations: user appears as participantOneId or participantTwoId
    const asP1 = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) =>
        q.eq("participantOneId", clerkId)
      )
      .collect();

    const asP2 = await ctx.db
      .query("conversations")
      .withIndex("by_participantTwo", (q) =>
        q.eq("participantTwoId", clerkId)
      )
      .collect();

    // Group conversations: look up via conversationMembers index
    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .collect();
    const myGroups = (
      await Promise.all(
        myMemberships.map((m) => ctx.db.get(m.conversationId))
      )
    ).filter((c): c is NonNullable<typeof c> => c != null && c.isGroup === true);

    // Deduplicate across all three sources
    const seen = new Set<string>();
    const all = [...asP1, ...asP2, ...myGroups].filter((c) => {
      if (seen.has(c._id)) return false;
      seen.add(c._id);
      return true;
    });

    // Sort by most recent message, conversations without messages go last.
    all.sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0));

    // Enrich with user profiles
    const enriched = await Promise.all(
      all.map(async (conv) => {
        if (conv.isGroup && conv.participantIds) {
          // Group conversation
          const members = await Promise.all(
            conv.participantIds
              .filter((id) => id !== clerkId)
              .slice(0, 5) // limit lookups
              .map(async (id) => {
                const u = await ctx.db
                  .query("users")
                  .withIndex("by_clerkId", (q) => q.eq("clerkId", id))
                  .unique();
                return u
                  ? { clerkId: u.clerkId, name: u.name, imageUrl: u.imageUrl }
                  : { clerkId: id, name: "Unknown", imageUrl: undefined };
              })
          );

          return {
            _id: conv._id,
            isGroup: true as const,
            groupName: conv.groupName ?? "Group",
            memberCount: conv.participantIds.length,
            members,
            // Keep otherUser for backward compat (first other member)
            otherUser: members[0] ?? { clerkId: "", name: "Group", imageUrl: undefined },
            lastMessageText: conv.lastMessageText,
            lastMessageAt: conv.lastMessageAt,
          };
        }

        // 1-on-1 conversation
        const otherClerkId =
          conv.participantOneId === clerkId
            ? conv.participantTwoId
            : conv.participantOneId;

        if (!otherClerkId) {
          return null; // skip malformed row
        }

        const otherUser = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", otherClerkId))
          .unique();

        return {
          _id: conv._id,
          isGroup: false as const,
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

    return enriched.filter((c): c is NonNullable<typeof c> => c != null);
  },
});

/**
 * Get a single conversation by ID. Verifies the authenticated user is a participant.
 */
export const getById = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const clerkId = identity.subject;
    const conv = await ctx.db.get(args.conversationId);
    if (!conv) return null;

    if (!isParticipant(conv, clerkId)) {
      throw new Error("Unauthorized");
    }

    if (conv.isGroup && conv.participantIds) {
      const members = await Promise.all(
        conv.participantIds
          .filter((id) => id !== clerkId)
          .slice(0, 5)
          .map(async (id) => {
            const u = await ctx.db
              .query("users")
              .withIndex("by_clerkId", (q) => q.eq("clerkId", id))
              .unique();
            return u
              ? { clerkId: u.clerkId, name: u.name, imageUrl: u.imageUrl }
              : { clerkId: id, name: "Unknown", imageUrl: undefined };
          })
      );

      return {
        _id: conv._id,
        isGroup: true as const,
        groupName: conv.groupName ?? "Group",
        memberCount: conv.participantIds.length,
        members,
        otherUser: members[0] ?? { clerkId: "", name: "Group", imageUrl: undefined },
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
      };
    }

    const otherClerkId =
      conv.participantOneId === clerkId
        ? conv.participantTwoId
        : conv.participantOneId;

    if (!otherClerkId) return null;

    const otherUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", otherClerkId))
      .unique();

    return {
      _id: conv._id,
      isGroup: false as const,
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
  },
});
