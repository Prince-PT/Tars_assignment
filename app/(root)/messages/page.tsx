"use client";

import { Suspense, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ConversationSidebar } from "@/components/conversation-sidebar";
import { MessageThread, EmptyThread } from "@/components/message-thread";
import type { ActiveConversation, ConversationItem } from "@/types/chat";
import { MAIN_HEIGHT, SIDEBAR_WIDTH_CLASS } from "@/lib/constants";

/* ────────────────────────────────────────────────────
 *  Helper: map any conversation-shaped object into an
 *  ActiveConversation, avoiding repeated field copies.
 * ──────────────────────────────────────────────────── */
function toActive(conv: ConversationItem): ActiveConversation {
  return {
    _id: conv._id,
    otherUser: conv.otherUser,
    isGroup: conv.isGroup,
    groupName: conv.groupName,
    memberCount: conv.memberCount,
    members: conv.members,
  };
}

/* ────────────────────────────────────────────────────
 *  Lightweight regex to reject obviously-invalid IDs
 *  before casting to Id<"conversations">.
 * ──────────────────────────────────────────────────── */
function isPlausibleConvId(value: string): boolean {
  return /^[a-zA-Z0-9_-]{10,}$/.test(value);
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center"
          style={{ height: MAIN_HEIGHT }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const [manualActive, setManualActive] = useState<ActiveConversation | null>(
    null,
  );
  const [dismissed, setDismissed] = useState(false);
  const searchParams = useSearchParams();
  const { user } = useUser();
  const convParam = searchParams.get("conv");

  const shouldFetchLinked =
    !!convParam &&
    !!user &&
    !manualActive &&
    !dismissed &&
    isPlausibleConvId(convParam);

  const linkedConv = useQuery(
    api.conversations.getById,
    shouldFetchLinked
      ? { conversationId: convParam as Id<"conversations"> }
      : "skip",
  );

  // Use manually selected conversation, or fall back to the one from the URL
  const active: ActiveConversation | null =
    manualActive ??
    (linkedConv
      ? {
          _id: linkedConv._id,
          otherUser: linkedConv.otherUser,
          isGroup: linkedConv.isGroup ?? false,
          groupName: linkedConv.groupName ?? undefined,
          memberCount: linkedConv.memberCount ?? undefined,
          members: linkedConv.members ?? undefined,
        }
      : null);

  const handleSelect = useCallback((conv: ConversationItem) => {
    setDismissed(false);
    setManualActive(toActive(conv));
  }, []);

  const handleBack = useCallback(() => {
    setManualActive(null);
    setDismissed(true);
  }, []);

  return (
    <>
      {/* ── Mobile layout ── */}
      <div className="sm:hidden" style={{ height: MAIN_HEIGHT }}>
        {!active ? (
          <div className="h-full">
            <ConversationSidebar
              activeConversationId={null}
              onSelect={handleSelect}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <MessageThread
              conversationId={active._id}
              otherUser={active.otherUser}
              isGroup={active.isGroup}
              groupName={active.groupName}
              memberCount={active.memberCount}
              members={active.members}
              onBack={handleBack}
            />
          </div>
        )}
      </div>

      {/* ── Desktop layout ── */}
      <div
        className="hidden sm:flex overflow-hidden bg-background"
        style={{ height: MAIN_HEIGHT }}
      >
        <div className={`${SIDEBAR_WIDTH_CLASS} shrink-0`}>
          <ConversationSidebar
            activeConversationId={active?._id ?? null}
            onSelect={handleSelect}
          />
        </div>

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
