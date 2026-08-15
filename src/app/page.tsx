import { TopBar } from "@/components/layout/top-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { CategoryBar } from "@/components/layout/category-bar";
import { SiteFooter } from "@/components/layout/site-footer";
import { NewsCard } from "@/components/ui/news-card";
import { getHomeArticles } from "@/lib/supabase/queries/articles";
import { toCardView } from "@/lib/supabase/mappers";

export const dynamic = "force-dynamic";

const Home = async () => {
  const rows = await getHomeArticles();
  const articles = rows.map(toCardView);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <TopBar />
      <SiteHeader />
      <CategoryBar />

      <main className="mx-auto w-full max-w-(--container-app) flex-1 px-6 py-10">
        <h1 className="text-h2 font-bold text-text-primary">Top News</h1>

        {articles.length === 0 ? (
          <p className="mt-6 text-body-md text-text-secondary">
            No analyzed articles yet — run the pipeline to populate the feed.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Home;
