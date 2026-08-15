import type { NewsArticleCard, NewsArticleDetail } from "@/lib/types";

/**
 * Placeholder home-page stories. Shaped like the eventual Supabase query result so
 * the presentational cards don't change when real data replaces this source.
 * Display-only — no scraping, analysis, or pipeline state here (AGENTS.md §5).
 */
export const MOCK_ARTICLES: NewsArticleCard[] = [
  {
    id: "1",
    title: "Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report",
    category: "Politics",
    country: "United States",
    imageUrl:
      "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800&q=80",
    bias: { left: 20, center: 31, right: 49 },
    sources: 12,
  },
  {
    id: "2",
    title:
      "Researchers Make Case for Grapes as a 'Superfood' After Review of Health Evidence",
    category: "Health",
    country: "United States",
    imageUrl:
      "https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800&q=80",
    bias: { left: 18, center: 42, right: 40 },
    sources: 7,
  },
  {
    id: "3",
    title: "CERN Finds High-Significance Hint of Physics Beyond Standard Model",
    category: "Science",
    country: "Switzerland",
    imageUrl:
      "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=800&q=80",
    bias: { left: 18, center: 62, right: 22 },
    sources: 8,
  },
  {
    id: "4",
    title:
      "Indigenous Leader Brooklyn Rivera Dies in Nicaragua After Nearly 3 Years of Detention",
    category: "World",
    country: "Nicaragua",
    imageUrl:
      "https://images.unsplash.com/photo-1594708767771-a7502209ff51?w=800&q=80",
    bias: { left: 54, center: 28, right: 18 },
    sources: 63,
  },
  {
    id: "5",
    title:
      "UN Security Council to Hold Emergency Meeting as Israel Pushes Deeper into Lebanon",
    category: "World",
    country: "Middle East",
    imageUrl:
      "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=800&q=80",
    bias: { left: 22, center: 35, right: 43 },
    sources: 15,
  },
  {
    id: "6",
    title: "Oil Prices Dip as OPEC+ Considers Output Increase Amid Weak Demand",
    category: "Business",
    country: "Global",
    imageUrl:
      "https://images.unsplash.com/photo-1545262810-77515befe149?w=800&q=80",
    bias: { left: 25, center: 50, right: 28 },
    sources: 11,
  },
  {
    id: "7",
    title: "SpaceX Launches Starship Test Flight in Milestone for Mars Program",
    category: "Technology",
    country: "United States",
    imageUrl:
      "https://images.unsplash.com/photo-1517976487492-5750f3195933?w=800&q=80",
    bias: { left: 12, center: 45, right: 49 },
    sources: 9,
  },
  {
    id: "8",
    title: "Apple Unveils AI-Powered Features Across iPhone, iPad and Mac",
    category: "Business",
    country: "United States",
    imageUrl:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80",
    bias: { left: 15, center: 40, right: 45 },
    sources: 10,
  },
  {
    id: "9",
    title:
      "2025 on Track to Be Among Top 3 Hottest Years, EU Climate Service Says",
    category: "Climate",
    country: "Global",
    imageUrl:
      "https://images.unsplash.com/photo-1601297183305-6df142704ea2?w=800&q=80",
    bias: { left: 33, center: 34, right: 33 },
    sources: 14,
  },
  {
    id: "10",
    title: "Fed Holds Rates Steady, Signals Caution on Inflation and Growth Outlook",
    category: "Economy",
    country: "United States",
    imageUrl:
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80",
    bias: { left: 30, center: 45, right: 25 },
    sources: 13,
  },
  {
    id: "11",
    title: "Real Madrid Win Champions League After Comeback Victory in Final",
    category: "Soccer",
    country: "Europe",
    imageUrl:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=800&q=80",
    bias: { left: 10, center: 20, right: 70 },
    sources: 26,
  },
  {
    id: "12",
    title: "Wildfires Force Thousands to Evacuate Across Western Canada",
    category: "Environment",
    country: "Canada",
    imageUrl:
      "https://images.unsplash.com/photo-1601791074012-d4e0ee30d77a?w=800&q=80",
    bias: { left: 27, center: 33, right: 40 },
    sources: 17,
  },
];

