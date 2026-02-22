"use client";

import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Plus, Search, MessageCircle, SearchX } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { OnlineIndicator } from "@/components/online-indicator";

type ConversationItem = {
  _id: Id<"conversations">;
  otherUser: {
    clerkId: string;
    name: string;
    imageUrl?: string;
  };
  lastMessageText?: string;
  lastMessageAt?: number;
};

interface ConversationSidebarProps {
  activeConversationId: Id<"conversations"> | null;
  onSelect: (conv: ConversationItem) => void;
}

export function ConversationSidebar({
  activeConversationId,
  onSelect,
}: ConversationSidebarProps) {
  const { user } = useUser();
  const conversations = useQuery(
    api.conversations.listForUser,
    user ? {} : "skip"
  );
  const allUsers = useQuery(api.users.getAllUsers);
  const getOrCreate = useMutation(api.conversations.getOrCreate);

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [search, setSearch] = useState("");
  const onlineUserIds = useQuery(api.presence.onlineUsers) ?? [];
  const unreadCounts = useQuery(
    api.readStatus.unreadCounts,
    user ? {} : "skip"
  ) ?? {};
  const typingConvIds = useQuery(
    api.typing.typingConversations,
    user ? {} : "skip"
  ) ?? [];

  const filteredConversations = conversations?.filter((c) =>
    c.otherUser.name.toLowerCase().includes(search.toLowerCase())
  );

  const otherUsers =
    allUsers?.filter((u) => u.clerkId !== user?.id) ?? [];

  const handleStartChat = async (otherClerkId: string) => {
    if (!user) return;
    const convId = await getOrCreate({
      otherClerkId,
    });

    // Find the other user's info for the callback
    const otherUser = otherUsers.find((u) => u.clerkId === otherClerkId);
    onSelect({
      _id: convId,
      otherUser: {
        clerkId: otherClerkId,
        name: otherUser?.name ?? "Unknown",
        imageUrl: otherUser?.imageUrl,
      },
      lastMessageText: undefined,
      lastMessageAt: undefined,
    });
    setNewChatOpen(false);
  };

  const formatTime = (ts?: number) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Messages</h2>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setNewChatOpen(true)}
          title="New conversation"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        {conversations === undefined ? (
          <div className="flex justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : filteredConversations && filteredConversations.length > 0 ? (
          <div className="px-2 pb-2">
            {filteredConversations.map((conv) => (
              <button
                key={conv._id}
                onClick={() => onSelect(conv as ConversationItem)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent/50",
                  activeConversationId === conv._id &&
                    "bg-accent text-accent-foreground"
                )}
              >
                <div className="relative">
                  <Avatar className="size-10 shrink-0">
                    <AvatarImage
                      src={conv.otherUser.imageUrl}
                      alt={conv.otherUser.name}
                    />
                    <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                      {conv.otherUser.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <OnlineIndicator
                    online={onlineUserIds.includes(conv.otherUser.clerkId)}
                    size="sm"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium">
                      {conv.otherUser.name}
                    </p>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatTime(conv.lastMessageAt)}
                    </span>
                  </div>
                  {typingConvIds.includes(conv._id) ? (
                    <p className="truncate text-xs text-primary mt-0.5 italic flex items-center gap-1">
                      <span className="inline-flex gap-0.5">
                        <span className="animate-bounce size-1 rounded-full bg-primary [animation-delay:0ms]" />
                        <span className="animate-bounce size-1 rounded-full bg-primary [animation-delay:150ms]" />
                        <span className="animate-bounce size-1 rounded-full bg-primary [animation-delay:300ms]" />
                      </span>
                      typing…
                    </p>
                  ) : (
                    <p className="truncate text-xs text-muted-foreground mt-0.5">
                      {conv.lastMessageText ?? "No messages yet"}
                    </p>
                  )}
                </div>
                {/* Unread badge */}
                {unreadCounts[conv._id] ? (
                  <span className="shrink-0 flex items-center justify-center min-w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1.5">
                    {unreadCounts[conv._id] > 99 ? "99+" : unreadCounts[conv._id]}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : search ? (
          <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
            <SearchX className="size-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              No matching conversations
            </p>
            <p className="text-xs text-muted-foreground/70">
              Try a different search term
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
            <MessageCircle className="size-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No conversations yet
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Start chatting by clicking the + button above
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 gap-1.5"
              onClick={() => setNewChatOpen(true)}
            >
              <Plus className="size-3.5" />
              New conversation
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* New chat command dialog */}
      <CommandDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        title="New Conversation"
        description="Select a user to start a conversation"
      >
        <CommandInput placeholder="Search users..." />
        <CommandList>
          <CommandEmpty>No users found.</CommandEmpty>
          <CommandGroup heading="Users">
            {otherUsers.map((u) => (
              <CommandItem
                key={u._id}
                value={`${u.name} ${u.email}`}
                onSelect={() => handleStartChat(u.clerkId)}
                className="cursor-pointer"
              >
                <Avatar className="size-8">
                  <AvatarImage src={u.imageUrl} alt={u.name} />
                  <AvatarFallback className="text-xs">
                    {u.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-2 min-w-0">
                  <p className="truncate text-sm font-medium">{u.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}
