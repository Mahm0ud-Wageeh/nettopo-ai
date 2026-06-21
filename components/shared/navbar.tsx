"use client";
import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/shared/logo";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <SignedOut>
            <Button asChild variant="ghost">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/sign-up">Get started</Link>
            </Button>
          </SignedOut>
          <SignedIn>
            <Button asChild variant="ghost">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
