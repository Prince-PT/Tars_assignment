import type { Metadata } from "next";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { SyncUserToConvex } from "@/components/sync-user-to-convex";
import { PresenceProvider } from "@/components/presence-provider";
import { ProfileSettings } from "@/components/profile-settings";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tars_Assignment",
  description:
    "A assignment Given by Tars to test my skills in Next.js and Tailwind CSS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ConvexClientProvider>
            <SyncUserToConvex />
            <PresenceProvider />
            <header className="flex items-center justify-between p-4 h-16 border-b border-border">
              <nav className="flex items-center gap-4">
                <Link
                  href="/"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Community
                </Link>
                <Link
                  href="/messages"
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Messages
                </Link>
              </nav>
              <div className="flex items-center gap-4">
                <SignedOut>
                  <SignInButton />
                  <SignUpButton>
                    <button className="bg-[#00a884] hover:bg-[#00c49a] text-white rounded-full font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 cursor-pointer transition-colors">
                      Sign Up
                    </button>
                  </SignUpButton>
                </SignedOut>
                <SignedIn>
                  <ProfileSettings />
                  <UserButton />
                </SignedIn>
              </div>
            </header>
            {children}
          </ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
