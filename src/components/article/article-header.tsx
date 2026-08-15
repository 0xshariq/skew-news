import { BookmarkIcon, ShareIcon, MoreIcon } from "@/components/ui/icons";

interface ArticleHeaderProps {
  title: string;
  category: string;
  country: string;
  author: string;
  publishedDate: string;
  readTime: string;
}

function ActionButton({
  label,
  children,
  showLabel = false,
}: {
  label: string;
  children: React.ReactNode;
  showLabel?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex items-center gap-1.5 text-text-secondary hover:text-text-primary"
    >
      {children}
      {showLabel && <span className="text-body-sm">{label}</span>}
    </button>
  );
}

/** Breadcrumb, title, and byline row with visual save/share actions. */
export function ArticleHeader({
  title,
  category,
  country,
  author,
  publishedDate,
  readTime,
}: ArticleHeaderProps) {
  return (
    <header className="flex flex-col gap-4">
      <p className="text-caption text-text-secondary">
        {category} <span className="mx-1">·</span> {country}
      </p>

      <h1 className="text-h1 text-text-primary">{title}</h1>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-body-sm text-text-secondary">
          By {author} <span className="mx-1.5 text-border">|</span>{" "}
          {publishedDate} <span className="mx-1.5 text-border">|</span>{" "}
          {readTime}
        </p>

        <div className="flex items-center gap-4">
          <ActionButton label="Save" showLabel>
            <BookmarkIcon />
          </ActionButton>
          <ActionButton label="Share" showLabel>
            <ShareIcon />
          </ActionButton>
          <ActionButton label="More options">
            <MoreIcon />
          </ActionButton>
        </div>
      </div>
    </header>
  );
}
