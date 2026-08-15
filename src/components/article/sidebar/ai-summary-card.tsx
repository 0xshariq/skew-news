import { SidebarCard } from "@/components/ui/sidebar-card";
import { Button } from "@/components/ui/button";

interface AiSummaryCardProps {
  points: string[];
  generated: string;
  readTime: string;
}

/** Sidebar AI Summary card: neutral summary key points with a mistakes disclaimer. */
export function AiSummaryCard({ points, generated, readTime }: AiSummaryCardProps) {
  return (
    <SidebarCard title="AI Summary">
      <p className="text-caption text-text-secondary">
        Generated {generated} <span className="mx-1">·</span> {readTime}
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {points.map((point, i) => (
          <li key={i} className="flex gap-2 text-body-md text-text-primary">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-text-secondary" />
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-caption text-text-secondary">
        AI summaries can make mistakes.
      </p>

      <Button variant="outline" className="mt-4 w-full">
        Provide Feedback
      </Button>
    </SidebarCard>
  );
}
