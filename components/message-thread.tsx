"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare } from "lucide-react";
import { useEffect, useRef, useState, FormEvent } from "react";
import { cn } from "@/lib/utils";

interface MessageThreadProps {
  conversationId: Id<"conversations">;
  otherUser: {
    clerkId: string;
    name: string;
    imageUrl?: string;
  };
}

export function MessageThread({
  conversationId,
  otherUser,
}: MessageThreadProps) {
  const { user } = useUser();
  const messages = useQuery(api.messages.list, { conversationId });
  const sendMessage = useMutation(api.messages.send);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || !user) return;

    setText("");
    try {
      await sendMessage({
        conversationId,
        text: trimmed,
      });
    } catch {
      setText(trimmed); // restore on failure
    }
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
        <Avatar className="size-9">
          <AvatarImage src={otherUser.imageUrl} alt={otherUser.name} />
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
            {otherUser.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-semibold text-foreground">{otherUser.name}</h3>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        {messages === undefined ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <MessageSquare className="size-10 opacity-40" />
            <p className="text-sm">
              No messages yet. Say hi to {otherUser.name}!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => {
              const isMe = msg.senderClerkId === user?.id;
              const showTimestamp =
                i === 0 ||
                msg.createdAt - messages[i - 1].createdAt > 5 * 60 * 1000;

              return (
                <div key={msg._id}>
                  {showTimestamp && (
                    <p className="text-center text-[11px] text-muted-foreground my-3">
                      {new Date(msg.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      at {formatTime(msg.createdAt)}
                    </p>
                  )}
                  <div
                    className={cn(
                      "flex mb-1",
                      isMe ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        isMe
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 p-3 border-t border-border bg-card"
      >
        <Input
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
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
    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
      <MessageSquare className="size-16 opacity-30" />
      <p className="text-lg font-medium">Select a conversation</p>
      <p className="text-sm">
        Choose a conversation from the sidebar or start a new one.
      </p>
    </div>
  );
}
