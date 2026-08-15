function GlobeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Full-width dark utility bar. Presentational — theme/location/edition are visual only. */
export function TopBar() {
  return (
    <div className="w-full bg-text-primary text-text-secondary">
      <div className="mx-auto flex h-10 max-w-(--container-app) items-center justify-between px-6 text-caption">
        <div className="flex min-w-0 items-center gap-5">
          <span className="hover:text-white">Browser Extension</span>
          <span className="hidden items-center gap-2 md:flex">
            <span>Theme:</span>
            <span className="font-semibold text-white">Light</span>
            <span className="hover:text-white">Dark</span>
            <span className="hover:text-white">Auto</span>
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden lg:inline">Monday, June 1, 2026</span>
          <span className="hidden text-border lg:inline">|</span>
          <span className="hidden hover:text-white sm:inline">Set Location</span>
          <span className="hidden text-border sm:inline">|</span>
          <span className="flex shrink-0 items-center gap-1.5 hover:text-white">
            <GlobeIcon />
            <span className="hidden sm:inline">International Edition</span>
            <span className="sm:hidden">Edition</span>
            <ChevronDownIcon />
          </span>
        </div>
      </div>
    </div>
  );
}
