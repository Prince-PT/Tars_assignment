import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/* ────────────────────────────────────────────────────────
 *  Generate an upload URL so the client can PUT a file
 *  directly into Convex storage.
 * ──────────────────────────────────────────────────────── */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/* ────────────────────────────────────────────────────────
 *  Update name and/or avatar for the current user.
 *  Accepts either a Convex storageId (from an upload) or
 *  a plain imageUrl string.
 * ──────────────────────────────────────────────────────── */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    removeAvatar: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const clerkId = identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!user) throw new Error("User not found");

    const patch: Record<string, unknown> = {};

    if (args.name !== undefined && args.name.trim().length > 0) {
      patch.name = args.name.trim();
    }

    if (args.removeAvatar) {
      patch.imageUrl = undefined;
    } else if (args.storageId) {
      const url = await ctx.storage.getUrl(args.storageId);
      if (!url) throw new Error("Failed to retrieve uploaded file URL");
      patch.imageUrl = url;
    }

    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(user._id, patch);
    }

    return user._id;
  },
});

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
