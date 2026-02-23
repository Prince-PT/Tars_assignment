"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConversationSidebar, ConversationItem } from "@/components/conversation-sidebar";
import { MessageThread, EmptyThread } from "@/components/message-thread";

type ActiveConversation = {
  _id: Id<"conversations">;
  isGroup?: boolean;
  groupName?: string;
  memberCount?: number;
  members?: { clerkId: string; name: string; imageUrl?: string }[];
  otherUser: {
    clerkId: string;
    name: string;
    imageUrl?: string;
  };
};

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const [manualActive, setManualActive] = useState<ActiveConversation | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const searchParams = useSearchParams();
  const { user } = useUser();
  const convParam = searchParams.get("conv");

  const linkedConv = useQuery(
    api.conversations.getById,
    convParam && user && !manualActive && !dismissed
      ? { conversationId: convParam as Id<"conversations"> }
      : "skip"
  );

  // Use manually selected conversation, or fall back to the one from the URL
  const active: ActiveConversation | null = manualActive
    ?? (linkedConv
      ? {
          _id: linkedConv._id,
          otherUser: linkedConv.otherUser,
          isGroup: linkedConv.isGroup,
          groupName: "groupName" in linkedConv ? linkedConv.groupName : undefined,
          memberCount: "memberCount" in linkedConv ? linkedConv.memberCount : undefined,
          members: "members" in linkedConv ? linkedConv.members : undefined,
        }
      : null);

  const handleSelect = (conv: ConversationItem) => {
    setDismissed(false);
    setManualActive({
      _id: conv._id,
      otherUser: conv.otherUser,
      isGroup: conv.isGroup,
      groupName: conv.groupName,
      memberCount: conv.memberCount,
      members: conv.members,
    });
  };

  return (
    <>
      {/* ── Mobile layout ── */}
      <div className="sm:hidden h-[calc(100vh-4rem)]">
        {!active ? (
          /* Full-screen conversation list */
          <div className="h-full">
            <ConversationSidebar
              activeConversationId={null}
              onSelect={handleSelect}
            />
          </div>
        ) : (
          /* Full-screen chat */
          <div className="flex flex-col h-full">
            <MessageThread
              conversationId={active._id}
              otherUser={active.otherUser}
              isGroup={active.isGroup}
              groupName={active.groupName}
              memberCount={active.memberCount}
              members={active.members}
              onBack={() => { setManualActive(null); setDismissed(true); }}
            />
          </div>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden sm:flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
        {/* Sidebar */}
        <div className="w-80 shrink-0">
          <ConversationSidebar
            activeConversationId={active?._id ?? null}
            onSelect={handleSelect}
          />
        </div>

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          {active ? (
            <MessageThread
              conversationId={active._id}
              otherUser={active.otherUser}
              isGroup={active.isGroup}
              groupName={active.groupName}
              memberCount={active.memberCount}
              members={active.members}
            />
          ) : (
            <EmptyThread />
          )}
        </div>
      </div>
    </>
  );
}
