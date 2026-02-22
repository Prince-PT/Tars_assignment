"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Inbox, ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState, FormEvent } from "react";
import { cn } from "@/lib/utils";
import { OnlineIndicator } from "@/components/online-indicator";
import { TypingBubble } from "@/components/typing-bubble";
import { useTypingIndicator } from "@/hooks/use-typing-indicator";

interface MessageThreadProps {
  conversationId: Id<"conversations">;
  otherUser: {
    clerkId: string;
    name: string;
    imageUrl?: string;
  };
  /** Called when the user taps back (mobile only) */
  onBack?: () => void;
}

export function MessageThread({
  conversationId,
  otherUser,
  onBack,
}: MessageThreadProps) {
  const { user } = useUser();
  const messages = useQuery(api.messages.list, { conversationId });
  const otherOnline = useQuery(api.presence.isOnline, { clerkId: otherUser.clerkId }) ?? false;
  const sendMessage = useMutation(api.messages.send);
  const { onKeystroke, clearTyping, typingClerkIds } = useTypingIndicator(conversationId);
  const markRead = useMutation(api.readStatus.markRead);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

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
      setText(trimmed); // restore on failure
    }
  };

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
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
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
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {messages === undefined ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
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
                Send a message to start your conversation with {otherUser.name}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => {
              const isMe = msg.senderClerkId === user?.id;

              return (
                <div key={msg._id}>
                  {/* Date separator */}
                  {shouldShowDateSeparator(i) && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[11px] font-medium text-muted-foreground px-2">
                        {formatDateSeparator(msg.createdAt)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "flex mb-1",
                      isMe ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md",
                      )}
                    >
                      <p>{msg.text}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-0.5 text-right",
                          isMe
                            ? "text-primary-foreground/60"
                            : "text-muted-foreground",
                        )}
                      >
                        {formatTimestamp(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Typing indicator */}
        {typingClerkIds.length > 0 && (
          <TypingBubble name={otherUser.name} />
        )}
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 p-3 border-t border-border bg-card"
      >
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.trim()) onKeystroke();
          }}
          className="flex-1"
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!text.trim()}>
          <Send className="size-4" />
        </Button>
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
