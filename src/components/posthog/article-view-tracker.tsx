"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

interface ArticleViewTrackerProps {
  articleId: string;
  articleTitle: string;
  source: string;
  biasLabel: string | null;
  sentimentLabel: string | null;
}

export function ArticleViewTracker({
  articleId,
  articleTitle,
  source,
  biasLabel,
  sentimentLabel,
}: ArticleViewTrackerProps) {
  useEffect(() => {
    posthog.capture("article_viewed", {
      article_id: articleId,
      article_title: articleTitle,
      source,
      bias_label: biasLabel,
      sentiment_label: sentimentLabel,
    });
  }, [articleId, articleTitle, source, biasLabel, sentimentLabel]);

  return null;
}
