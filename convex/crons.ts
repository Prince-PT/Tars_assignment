import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Every 10 seconds, delete presence rows older than 20 s.
// This triggers reactive queries to re-evaluate, flipping users to "offline".
crons.interval("cleanup stale presence", { seconds: 10 }, internal.presence.removeStale);

export default crons;
