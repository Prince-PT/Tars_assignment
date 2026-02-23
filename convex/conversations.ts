import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { isMember } from "./helpers";

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

    if (existing) {
      // Ensure membership rows exist (guards against pre-migration DMs)
      for (const clerkId of [myClerkId, args.otherClerkId]) {
        const row = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation_member", (q) =>
            q.eq("conversationId", existing._id).eq("clerkId", clerkId),
          )
          .first();
        if (!row) {
          await ctx.db.insert("conversationMembers", {
            conversationId: existing._id,
            clerkId,
          });
        }
      }
      return existing._id;
    }

    const convId = await ctx.db.insert("conversations", {
      participantOneId: p1,
      participantTwoId: p2,
    });

    // Insert membership rows for the new DM
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      clerkId: myClerkId,
    });
    await ctx.db.insert("conversationMembers", {
      conversationId: convId,
      clerkId: args.otherClerkId,
    });

    return convId;
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

    // Unified: get all conversations via membership table (single code path)
    const myMemberships = await ctx.db
      .query("conversationMembers")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .collect();

    const conversations = (
      await Promise.all(myMemberships.map((m) => ctx.db.get(m.conversationId)))
    ).filter((c): c is NonNullable<typeof c> => c != null);

    // Sort by most recent message, conversations without messages go last.
    conversations.sort(
      (a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0),
    );

    // Enrich with member profiles
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const memberRows = await ctx.db
          .query("conversationMembers")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conv._id),
          )
          .collect();

        const otherClerkIds = memberRows
          .map((m) => m.clerkId)
          .filter((id) => id !== clerkId);

        const otherMembers = await Promise.all(
          otherClerkIds.slice(0, 5).map(async (id) => {
            const u = await ctx.db
              .query("users")
              .withIndex("by_clerkId", (q) => q.eq("clerkId", id))
              .unique();
            return u
              ? { clerkId: u.clerkId, name: u.name, imageUrl: u.imageUrl }
              : { clerkId: id, name: "Unknown", imageUrl: undefined };
          }),
        );

        if (conv.isGroup) {
          return {
            _id: conv._id,
            isGroup: true as const,
            groupName: conv.groupName ?? "Group",
            memberCount: memberRows.length,
            members: otherMembers,
            otherUser: otherMembers[0] ?? {
              clerkId: "unknown",
              name: "Group",
              imageUrl: undefined,
            },
            lastMessageText: conv.lastMessageText,
            lastMessageAt: conv.lastMessageAt,
          };
        }

        // 1-on-1 conversation — skip if no other member found
        if (otherMembers.length === 0) return null;

        return {
          _id: conv._id,
          isGroup: false as const,
          otherUser: otherMembers[0],
          lastMessageText: conv.lastMessageText,
          lastMessageAt: conv.lastMessageAt,
        };
      }),
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

    if (!(await isMember(ctx, args.conversationId, clerkId))) {
      throw new Error("Unauthorized");
    }

    // Get members from the unified membership table
    const memberRows = await ctx.db
      .query("conversationMembers")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conv._id))
      .collect();

    const otherClerkIds = memberRows
      .map((m) => m.clerkId)
      .filter((id) => id !== clerkId);

    const otherMembers = await Promise.all(
      otherClerkIds.slice(0, 5).map(async (id) => {
        const u = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", id))
          .unique();
        return u
          ? { clerkId: u.clerkId, name: u.name, imageUrl: u.imageUrl }
          : { clerkId: id, name: "Unknown", imageUrl: undefined };
      }),
    );

    if (conv.isGroup) {
      return {
        _id: conv._id,
        isGroup: true as const,
        groupName: conv.groupName ?? "Group",
        memberCount: memberRows.length,
        members: otherMembers,
        otherUser: otherMembers[0] ?? {
          clerkId: "unknown",
          name: "Group",
          imageUrl: undefined,
        },
        lastMessageText: conv.lastMessageText,
        lastMessageAt: conv.lastMessageAt,
      };
    }

    // 1-on-1 — if no other member, the conversation is malformed
    if (otherMembers.length === 0) return null;

    return {
      _id: conv._id,
      isGroup: false as const,
      otherUser: otherMembers[0],
      lastMessageText: conv.lastMessageText,
      lastMessageAt: conv.lastMessageAt,
    };
  },
});
