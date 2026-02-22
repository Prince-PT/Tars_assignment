"use client";

import { useState } from "react";
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
  const [active, setActive] = useState<ActiveConversation | null>(null);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-xl border border-border mx-4 mb-4 bg-background">
      {/* Sidebar */}
      <div className="w-80 shrink-0 hidden sm:block">
        <ConversationSidebar
          activeConversationId={active?._id ?? null}
          onSelect={(conv) =>
            setActive({ _id: conv._id, otherUser: conv.otherUser })
          }
        />
      </div>

      {/* Mobile sidebar toggle + thread */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile: show sidebar when no conversation active */}
        <div className="sm:hidden">
          {!active ? (
            <ConversationSidebar
              activeConversationId={null}
              onSelect={(conv) =>
                setActive({ _id: conv._id, otherUser: conv.otherUser })
              }
            />
          ) : (
            <div className="flex-1 flex flex-col h-[calc(100vh-4rem)]">
              <button
                onClick={() => setActive(null)}
                className="px-4 py-2 text-sm text-primary hover:underline text-left border-b border-border"
              >
                ← Back to conversations
              </button>
              <div className="flex-1 min-h-0">
                <MessageThread
                  conversationId={active._id}
                  otherUser={active.otherUser}
                />
              </div>
            </div>
          )}
        </div>

        {/* Desktop thread */}
        <div className="hidden sm:flex flex-col flex-1 min-h-0">
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
    </div>
  );
}
