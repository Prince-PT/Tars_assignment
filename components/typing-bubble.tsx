"use client";

/**
 * Animated "..." bubble shown when the other user is typing.
 */
export function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 px-1 py-1">
      <div className="flex gap-1 rounded-[7.5px] rounded-tl-[3px] bg-[#202c33] px-3 py-2">
        <span className="size-[5px] rounded-full bg-[#8696a0] animate-bounce [animation-delay:0ms]" />
        <span className="size-[5px] rounded-full bg-[#8696a0] animate-bounce [animation-delay:150ms]" />
        <span className="size-[5px] rounded-full bg-[#8696a0] animate-bounce [animation-delay:300ms]" />
      </div>
      <span className="text-xs text-[#8696a0]">
        {name}{name.includes(",") ? " are" : " is"} typing
      </span>
    </div>
  );
}
