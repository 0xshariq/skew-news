# Clerk Authentication

## Goal

Add Clerk authentication to SKEW: sign-in / sign-up flows, session-aware header UI, and route protection so that **news detail pages (`/news/[id]`) require a signed-in user** while the home feed stays public. Wire up all Clerk environment variables and keep the service/server boundaries intact.

## Skills read

- `.agents/skills/clerk/SKILL.md` (router) → version detection, routed to setup + Next.js patterns
- `.agents/skills/clerk-setup/SKILL.md` → ClerkProvider placement, middleware convention, env keys, current-SDK notes
- Live Clerk Next.js quickstart (`https://clerk.com/docs/nextjs/getting-started/quickstart`) → `clerkMiddleware`, `createRouteMatcher`, control components
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` → **Next.js 16 renames Middleware to Proxy; the file is `proxy.ts` at project root**

## Existing code inspected

- `package.json` → Next.js **16.2.10**, React 19, Tailwind v4. No Clerk installed. Node v24 (meets ≥20.9).
- `app/layout.tsx` → root layout; Poppins font on `<html>`, `<body className="min-h-full flex flex-col">`. **No provider yet.**
- `app/page.tsx` → public home feed (`/`).
- `app/news/[id]/page.tsx` → news detail page (to be protected).
- `components/layout/site-header.tsx` → has placeholder **"Subscribe"** and **"Login"** `<Button>`s in the top-right action cluster. This is where auth UI goes.
- `components/ui/button.tsx` → design-system button (`variant`, `size`). Reuse for triggers.
- No `middleware.ts` / `proxy.ts`, no `.env.example`, no `.env.local`.

## Decisions / assumptions

- **SDK**: current Clerk SDK → install `@clerk/nextjs` (latest v7+). Import client components from `@clerk/nextjs`, server helpers from `@clerk/nextjs/server`.
- **Middleware file**: Next.js 16 uses **`proxy.ts`** at project root (not `middleware.ts`). Export `clerkMiddleware()` as default; the matcher still uses the Clerk-recommended pattern. (Per Next 16 proxy doc + clerk-setup "Next.js ≤15: middleware.ts" note.)
- **Provider placement**: `<ClerkProvider>` goes **inside `<body>`** (current SDK requirement), wrapping the existing flex column so layout is unchanged.
- **Route protection** (user-confirmed): `/news/[id]` requires auth; everything else public. Use `createRouteMatcher(['/news/(.*)'])`; signed-out users hitting a protected route are redirected to sign-in via `auth.protect()`.
- **Auth pages**: dedicated catch-all routes `app/sign-in/[[...sign-in]]/page.tsx` and `app/sign-up/[[...sign-up]]/page.tsx` rendering `<SignIn />` / `<SignUp />`, matching the `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` env vars listed in AGENTS.md §21.
- **Header UI**: replace the placeholder "Login" button with Clerk control components. `<SignedOut>` → `<SignInButton>` (secondary Button) + keep/repurpose "Subscribe" as `<SignUpButton>`; `<SignedIn>` → `<UserButton />`. Keep design-system Buttons as the trigger children via `asChild`-style composition (`<SignInButton><Button variant="secondary" size="sm">Login</Button></SignInButton>`).
- No shadcn theme step: no `components.json` in the project.
- Keys: provided by the user in `.env.local` (or Clerk Keyless on first run). We only create `.env.example` with placeholders — never commit real keys.

## Files likely to change / add

- `package.json` / `package-lock.json` — add `@clerk/nextjs`
- `proxy.ts` — **new**, Clerk middleware + protected-route matcher
- `app/layout.tsx` — wrap children in `<ClerkProvider>`
- `components/layout/site-header.tsx` — Clerk control components in the action cluster
- `app/sign-in/[[...sign-in]]/page.tsx` — **new**, `<SignIn />`
- `app/sign-up/[[...sign-up]]/page.tsx` — **new**, `<SignUp />`
- `.env.example` — **new**, all Clerk vars from AGENTS.md §21 as placeholders
- `AGENTS.md` env table — already lists Clerk vars; no change needed unless a var differs

## Implementation requirements

1. `npm install @clerk/nextjs`.
2. `proxy.ts` at project root:
   ```ts
   import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

   const isProtectedRoute = createRouteMatcher(['/news/(.*)'])

   export default clerkMiddleware(async (auth, req) => {
     if (isProtectedRoute(req)) await auth.protect()
   })

   export const config = {
     matcher: [
       '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|cur|heic|heif|mp4|mkv|mov|avi|ogv|flv|wmv|pdf|txt)).*)',
       '/(api|trpc)(.*)',
     ],
   }
   ```
3. `app/layout.tsx`: import `ClerkProvider` from `@clerk/nextjs`, wrap the `<body>` children (provider inside `<body>`). Preserve existing classes and font variable.
4. Auth pages render `<SignIn />` / `<SignUp />` centered on the page; keep it minimal and responsive using existing Tailwind tokens (e.g. a centered flex container on `bg-surface`).
5. `site-header.tsx`: import `SignedIn`, `SignedOut`, `SignInButton`, `SignUpButton`, `UserButton` from `@clerk/nextjs`. In the `ml-auto` action cluster:
   - `<SignedOut>`: `<SignUpButton>` wrapping a primary Button ("Subscribe"), `<SignInButton>` wrapping a secondary Button ("Login").
   - `<SignedIn>`: `<UserButton />`.
   - This is a server component today; Clerk control components work in it. No `"use client"` needed.
6. `.env.example` includes (placeholders only):
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
   CLERK_SECRET_KEY=
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
   ```

## Security requirements

- `CLERK_SECRET_KEY` is server-only; never referenced in client code or committed.
- Only `NEXT_PUBLIC_*` Clerk vars reach the browser (publishable key + URL config).
- `.env.example` contains **placeholders only**, no real credentials.
- Protection enforced in `proxy.ts` (server), not client-side conditional rendering alone.

## Acceptance criteria

- App builds and type-checks with Clerk installed.
- Signed-out user: home page loads; header shows Login + Subscribe; visiting `/news/<id>` redirects to Clerk sign-in.
- After signing in: header shows `<UserButton />`; `/news/<id>` loads normally.
- `/sign-in` and `/sign-up` render Clerk's prebuilt forms.
- No secret key or non-public var exposed to the client bundle.

## Checks to run

- `npm run typecheck`
- `npm run lint`
- `npm run build` (routes + middleware added → build is affected)

## Manual test steps

1. Add real Clerk keys to `.env.local` (copy from `.env.example`; use dev `pk_test_`/`sk_test_` from the Clerk Dashboard) — or rely on Keyless on first `npm run dev`.
2. `npm run dev`.
3. Visit `http://localhost:3000/` → loads, header shows **Login** and **Subscribe**.
4. Click a news card / visit `http://localhost:3000/news/<any-id>` while signed out → redirected to the Clerk sign-in page.
5. Sign up / sign in → redirected back; header now shows the **UserButton** avatar.
6. Revisit `/news/<id>` → the detail page loads.
7. Open the UserButton → **Sign out** → confirm `/news/<id>` redirects to sign-in again.
