"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { SmilePlus } from "lucide-react";
import { useState, useRef, useEffect } from "react";

const EMOJI_MAP: Record<string, string> = {
  thumbsup: "👍",
  heart: "❤️",
  laugh: "😂",
  sad: "😢",
  angry: "😠",
};

type EmojiKey = "thumbsup" | "heart" | "laugh" | "sad" | "angry";

interface ReactionBarProps {
  messageId: Id<"messages">;
  reactions: { emoji: string; count: number; userReacted: boolean }[];
  isMe: boolean;
}

export function ReactionBar({ messageId, reactions, isMe }: ReactionBarProps) {
  const toggleReaction = useMutation(api.reactions.toggle);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const [error, setError] = useState<string | null>(null);

  const handleToggle = async (emoji: EmojiKey) => {
    setError(null);
    try {
      await toggleReaction({ messageId, emoji });
      setPickerOpen(false);
    } catch (err) {
      console.error(`Failed to toggle reaction ${emoji} on ${messageId}:`, err);
      setError(`Couldn't react ${EMOJI_MAP[emoji]}`);
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 flex-wrap relative",
        isMe ? "justify-end" : "justify-start",
      )}
    >
      {error && (
        <span className="absolute -top-5 left-0 text-[10px] text-destructive bg-card px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-50">
          {error}
        </span>
      )}
      {/* Existing reactions */}
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => handleToggle(r.emoji as EmojiKey)}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-all hover:scale-105",
            r.userReacted
              ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
              : "bg-muted/60 text-muted-foreground hover:bg-muted",
          )}
          title={`${r.emoji} (${r.count})`}
        >
          <span className="text-sm">{EMOJI_MAP[r.emoji] ?? r.emoji}</span>
          <span className="font-medium tabular-nums">{r.count}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className={cn(
            "inline-flex items-center justify-center size-6 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-all",
            pickerOpen && "bg-muted text-foreground",
          )}
          title="Add reaction"
        >
          <SmilePlus className="size-3.5" />
        </button>

        {pickerOpen && (
          <div
            className={cn(
              "absolute z-50 bottom-full mb-1.5 flex gap-0.5 rounded-xl border border-border bg-popover p-1 shadow-xl",
              isMe ? "right-0" : "left-0",
            )}
          >
            {Object.entries(EMOJI_MAP).map(([key, emoji]) => (
              <button
                key={key}
                onClick={() => handleToggle(key as EmojiKey)}
                className="text-lg hover:scale-110 active:scale-95 transition-transform p-1.5 rounded-lg hover:bg-accent"
                title={key}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
