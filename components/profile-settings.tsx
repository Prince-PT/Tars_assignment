"use client";

import { useState, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Camera, Loader2, Trash2, Settings } from "lucide-react";
import { MAX_AVATAR_SIZE } from "@/lib/constants";

export function ProfileSettings() {
  const { user: clerkUser } = useUser();
  const convexUser = useQuery(
    api.users.getUserByClerkId,
    clerkUser ? { clerkId: clerkUser.id } : "skip",
  );

  const generateUploadUrl = useMutation(api.users.generateUploadUrl);
  const updateProfile = useMutation(api.users.updateProfile);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* Populate form when dialog opens */
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && convexUser) {
        setName(convexUser.name ?? "");
        setPreviewUrl(convexUser.imageUrl ?? null);
        setSelectedFile(null);
        setRemoveAvatar(false);
        setError(null);
      }
      setOpen(next);
    },
    [convexUser],
  );

  /* Handle file selection */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    // Validate size (max 5 MB)
    if (file.size > MAX_AVATAR_SIZE) {
      setError("Image must be under 5 MB.");
      return;
    }

    setSelectedFile(file);
    setRemoveAvatar(false);
    setError(null);

    // Create local preview
    const reader = new FileReader();
    reader.onload = () => setPreviewUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  /* Remove avatar */
  const handleRemoveAvatar = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setRemoveAvatar(true);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* Save profile */
  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      let storageId: Id<"_storage"> | undefined;

      // Upload the new file if one was selected
      if (selectedFile) {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": selectedFile.type },
          body: selectedFile,
        });
        if (!res.ok) throw new Error("Upload failed");
        const json = await res.json();
        storageId = json.storageId as Id<"_storage">;
      }

      await updateProfile({
        name: name.trim() || undefined,
        storageId,
        removeAvatar,
      });

      setOpen(false);
    } catch (err) {
      console.error("Profile update failed:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Derive display values — always compute so the tree is stable
  const displayUrl = previewUrl ?? convexUser?.imageUrl;
  const initials = (convexUser?.name ?? clerkUser?.fullName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Always render the Dialog so Radix's ID counter stays stable across
  // server and client (avoids hydration-mismatch for downstream dialogs).
  if (!clerkUser) {
    return (
      <Dialog open={false}>
        <DialogTrigger asChild>
          <button
            className="flex items-center justify-center rounded-full w-8 h-8 hover:bg-[#2a3942] transition-colors cursor-pointer"
            aria-label="Profile settings"
            disabled
          >
            <Settings className="h-4 w-4 text-[#aebac1]" />
          </button>
        </DialogTrigger>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          className="flex items-center justify-center rounded-full w-8 h-8 hover:bg-[#2a3942] transition-colors cursor-pointer"
          aria-label="Profile settings"
        >
          <Settings className="h-4 w-4 text-[#aebac1]" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-[#111b21] border-[#313d45] text-[#e9edef]">
        <DialogHeader>
          <DialogTitle className="text-[#e9edef]">Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* ── Avatar preview + upload ── */}
          <div className="relative group">
            <Avatar className="h-24 w-24">
              {displayUrl ? (
                <AvatarImage src={displayUrl} alt="Avatar" />
              ) : null}
              <AvatarFallback className="bg-[#2a3942] text-[#e9edef] text-2xl">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Overlay camera icon */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              aria-label="Change avatar"
            >
              <Camera className="h-6 w-6 text-white" />
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Remove avatar button */}
          {displayUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="flex items-center gap-1.5 text-xs text-[#8696a0] hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3 w-3" />
              Remove photo
            </button>
          )}

          {/* ── Name input ── */}
          <div className="w-full space-y-2">
            <label
              htmlFor="profile-name"
              className="text-sm font-medium text-[#8696a0]"
            >
              Display name
            </label>
            <Input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              maxLength={64}
              className="bg-[#2a3942] border-[#313d45] text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-[#00a884]/50 focus-visible:border-[#00a884]"
            />
          </div>

          {/* ── Email (read-only) ── */}
          <div className="w-full space-y-2">
            <label className="text-sm font-medium text-[#8696a0]">Email</label>
            <p className="text-sm text-[#8696a0] px-3 py-2 bg-[#2a3942] rounded-md border border-[#313d45]">
              {convexUser?.email ?? clerkUser.primaryEmailAddress?.emailAddress}
            </p>
          </div>

          {/* ── Error message ── */}
          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          {/* ── Save ── */}
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#00a884] hover:bg-[#00c49a] text-white cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
