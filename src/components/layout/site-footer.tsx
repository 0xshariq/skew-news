import Link from "next/link";

const COLUMNS = [
  {
    heading: "Company",
    links: ["About", "Careers", "Press", "Contact"],
  },
  {
    heading: "Help",
    links: ["Help Center", "Guides", "Privacy Policy", "Terms of Service"],
  },
];

const SOCIALS = ["X", "in", "IG", "YT"];

/** Dark site footer. Presentational — links are placeholders. */
export function SiteFooter() {
  return (
    <footer className="mt-16 w-full bg-text-primary text-text-secondary">
      <div className="mx-auto grid max-w-(--container-app) grid-cols-2 gap-8 px-6 py-12 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-h3 font-bold text-white">Skew</span>
            <span className="text-body-sm text-text-secondary">News</span>
          </div>
          <p className="text-body-sm mt-3 max-w-52">
            Balanced news coverage powered by AI.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.heading}>
            <h4 className="text-body-sm font-semibold uppercase tracking-wide text-white">
              {col.heading}
            </h4>
            <ul className="mt-4 flex flex-col gap-2.5">
              {col.links.map((link) => (
                <li key={link}>
                  <Link href="/" className="text-body-sm hover:text-white">
                    {link}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div>
          <h4 className="text-body-sm font-semibold uppercase tracking-wide text-white">
            Connect
          </h4>
          <div className="mt-4 flex gap-3">
            {SOCIALS.map((s) => (
              <Link
                key={s}
                href="/"
                aria-label={s}
                className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-secondary/10 text-body-sm text-white hover:bg-bg-secondary/20"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-(--container-app) px-6 py-5 text-caption">
          © 2026 Skew News. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