/**
 * Placeholder full-article detail records keyed by id, shaped like the eventual
 * Supabase query result (articles + article_analyses, AGENTS.md §19/§20). Framing
 * values are AI-estimated. Display-only — no scraping/analysis/pipeline state here.
 */
const MOCK_ARTICLE_DETAILS: Record<string, NewsArticleDetail> = {
  "1": {
    id: "1",
    title: "Trump Sends Iran Revised Peace Proposal With Tougher Terms: Report",
    category: "Politics",
    country: "United States",
    author: "David Morgan",
    publishedDate: "May 31, 2026",
    readTime: "12 min read",
    imageUrl:
      "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200&q=80",
    imageCaption:
      "President Donald Trump in the Cabinet Room at the White House, Washington, D.C., May 30, 2026.",
    imageCredit: "Andrew Harnik/Getty Images",
    bodyParagraphs: [
      "The Trump administration has sent Iran a revised nuclear deal proposal that includes tougher terms on uranium enrichment and stronger verification measures, according to a report published Saturday.",
      "The new proposal, delivered through intermediaries in Oman, requires Iran to halt all uranium enrichment on its soil and ship its stockpile of enriched uranium out of the country. It also demands unrestricted access for international inspectors to all Iranian nuclear facilities, including military sites.",
      "“This is a take-it-or-leave-it proposal,” a senior administration official told the Wall Street Journal. “The President wants a deal, but he will not accept a weak agreement that puts America or our allies at risk.”",
      "Iran has not yet officially responded to the proposal. However, Iranian Foreign Minister Hossein Amir-Abdollahian said last week that any deal must respect Iran’s right to peaceful nuclear energy and include the lifting of all U.S. sanctions.",
      "The revised proposal comes after several rounds of indirect talks between U.S. and Iranian officials failed to produce a breakthrough. The Trump administration has warned that if diplomacy fails, it is prepared to take other action to prevent Iran from obtaining a nuclear weapon.",
      "European allies have urged both sides to continue negotiations. “We believe diplomacy is still the best path forward,” said a spokesperson for the EU’s foreign policy chief.",
      "Israel, which has long opposed the 2015 nuclear deal with Iran, praised the Trump administration’s tougher stance. “This is the kind of leadership that was missing in the past,” said Israeli Prime Minister Benjamin Netanyahu in a statement.",
      "The fate of the proposal now rests with Iran, as global attention remains focused on whether a new nuclear agreement can be reached—or if tensions will escalate further.",
    ],
    bias: { left: 20, center: 31, right: 49 },
    biasLabel: "right",
    sentimentLabel: "neutral",
    confidence: 0.78,
    framingNotes:
      "Coverage leans on administration framing of the proposal as strong and decisive, foregrounding U.S. and Israeli perspectives while giving Iran’s position comparatively brief treatment.",
    loadedTerms: ["take-it-or-leave-it", "tougher stance", "maximum pressure"],
    disclaimer:
      "Framing estimates are AI-generated from the article text and reflect how the story is presented, not an objective judgement of truth.",
    summaryPoints: [
      "The Trump administration has sent Iran a revised nuclear deal proposal with tougher terms, including a complete halt to uranium enrichment and the removal of enriched uranium stockpiles.",
      "The proposal also demands unrestricted inspector access to all nuclear sites, including military facilities.",
      "Iran has not responded officially but says any deal must respect its right to peaceful nuclear energy and include sanctions relief.",
      "The U.S. warns it is prepared to take other action if diplomacy fails, while European allies urge continued negotiations.",
      "Israel supports the tougher stance, praising the administration’s determination to prevent Iran from acquiring nuclear weapons.",
    ],
    summaryGenerated: "May 31, 2026",
    summaryReadTime: "3 min read",
    sourceCount: 12,
    topSources: [
      { name: "Fox News", bias: "right" },
      { name: "The Wall Street Journal", bias: "center" },
      { name: "Reuters", bias: "center" },
      { name: "BBC", bias: "center" },
      { name: "CNN", bias: "left" },
      { name: "The New York Times", bias: "center" },
      { name: "The Washington Post", bias: "center" },
      { name: "Newsmax", bias: "right" },
    ],
    related: [
      {
        id: "5",
        title: "Iran Says It Will Not Negotiate Under ‘Maximum Pressure’",
        category: "World",
        country: "Middle East",
        imageUrl:
          "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=400&q=80",
        bias: { left: 40, center: 35, right: 25 },
        sources: 9,
      },
      {
        id: "10",
        title: "Bipartisan Group Urges Diplomacy With Iran",
        category: "Politics",
        country: "United States",
        imageUrl:
          "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=400&q=80",
        bias: { left: 34, center: 40, right: 26 },
        sources: 6,
      },
      {
        id: "8",
        title: "US Sanctions More Iranian Entities Over Nuclear Program",
        category: "Politics",
        country: "United States",
        imageUrl:
          "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=400&q=80",
        bias: { left: 22, center: 38, right: 40 },
        sources: 8,
      },
      {
        id: "3",
        title: "What’s in the 2015 Iran Nuclear Deal?",
        category: "Science",
        country: "Nuclear Policy",
        imageUrl:
          "https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?w=400&q=80",
        bias: { left: 30, center: 45, right: 25 },
        sources: 5,
      },
      {
        id: "6",
        title: "Oman Hosts Another Round of US-Iran Nuclear Talks",
        category: "World",
        country: "Middle East",
        imageUrl:
          "https://images.unsplash.com/photo-1545262810-77515befe149?w=400&q=80",
        bias: { left: 28, center: 44, right: 28 },
        sources: 11,
      },
    ],
  },
};

