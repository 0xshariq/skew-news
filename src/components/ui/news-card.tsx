"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { cn } from "@/lib/utils";
import { BiasMeter } from "@/components/ui/bias-meter";
import type { NewsArticleCard } from "@/lib/types";

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

interface NewsCardProps {
  article: NewsArticleCard;
  className?: string;
}

const FRAMING_TEXT: Record<NonNullable<NewsArticleCard["biasLabel"]>, string> = {
  left: "Left",
  center: "Center",
  right: "Right",
  mixed: "Mixed",
  unclear: "Unclear",
};

/** Vertical home-grid card: image on top, framing meta below. Display-only. */
export function NewsCard({ article, className }: NewsCardProps) {
  const {
    id,
    title,
    category,
    country,
    imageUrl,
    bias,
    sources,
    source,
    publishedDate,
    sentimentLabel,
    biasLabel,
    confidence,
  } = article;

  // Prefer real per-article fields (§19); fall back to the mock card shape.
  const metaTop = source
    ? [source, publishedDate].filter(Boolean).join(" · ")
    : `${category} · ${country}`;

  const framingParts = [
    biasLabel && FRAMING_TEXT[biasLabel],
    sentimentLabel &&
      sentimentLabel.charAt(0).toUpperCase() + sentimentLabel.slice(1),
    typeof confidence === "number" && `${Math.round(confidence * 100)}%`,
  ].filter(Boolean);

  function handleClick() {
    posthog.capture("article_clicked", {
      article_id: id,
      article_title: title,
      source,
      bias_label: biasLabel,
      sentiment_label: sentimentLabel,
    });
  }

  return (
    <Link
      href={`/news/${id}`}
      onClick={handleClick}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-bg-primary p-4 shadow-sm",
        "transition-shadow hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        <span className="absolute right-2 top-2 rounded-full bg-bg-primary/90 p-1 text-text-secondary shadow-sm">
          <InfoIcon />
        </span>
      </div>

      <p className="text-caption text-text-secondary">{metaTop}</p>

      <h3 className="text-h4 font-semibold text-text-primary">{title}</h3>

      <BiasMeter
        left={bias.left}
        center={bias.center}
        right={bias.right}
        compact
        className="mt-auto"
      />

      <p className="text-caption text-text-secondary">
        {source
          ? framingParts.join(" · ")
          : `${sources} ${sources === 1 ? "source" : "sources"}`}
      </p>
    </Link>
  );
}
