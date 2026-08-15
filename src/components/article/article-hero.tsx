interface ArticleHeroProps {
  imageUrl: string;
  caption: string;
  credit: string;
}

/** 16:9 hero image with caption and photo credit. */
export function ArticleHero({ imageUrl, caption, credit }: ArticleHeroProps) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
      </div>
      <figcaption className="text-caption text-text-secondary">
        {caption} <span className="text-text-secondary/70">Photo: {credit}</span>
      </figcaption>
    </figure>
  );
}
