# Wedding seating & messaging manager

A small, focused app for a couple running two celebrations — a **Traditional Wedding** and a **White Wedding**. Manage guests, seat them at tables per event, group them, and send each guest a WhatsApp message with their table number.

## Run it

Two terminals:

```bash
# Terminal 1 — Convex backend (local, no account needed)
npx convex dev

# Terminal 2 — Next.js app
npm run dev
```

Open http://localhost:3000. Seed data (both events, two groups, one table per event, and a sample contact) is created automatically on first load.

## Deploy (Convex + Vercel)

1. **Convex (backend)** — from this repo, with a Convex account (not anonymous dev):

   ```bash
   npx convex login
   npx convex deploy
   ```

   Copy the **production** deployment URL (looks like `https://your-deployment.convex.cloud`).

2. **Vercel (frontend)** — link the repo or use the CLI, then set the client URL and redeploy so Next can embed it:

   ```bash
   vercel env add NEXT_PUBLIC_CONVEX_URL
   ```

   Paste the production Convex URL. Apply it to **Production** (and Preview if you want preview deployments to work).

   ```bash
   vercel --prod
   ```

3. **Guest links in messages** — Convex builds RSVP/details/guide URLs from `SITE_URL`. Set it to your live site origin (no trailing slash):

   ```bash
   npx convex env set SITE_URL https://your-app.vercel.app
   ```

   Use your production domain when you have one.

See [Convex production](https://docs.convex.dev/production) and [Convex on Vercel](https://docs.convex.dev/production/hosting/vercel).

To test the send loop on yourself: open **Guests**, click the "You (edit me)" row, replace the phone number with your own WhatsApp number, then go to **Messages** → Generate → "Send on WhatsApp".

## Stack

- **Next.js** (App Router) + TypeScript
- **Convex** — database, reactive queries/mutations; every list and dashboard number updates live
- **shadcn/ui** + Tailwind CSS, styled as a Notion-like workspace
- **TanStack Table** for the database-style tables
- **Sonner** for toasts

## How messaging works

Messages are sent from the operator's own WhatsApp via `wa.me` links:

```
https://wa.me/<digits>?text=<encoded body>
```

`{name}`, `{table}`, and `{event}` resolve per recipient for the chosen event. Each generated message is logged in the `sends` table as `pending`; tapping "Mark sent" after sending tracks progress.

`convex/kapso.ts` contains a documented stub (`sendViaKapso`) for a future Kapso / WhatsApp Cloud API integration. It is intentionally not wired up — it needs an API key, a pre-approved Meta utility template, opt-in, and STOP handling.

## Layout

The admin UI is four pages:

- **Dashboard** (`/`) — live stats (all clickable), per-event date/venue/capacity editing, campaign tracking (sent / opened / replied)
- **Guests** (`/guests`) — two views: the guest table (groups, attendance, and seats all edited inline from dropdowns — including creating groups and tables right from the dropdown; bulk paste import; copy RSVP links) and **Seats** (`?view=seats`, table cards per event)
- **Messages** (`/messages`) — scheduling, one-tap send queues, nudge non-responders
- **Guest guide** (`/guest-guide`) — stays & activities shown on the public guide

Guest-facing pages (no sidebar): `/rsvp/[token]` (wedding choice buttons), `/details/[token]` (allergies form), `/guide` (stays & activities).

- `convex/` — schema, queries/mutations (`contacts`, `groups`, `seating`, `scheduled`, `sends`, `events`, `guest`, `guide`, `dashboard`), seed, and the Kapso stub
- `src/components/manage/` — the four Manage tabs; `src/components/` — app shell and shadcn UI primitives
