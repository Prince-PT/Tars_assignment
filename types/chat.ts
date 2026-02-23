import type { Id } from "@/convex/_generated/dataModel";

/* ────────────────────────────────────────────────────
 *  Shared types used across the chat feature.
 *  Single source of truth — never duplicate these
 *  inline in components.
 * ──────────────────────────────────────────────────── */

/** Minimal user representation attached to conversations */
export type ChatMember = {
  clerkId: string;
  name: string;
  imageUrl?: string;
};

/** Shape exposed by the sidebar list and used by the message thread */
export type ConversationItem = {
  _id: Id<"conversations">;
  isGroup?: boolean;
  groupName?: string;
  memberCount?: number;
  members?: ChatMember[];
  otherUser: ChatMember;
  lastMessageText?: string;
  lastMessageAt?: number;
};

/** The actively-selected conversation (sidebar + thread) */
export type ActiveConversation = Pick<
  ConversationItem,
  "_id" | "isGroup" | "groupName" | "memberCount" | "members" | "otherUser"
>;

/** Emoji key literal union (matches the Convex schema) */
export type EmojiKey = "thumbsup" | "heart" | "laugh" | "sad" | "angry";

/** Map of emoji keys to their unicode characters */
export const EMOJI_MAP: Record<EmojiKey, string> = {
  thumbsup: "👍",
  heart: "❤️",
  laugh: "😂",
  sad: "😢",
  angry: "😠",
} as const;
