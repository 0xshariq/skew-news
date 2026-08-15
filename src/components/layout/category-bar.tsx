import { Chip } from "@/components/ui/chip";

const CATEGORIES = [
  "World Cup",
  "IPL",
  "Social Media",
  "Business & Markets",
  "Health & Medicine",
  "Soccer",
  "Artificial Intelligence",
  "Arsenal FC",
  "Extreme Weather and Disasters",
];

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Horizontally scrollable category chip row. Overflow scrolls; page width stays fixed. */
export function CategoryBar() {
  return (
    <div className="w-full border-b border-border bg-bg-primary">
      <div className="mx-auto flex max-w-(--container-app) items-center gap-2 px-6 py-3">
        <span className="shrink-0 text-text-secondary">+</span>
        <div className="flex flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CATEGORIES.map((label) => (
            <Chip key={label} label={label} addable className="shrink-0" />
          ))}
        </div>
        <span className="shrink-0 text-text-secondary">
          <ChevronRightIcon />
        </span>
      </div>
    </div>
  );
}
