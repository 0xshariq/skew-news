import { notFound } from "next/navigation";

import { TopBar } from "@/components/layout/top-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { NewsletterCta } from "@/components/layout/newsletter-cta";

import { ArticleHeader } from "@/components/article/article-header";
import { ArticleHero } from "@/components/article/article-hero";
import { BiasDistribution } from "@/components/article/bias-distribution";
import { ArticleBody } from "@/components/article/article-body";
import { RelatedStories } from "@/components/article/related-stories";
import { BiasAnalysisCard } from "@/components/article/sidebar/bias-analysis-card";
import { AiSummaryCard } from "@/components/article/sidebar/ai-summary-card";
import { SourceBreakdownCard } from "@/components/article/sidebar/source-breakdown-card";

import { getArticleDetailById } from "@/lib/supabase/queries/articles";
import { toDetailView } from "@/lib/supabase/mappers";
import { ArticleViewTracker } from "@/components/posthog/article-view-tracker";

export const dynamic = "force-dynamic";

interface NewsDetailPageProps {
  params: Promise<{ id: string }>;
}

const NewsDetailPage = async ({ params }: NewsDetailPageProps) => {
  const { id } = await params;
  const row = await getArticleDetailById(id);

  if (!row) notFound();

  const article = toDetailView(row);

  return (
    <div className="flex min-h-screen flex-col bg-bg-primary">
      <ArticleViewTracker
        articleId={article.id}
        articleTitle={article.title}
        source={article.author}
        biasLabel={article.biasLabel}
        sentimentLabel={article.sentimentLabel}
      />
      <TopBar />
      <SiteHeader />

      <main className="mx-auto w-full max-w-(--container-app) flex-1 px-6 py-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Article column */}
          <article className="flex flex-col gap-6">
            <ArticleHeader
              title={article.title}
              category={article.category}
              country={article.country}
              author={article.author}
              publishedDate={article.publishedDate}
              readTime={article.readTime}
            />
            <ArticleHero
              imageUrl={article.imageUrl}
              caption={article.imageCaption}
              credit={article.imageCredit}
            />
            <BiasDistribution
              bias={article.bias}
              sourceCount={article.sourceCount}
            />
            <ArticleBody paragraphs={article.bodyParagraphs} />
            <RelatedStories articles={article.related} />
          </article>

          {/* Analysis sidebar */}
          <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            <BiasAnalysisCard
              bias={article.bias}
              biasLabel={article.biasLabel}
              sourceCount={article.sourceCount}
            />
            <AiSummaryCard
              points={article.summaryPoints}
              generated={article.summaryGenerated}
              readTime={article.summaryReadTime}
            />
            <SourceBreakdownCard
              bias={article.bias}
              sourceCount={article.sourceCount}
              topSources={article.topSources}
            />
          </aside>
        </div>

        <div className="mt-12">
          <NewsletterCta />
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default NewsDetailPage;
