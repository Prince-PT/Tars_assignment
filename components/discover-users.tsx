"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Search, Users, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type ConvexUser = {
  _id: string;
  clerkId: string;
  email: string;
  name: string;
  imageUrl?: string;
  createdAt: number;
};

export function DiscoverUsers() {
  const { user: currentUser } = useUser();
  const users = useQuery(api.users.getAllUsers);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ConvexUser | null>(null);
  const getOrCreate = useMutation(api.conversations.getOrCreate);
  const router = useRouter();

  const otherUsers = users?.filter((u) => u.clerkId !== currentUser?.id) ?? [];

  const handleSendMessage = async (otherClerkId: string) => {
    if (!currentUser) return;
    await getOrCreate({
      myClerkId: currentUser.id,
      otherClerkId,
    });
    setSelectedUser(null);
    router.push("/messages");
  };

  return (
    <>
      {/* Search trigger button */}
      <Button
        variant="outline"
        className="w-full sm:w-72 justify-start gap-2 text-muted-foreground"
        onClick={() => setSearchOpen(true)}
      >
        <Search className="size-4" />
        <span>Search people...</span>
        <kbd className="pointer-events-none ml-auto hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
          ⌘K
        </kbd>
      </Button>

      {/* Command palette search */}
      <CommandDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        title="Discover People"
        description="Search community members by name or email"
      >
        <CommandInput placeholder="Search by name or email..." />
        <CommandList>
          <CommandEmpty>No users found.</CommandEmpty>
          <CommandGroup heading="Community Members">
            {otherUsers.map((user) => (
              <CommandItem
                key={user._id}
                value={`${user.name} ${user.email}`}
                onSelect={() => {
                  setSelectedUser(user as ConvexUser);
                  setSearchOpen(false);
                }}
                className="cursor-pointer"
              >
                <Avatar className="size-8">
                  <AvatarImage src={user.imageUrl} alt={user.name} />
                  <AvatarFallback className="text-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-2 flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>

      {/* Profile detail dialog */}
      <Dialog
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User Profile</DialogTitle>
            <DialogDescription>Member details</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <>
              <UserProfileCard user={selectedUser} />
              <div className="flex justify-center pb-2">
                <Button
                  onClick={() => handleSendMessage(selectedUser.clerkId)}
                  className="gap-2"
                >
                  <MessageSquare className="size-4" />
                  Send Message
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Grid of user cards */}
      <section className="mt-6">
        {users === undefined ? (
          <div className="flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : otherUsers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Users className="size-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No other members yet. Share the app to grow your community!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherUsers.map((user) => (
              <button
                key={user._id}
                onClick={() => setSelectedUser(user as ConvexUser)}
                className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md hover:border-primary/30 hover:bg-accent/30 cursor-pointer text-left"
              >
                <Avatar className="size-12 ring-2 ring-background shadow-sm">
                  <AvatarImage src={user.imageUrl} alt={user.name} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground group-hover:text-primary transition-colors">
                    {user.name}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function UserProfileCard({ user }: { user: ConvexUser }) {
  const joinedDate = new Date(user.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <Avatar className="size-20 ring-4 ring-background shadow-lg">
        <AvatarImage src={user.imageUrl} alt={user.name} />
        <AvatarFallback className="bg-primary text-primary-foreground font-bold text-2xl">
          {user.name.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="text-center space-y-1">
        <h3 className="text-xl font-semibold text-foreground">{user.name}</h3>
        <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-sm">
          <Mail className="size-3.5" />
          <span>{user.email}</span>
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-2">
        <Badge variant="secondary">Member</Badge>
        <span className="text-xs text-muted-foreground">
          Joined {joinedDate}
        </span>
      </div>
    </div>
  );
}
