import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Create or update a user profile when they sign in via Clerk.
 */
export const upsertUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const clerkId = identity.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
        imageUrl: args.imageUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId,
      email: args.email,
      name: args.name,
      imageUrl: args.imageUrl,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get the current user's profile by Clerk ID.
 */
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

/**
 * Get all user profiles (for discoverability).
 */
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});
