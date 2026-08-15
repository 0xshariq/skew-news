import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: string;
}

/** Small meta label used for sentiment / framing on cards. */
export function Badge({ label, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm bg-surface px-2 py-0.5",
        "text-caption font-medium text-text-secondary",
        className,
      )}
      {...props}
    >
      {label}
    </span>
  );
}
