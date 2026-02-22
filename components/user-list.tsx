"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function UserList() {
  const users = useQuery(api.users.getAllUsers);

  if (users === undefined) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-10">
        No users have signed up yet.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((user) => (
        <div
          key={user._id}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          {user.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.name}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold text-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {user.email}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
