"use client";

/**
 * Animated "..." bubble shown when the other user is typing.
 */
export function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex gap-1 rounded-2xl bg-muted px-3.5 py-2.5 rounded-bl-md">
        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
        <span className="size-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-muted-foreground">{name} is typing</span>
    </div>
  );
}
