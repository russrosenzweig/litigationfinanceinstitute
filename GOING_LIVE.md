# Taking this public: domain + hosting

I can't buy a domain or deploy a server myself — both need your own accounts and payment method. Here's exactly what to do, in order.

## 1. Buy the domain

I checked `litigationfinanceinstitute.com`: it doesn't show up in search results and doesn't resolve to any live site, which is a good sign it's unregistered — but the only way to know for certain is to check live availability at a registrar, since that's the authoritative source, not a search engine.

Any of these work fine; prices are usually $10–20/year for a `.com`:

- **Cloudflare Registrar** (domains.cloudflare.com) — sells at cost, no markup, and pairs well with Cloudflare's free hosting/DNS if you go that route later. Slightly more technical to set up an account.
- **Namecheap** (namecheap.com) — simplest signup, well-known, good support.
- **Squarespace Domains** (formerly Google Domains) — clean interface if you want something familiar.

Steps are the same everywhere: search the domain name, add to cart, create an account, pay with a credit card. That's it — you now own it for a year (renews annually unless you turn that off).

## 2. Host the app somewhere it can run continuously

This isn't a static site — `server.js` is a real Node application with a backend (the AI Concierge and email notifications run through it), so it needs a host that keeps a server process running, not just a folder of files.

**Render.com** is the easiest starting point for something this size:

1. Create a free Render account.
2. Push this folder to a GitHub repository (create a new repo, `git init`, `git add .`, `git commit`, `git push` — the `.gitignore` I included keeps your `.env` file out of it, which matters, since that file holds your API key).
3. In Render, choose "New Web Service," connect that GitHub repo, set the start command to `npm start`.
4. Add your environment variables in Render's dashboard (not in the code): `ANTHROPIC_API_KEY`, `OWNER_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and optionally `CLAUDE_MODEL`. This is the same information from your local `.env` file, just entered into Render's UI instead of a file.
5. Render gives you a working URL like `institute-for-litigation-finance.onrender.com`. Confirm the site works there first.
6. In Render's settings, add your custom domain (`litigationfinanceinstitute.com`). Render will give you a DNS record to add.
7. Back at your domain registrar, add that DNS record (usually a CNAME or A record) to point the domain at Render. This step lives at the registrar, not at Render.
8. DNS changes can take anywhere from a few minutes to a few hours to propagate.

Railway.app and Fly.io are reasonable alternatives with a similar flow if Render doesn't fit.

## 3. Before real visitors see it

A few things worth doing at this point, not before:

- Remove or change the "Concept Prototype" badge in the top-right corner of both pages once you're comfortable with it being public — right now it's honest labeling for a work-in-progress, but you'll want to decide when that framing should change.
- Double-check `.env` never got committed to your GitHub repo (the `.gitignore` prevents this by default, but worth a quick look at the repo on GitHub to confirm).
- If you plan to actually collect retainers or make real introductions to funders — as opposed to this being an informational site with a lead-capture form — that's the point where the fee-structure and broker-dealer questions from earlier need an actual securities attorney's sign-off, not mine.

I'm glad to help troubleshoot any step of this as you go — just let me know where you get stuck.
