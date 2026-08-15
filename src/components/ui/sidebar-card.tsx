import { cn } from "@/lib/utils";
import { InfoIcon } from "@/components/ui/icons";

interface SidebarCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

/** Bordered white analysis card shell with a title + info-icon header. */
export function SidebarCard({ title, children, className }: SidebarCardProps) {
  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-bg-primary p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-h4 font-semibold text-text-primary">{title}</h2>
        <span className="text-text-secondary">
          <InfoIcon />
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
