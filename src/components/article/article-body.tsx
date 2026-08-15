interface ArticleBodyProps {
  paragraphs: string[];
}

/** Renders the article body paragraphs at a comfortable reading measure. */
export function ArticleBody({ paragraphs }: ArticleBodyProps) {
  return (
    <div className="flex flex-col gap-5">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="text-body-lg text-text-primary">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
