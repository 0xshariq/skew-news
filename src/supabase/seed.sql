-- SKEW source seed (AGENTS.md §8/§11).
-- Active homepage entry pages only — the scraper loads these from the DB.
-- Idempotent: safe to re-run. Apply in Supabase Dashboard → SQL Editor.

insert into public.sources (name, listing_url, active) values
  ('Reuters',      'https://www.reuters.com/',        true),
  ('NPR',          'https://www.npr.org/',            true),
  ('Fox News',     'https://www.foxnews.com/',        true),
  ('BBC',          'https://www.bbc.com/news',        true),
  ('The Guardian', 'https://www.theguardian.com/us',  true)
on conflict (listing_url) do nothing;
