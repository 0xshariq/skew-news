import posthog from "posthog-js";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  // Keep error tracking; the exception-autocapture script loads via the
  // /ingest reverse proxy and works for clients without an ad/tracker blocker.
  capture_exceptions: true,
  // SKEW does not use PostHog Surveys. Turning the feature off stops the
  // surveys.js script from being requested at all, which removes the
  // "Could not load surveys script" console error.
  disable_surveys: true,
  debug: process.env.NODE_ENV === "development",
});
