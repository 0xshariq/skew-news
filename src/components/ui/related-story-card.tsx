import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NewsArticleCard } from "@/lib/types";

interface RelatedStoryCardProps {
  article: NewsArticleCard;
  /** Small meta line, e.g. "May 29, 2026 · 8 min read". */
  meta: string;
  className?: string;
}

/** Compact horizontal related-story card: thumbnail + caption + title + meta. */
export function RelatedStoryCard({
  article,
  meta,
  className,
}: RelatedStoryCardProps) {
  const { id, title, category, country, imageUrl } = article;

  return (
    <Link
      href={`/news/${id}`}
      className={cn(
        "group flex gap-3 rounded-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-caption text-text-secondary">
          {category} <span className="mx-1">·</span> {country}
        </p>
        <h3 className="text-body-sm font-semibold text-text-primary group-hover:text-accent">
          {title}
        </h3>
        <p className="text-caption text-text-secondary">{meta}</p>
      </div>
    </Link>
  );
}
