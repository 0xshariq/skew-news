"use client";

import posthog from "posthog-js";
import { Button } from "@/components/ui/button";

/** "Stay Informed. Stay Balanced." newsletter band. Presentational — no submit. */
export function NewsletterCta() {
  function handleSubscribeClick() {
    posthog.capture("newsletter_subscribe_clicked");
  }

  return (
    <section className="rounded-lg bg-surface p-8">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div className="max-w-md">
          <h2 className="text-h3 text-text-primary">
            Stay Informed. Stay Balanced.
          </h2>
          <p className="mt-1.5 text-body-sm text-text-secondary">
            Get the top stories and bias analysis delivered to your inbox.
          </p>
        </div>

        <div className="flex w-full max-w-md items-center gap-3">
          <input
            type="email"
            placeholder="Enter your email"
            aria-label="Email address"
            className="min-w-0 flex-1 rounded-md border border-border bg-bg-primary px-4 py-2 text-body-md text-text-primary placeholder:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          />
          <Button variant="primary" onClick={handleSubscribeClick}>Subscribe</Button>
        </div>
      </div>
    </section>
  );
}
