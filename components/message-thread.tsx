"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Inbox, ArrowLeft, Trash2, AlertCircle, RotateCcw, Users } from "lucide-react";
import { useEffect, useRef, useState, useCallback, FormEvent } from "react";
import { cn } from "@/lib/utils";
import { OnlineIndicator } from "@/components/online-indicator";
import { TypingBubble } from "@/components/typing-bubble";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";
import { ReactionBar } from "@/components/reaction-bar";

interface MessageThreadProps {
  conversationId: Id<"conversations">;
  otherUser: {
    clerkId: string;
    name: string;
    imageUrl?: string;
  };
  /** Group chat fields */
  isGroup?: boolean;
  groupName?: string;
  memberCount?: number;
  members?: { clerkId: string; name: string; imageUrl?: string }[];
  /** Called when the user taps back (mobile only) */
  onBack?: () => void;
}

export function MessageThread({
  conversationId,
  otherUser,
  isGroup,
  groupName,
  memberCount,
  members,
  onBack,
}: MessageThreadProps) {
  const { user } = useUser();
  const messages = useQuery(api.messages.list, { conversationId });
  const otherOnline = useQuery(
    api.presence.isOnline,
    !isGroup ? { clerkId: otherUser.clerkId } : "skip",
  ) ?? false;
  const sendMessage = useMutation(api.messages.send);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const { onKeystroke, clearTyping, typingClerkIds } = useTypingIndicator(conversationId);
  const markRead = useMutation(api.readStatus.markRead);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reactions query — batched by all message ids in view
  const messageIds = messages?.map((m) => m._id) ?? [];
  const reactions = useQuery(
    api.reactions.getForMessages,
    messageIds.length > 0 ? { messageIds } : "skip",
  ) ?? {};

  // Failed messages for retry
  const [failedMessages, setFailedMessages] = useState<
    { id: string; text: string; timestamp: number }[]
  >([]);

  /** Lookup sender name for group chat messages */
  const getSenderName = (senderClerkId: string) => {
    if (senderClerkId === user?.id) return "You";
    if (isGroup && members) {
      const member = members.find((m) => m.clerkId === senderClerkId);
      return member?.name ?? "Unknown";
    }
    return otherUser.name;
  };

  // Auto-scroll when new messages arrive or typing indicator appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length, typingClerkIds.length]);

  // Mark conversation as read when opened or when new messages arrive
  useEffect(() => {
    if (conversationId && messages && messages.length > 0) {
      markRead({ conversationId }).catch(() => {});
    }
  }, [conversationId, messages?.length, markRead]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    setText("");
    clearTyping();
    try {
      await sendMessage({
        conversationId,
        text: trimmed,
      });
    } catch {
      // Add to failed messages list for retry
      setFailedMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), text: trimmed, timestamp: Date.now() },
      ]);
    }
  };

  const handleRetry = useCallback(
    async (failedMsg: { id: string; text: string }) => {
      // Remove from failed list first
      setFailedMessages((prev) => prev.filter((m) => m.id !== failedMsg.id));
      try {
        await sendMessage({
          conversationId,
          text: failedMsg.text,
        });
      } catch {
        // Re-add on failure
        setFailedMessages((prev) => [
          ...prev,
          { id: failedMsg.id, text: failedMsg.text, timestamp: Date.now() },
        ]);
      }
    },
    [sendMessage, conversationId],
  );

  const handleDismissFailedMessage = useCallback((id: string) => {
    setFailedMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteMessage = useCallback(
    async (messageId: Id<"messages">) => {
      if (!window.confirm("Delete this message? This can't be undone.")) return;
      setDeleteError(null);
      try {
        await deleteMessage({ messageId });
      } catch {
        setDeleteError(messageId);
        setTimeout(() => setDeleteError(null), 3000);
      }
    },
    [deleteMessage],
  );

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  /** Returns a date label like "Today", "Yesterday", or "Feb 15, 2025" */
  const formatDateSeparator = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();

    const stripTime = (d: Date) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    const diff = stripTime(now) - stripTime(date);

    if (diff === 0) return "Today";
    if (diff === 86_400_000) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
    });
  };

  /** Check whether we should render a date separator before this message */
  const shouldShowDateSeparator = (idx: number) => {
    if (!messages) return false;
    const msg = messages[idx];
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    const d1 = new Date(prev.createdAt).toDateString();
    const d2 = new Date(msg.createdAt).toDateString();
    return d1 !== d2;
  };

  return (
    <div className="flex flex-col h-full bg-[#0b141a]">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#313d45] bg-[#202c33]">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 -ml-2"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <ArrowLeft className="size-5" />
          </Button>
        )}
        {isGroup ? (
          <>
            <div className="size-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Users className="size-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground leading-tight">{groupName ?? "Group"}</h3>
              <p className="text-[11px] text-muted-foreground">
                {memberCount ?? members?.length ?? 0} members
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <Avatar className="size-9">
                <AvatarImage src={otherUser.imageUrl} alt={otherUser.name} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                  {otherUser.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <OnlineIndicator online={otherOnline} size="sm" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground leading-tight">{otherUser.name}</h3>
              {otherOnline && (
                <p className="text-[11px] text-emerald-500 font-medium">Online</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3 py-1">
        {messages === undefined ? (
          /* Skeleton loaders while loading */
          <div className="space-y-4 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  i % 3 === 0 ? "justify-start" : "justify-end",
                )}
              >
                <div
                  className={cn(
                    "rounded-[7.5px] px-2.5 py-1.5 space-y-1",
                    i % 3 === 0 ? "bg-[#1f2c34]" : "bg-[#005c4b]/40",
                  )}
                  style={{ width: `${40 + (i % 3) * 15}%` }}
                >
                  <div className="h-3 rounded bg-muted-foreground/15 animate-pulse" />
                  {i % 2 === 0 && (
                    <div className="h-3 w-2/3 rounded bg-muted-foreground/15 animate-pulse" />
                  )}
                  <div className="h-2 w-12 rounded bg-muted-foreground/10 animate-pulse ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <div className="rounded-full bg-muted p-4">
              <MessageSquare className="size-8 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                No messages yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Send a message to start your conversation{isGroup ? "" : ` with ${otherUser.name}`}
              </p>
            </div>
          </div>
        ) : (
          <div>
            {messages.map((msg, i) => {
              const isMe = msg.senderClerkId === user?.id;
              const isDeleted = !!msg.deletedAt;
              const hasReactions = (reactions[msg._id] ?? []).length > 0;

              // Check if same sender as previous for visual grouping
              const prevMsg = i > 0 ? messages[i - 1] : null;
              const sameSenderAsPrev =
                prevMsg &&
                prevMsg.senderClerkId === msg.senderClerkId &&
                !shouldShowDateSeparator(i) &&
                msg.createdAt - prevMsg.createdAt < 120_000; // within 2 min

              return (
                <div
                  key={msg._id}
                  className={cn(i > 0 && (sameSenderAsPrev ? "mt-0.5" : "mt-2.5"))}
                >
                  {/* Date separator */}
                  {shouldShowDateSeparator(i) && (
                    <div className="flex justify-center my-3">
                      <span className="text-[12.5px] text-muted-foreground bg-muted px-3 py-1 rounded-[7.5px] shadow-sm">
                        {formatDateSeparator(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex group/msg items-end gap-1",
                      isMe ? "justify-end" : "justify-start",
                    )}
                  >
                    {/* Delete button — appears on hover, positioned beside the bubble */}
                    {isMe && !isDeleted && (
                      <button
                        onClick={() => handleDeleteMessage(msg._id)}
                        className="opacity-0 group-hover/msg:opacity-100 transition-opacity mb-2 p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive"
                        title="Delete message"
                      >
                        <Trash2 className="size-3.5" />
                        {deleteError === msg._id && (
                          <span className="absolute -top-6 right-0 text-[10px] text-destructive bg-card px-2 py-0.5 rounded shadow-sm whitespace-nowrap">
                            Failed to delete
                          </span>
                        )}
                      </button>
                    )}
                    <div className="max-w-[65%]">
                      <div
                        className={cn(
                          "rounded-[7.5px] px-2.5 py-1.5 text-[14.2px] leading-4.75",
                          isDeleted
                            ? "bg-[#1a2630] text-[#8696a0]"
                            : isMe
                              ? "bg-[#005c4b] text-[#e9edef]"
                              : "bg-[#1f2c34] text-[#e9edef]",
                          !isDeleted && !sameSenderAsPrev && isMe && "rounded-tr-[3px]",
                          !isDeleted && !sameSenderAsPrev && !isMe && "rounded-tl-[3px]",
                        )}
                      >
                        {/* Sender name in group chats */}
                        {isGroup && !isMe && !isDeleted && !sameSenderAsPrev && (
                          <p className="text-[12.8px] font-medium text-primary mb-0.5">
                            {getSenderName(msg.senderClerkId)}
                          </p>
                        )}
                        {isDeleted ? (
                          <p className="italic text-muted-foreground text-[13px]">
                            This message was deleted
                          </p>
                        ) : (
                          <p className="whitespace-pre-wrap wrap-break-word">{msg.text}</p>
                        )}
                        <p
                          className={cn(
                            "text-[11px] mt-0.5 text-right select-none leading-none",
                            isDeleted
                              ? "text-muted-foreground/50"
                              : isMe
                                ? "text-[#ffffff99]"
                                : "text-[#8696a0]",
                          )}
                        >
                          {formatTimestamp(msg.createdAt)}
                        </p>
                      </div>

                      {/* Reactions — only show bar if there are reactions, hide add button until hover */}
                      {!isDeleted && (
                        <div
                          className={cn(
                            "-mt-0.5",
                            isMe ? "flex justify-end" : "flex justify-start",
                            // Hide the entire bar when empty, show on hover
                            !hasReactions && "opacity-0 group-hover/msg:opacity-100 transition-opacity",
                          )}
                        >
                          <ReactionBar
                            messageId={msg._id}
                            reactions={reactions[msg._id] ?? []}
                            isMe={isMe}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Failed messages with retry */}
        {failedMessages.map((fm) => (
          <div key={fm.id} className="flex justify-end mb-2">
            <div className="max-w-[65%]">
              <div className="rounded-[7.5px] rounded-tr-[3px] px-2.5 py-1.5 text-[14.2px] leading-4.75 bg-[#005c4b] border-l-2 border-destructive/60">
                <p className="text-[#e9edef]">{fm.text}</p>
                <div className="flex items-center justify-end gap-3 mt-2 pt-1.5 border-t border-destructive/10">
                  <span className="inline-flex items-center gap-1 text-[11px] text-destructive/80">
                    <AlertCircle className="size-3" />
                    Failed to send
                  </span>
                  <button
                    onClick={() => handleRetry(fm)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <RotateCcw className="size-3" />
                    Retry
                  </button>
                  <button
                    onClick={() => handleDismissFailedMessage(fm.id)}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typingClerkIds.length > 0 && (
          <TypingBubble name={otherUser.name} />
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 px-3 py-1.5 bg-[#202c33]"
      >
        <Input
          placeholder="Type a message"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) onKeystroke();
          }}
          className="flex-1 rounded-lg bg-[#2a3942] border-0 text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="flex items-center justify-center size-10 rounded-full bg-[#00a884] hover:bg-[#00c49a] text-white disabled:opacity-40 transition-colors shrink-0"
        >
          <Send className="size-4.5" />
        </button>
      </form>
    </div>
  );
}

/** Shown when no conversation is selected */
export function EmptyThread() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
      <div className="rounded-full bg-muted p-5">
        <Inbox className="size-12 text-muted-foreground/50" />
      </div>
      <div>
        <p className="text-lg font-semibold text-foreground">No conversation selected</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Pick a conversation from the sidebar or start a new one to begin messaging.
        </p>
      </div>
    </div>
  );
}
