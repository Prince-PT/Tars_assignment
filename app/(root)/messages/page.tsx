"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { MessageThread, EmptyThread } from "@/components/message-thread";

type ActiveConversation = {
  _id: Id<"conversations">;
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
  const searchParams = useSearchParams();
  const { user } = useUser();
  const convParam = searchParams.get("conv");

  const linkedConv = useQuery(
    api.conversations.getById,
    convParam && user && !manualActive
      ? { conversationId: convParam as Id<"conversations"> }
      : "skip"
  );

  // Use manually selected conversation, or fall back to the one from the URL
  const active: ActiveConversation | null = manualActive
    ?? (linkedConv ? { _id: linkedConv._id, otherUser: linkedConv.otherUser } : null);

  const handleSelect = (conv: ActiveConversation) => {
    setManualActive(conv);
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
              onSelect={(conv) =>
                handleSelect({ _id: conv._id, otherUser: conv.otherUser })
              }
            />
          </div>
        ) : (
          /* Full-screen chat */
          <div className="flex flex-col h-full">
            <MessageThread
              conversationId={active._id}
              otherUser={active.otherUser}
              onBack={() => setManualActive(null)}
            />
          </div>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div className="hidden sm:flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border mx-4 mb-4 bg-background">
        {/* Sidebar */}
        <div className="w-80 shrink-0">
          <ConversationSidebar
            activeConversationId={active?._id ?? null}
            onSelect={(conv) =>
              handleSelect({ _id: conv._id, otherUser: conv.otherUser })
            }
          />
        </div>

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          {active ? (
            <MessageThread
              conversationId={active._id}
              otherUser={active.otherUser}
            />
          ) : (
            <EmptyThread />
          )}
        </div>
      </div>
    </>
  );
}
