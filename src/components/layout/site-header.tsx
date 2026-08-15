"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

function MenuIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: "Home", href: "/", active: true, dot: false },
  { label: "For You", href: "/", active: false, dot: true },
  { label: "Local", href: "/", active: false, dot: false },
  { label: "Blindspot", href: "/", active: false, dot: false },
];

/** Sticky site header: menu, wordmark, primary nav, auth actions. Presentational. */
export function SiteHeader() {
  function handleSignUpClick() {
    posthog.capture("sign_up_clicked");
  }

  function handleSignInClick() {
    posthog.capture("sign_in_clicked");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-bg-primary">
      <div className="mx-auto flex h-[72px] max-w-(--container-app) items-center gap-6 px-6">
        <button aria-label="Open menu" className="text-text-primary">
          <MenuIcon />
        </button>

        <Link href="/" className="flex items-baseline gap-1.5">
          <span className="text-h2 font-bold text-text-primary">Skew</span>
          <span className="text-body-sm text-text-secondary">News</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-7 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "relative text-body-md text-text-secondary hover:text-text-primary",
                item.active &&
                  "font-semibold text-text-primary after:absolute after:-bottom-[26px] after:left-0 after:h-0.5 after:w-full after:bg-text-primary",
              )}
            >
              {item.label}
              {item.dot && (
                <span className="absolute -right-2 -top-1 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Show when="signed-out">
            <SignUpButton>
              <Button variant="primary" size="sm" onClick={handleSignUpClick}>
                Subscribe
              </Button>
            </SignUpButton>
            <SignInButton>
              <Button variant="secondary" size="sm" onClick={handleSignInClick}>
                Login
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  );
}