/**
 * Look up a full article detail by id. Falls back to synthesizing a minimal detail
 * from the matching home card so any card is navigable; returns null when no article
 * with that id exists (the detail route renders notFound() in that case).
 */
export function getArticleDetail(id: string): NewsArticleDetail | null {
  const detail = MOCK_ARTICLE_DETAILS[id];
  if (detail) return detail;

  const card = MOCK_ARTICLES.find((a) => a.id === id);
  if (!card) return null;

  const strongest = Math.max(card.bias.left, card.bias.center, card.bias.right);
  const biasLabel =
    strongest === card.bias.left
      ? "left"
      : strongest === card.bias.right
        ? "right"
        : "center";

  return {
    id: card.id,
    title: card.title,
    category: card.category,
    country: card.country,
    author: "SKEW Newsroom",
    publishedDate: "June 1, 2026",
    readTime: "6 min read",
    imageUrl: card.imageUrl,
    imageCaption: card.title,
    imageCredit: "SKEW / Getty Images",
    bodyParagraphs: [
      "Full analysis for this story is being generated. This is placeholder body copy shaped like the eventual article text so the layout can be validated before the real data layer lands.",
      "When the Supabase pipeline is wired up, this page will render the scraped article body alongside its AI-estimated framing analysis.",
    ],
    bias: card.bias,
    biasLabel,
    sentimentLabel: "neutral",
    confidence: 0.6,
    framingNotes:
      "Framing analysis for this article has not been finalized. Estimates shown are AI-generated placeholders.",
    loadedTerms: [],
    disclaimer:
      "Framing estimates are AI-generated from the article text and reflect how the story is presented, not an objective judgement of truth.",
    summaryPoints: [
      "A neutral AI summary of this story will appear here once analysis completes.",
    ],
    summaryGenerated: "June 1, 2026",
    summaryReadTime: "2 min read",
    sourceCount: card.sources,
    topSources: [
      { name: "Reuters", bias: "center" },
      { name: "BBC", bias: "center" },
      { name: "Associated Press", bias: "center" },
    ],
    related: MOCK_ARTICLES.filter((a) => a.id !== id).slice(0, 5),
  };
}
