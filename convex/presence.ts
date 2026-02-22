import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";

/** How long (ms) before a user is considered offline. */
const ONLINE_THRESHOLD = 20_000; // 20 seconds

/**
 * Heartbeat — call every ~10 s from the client to stay "online".
 */
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const clerkId = identity.subject;
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now() });
    } else {
      await ctx.db.insert("presence", { clerkId, lastSeenAt: Date.now() });
    }
  },
});

/**
 * Immediately mark the current user as offline by deleting their presence row.
 * Called on tab close / navigation away.
 */
export const goOffline = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/**
 * Internal mutation called by cron to delete stale presence rows.
 * Deleting rows triggers reactive queries to re-evaluate.
 */
export const removeStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("presence").collect();
    const now = Date.now();
    for (const row of all) {
      if (now - row.lastSeenAt >= ONLINE_THRESHOLD) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

/**
 * Check whether a specific user is online.
 * Works reactively because stale records are deleted by the cron.
 */
export const isOnline = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("presence")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!row) return false;
    // Belt-and-suspenders: also check threshold in case cron hasn't run yet
    return Date.now() - row.lastSeenAt < ONLINE_THRESHOLD;
  },
});

/**
 * Return the set of currently-online clerkIds (for sidebar badges, etc.).
 */
export const onlineUsers = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("presence").collect();
    const now = Date.now();
    return all
      .filter((p) => now - p.lastSeenAt < ONLINE_THRESHOLD)
      .map((p) => p.clerkId);
  },
});
