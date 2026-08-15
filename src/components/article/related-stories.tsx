import { RelatedStoryCard } from "@/components/ui/related-story-card";
import type { NewsArticleCard } from "@/lib/types";

interface RelatedStoriesProps {
  articles: NewsArticleCard[];
}

/**
 * "Related Stories" grid. Capped at 5 to honour AGENTS.md §20 (up to 5 similar
 * articles by cosine similarity once the real vector query replaces the mock).
 */
export function RelatedStories({ articles }: RelatedStoriesProps) {
  const items = articles.slice(0, 5);
  if (items.length === 0) return null;

  return (
    <section className="border-t border-divider pt-8">
      <h2 className="text-h3 text-text-primary">Related Stories</h2>

      <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {items.map((article) => (
          <RelatedStoryCard
            key={article.id}
            article={article}
            meta={`${article.sources} sources`}
          />
        ))}
      </div>
    </section>
  );
}
