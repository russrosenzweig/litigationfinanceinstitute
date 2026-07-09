# Deploying to Netlify (live AI, no local server)

This makes the AI Concierge run on Netlify itself, using Netlify Functions (their
serverless backend) instead of the local `server.js`. Once deployed, the site
works for anyone who visits the URL — nothing needs to run on your machine.

## What changed from the local version

- `netlify/functions/health.js`, `chat.js`, `lead.js` — Netlify Functions versions
  of the three endpoints `server.js` used to serve (`/api/health`, `/api/chat`,
  `/api/lead`). Same behavior, adapted to Netlify's request/response format.
- `netlify/functions/corpus-data.json` — a static snapshot of the `articles` and
  `financiers` arrays from `research.html` and `financiers.html`. Functions read
  this instead of parsing HTML at request time.
- `netlify.toml` — tells Netlify where the functions live, and redirects
  `/api/*` to them so the frontend code (which already calls `/api/health` etc.)
  didn't need to change at all.
- `server.js` still works too, if you ever want to run this locally again — the
  two setups don't conflict.

## Deploy steps

1. **Push this folder to GitHub** if you haven't already (Netlify deploys from a
   Git repo, same as Render would). Create a repo, then:
   ```
   git init
   git add .
   git commit -m "initial"
   git remote add origin <your repo URL>
   git push -u origin main
   ```

2. **In Netlify:** "Add new site" → "Import an existing project" → connect that
   GitHub repo. Netlify will detect `netlify.toml` automatically — you shouldn't
   need to set a build command (there isn't one; it's a static site plus
   functions). Leave publish directory as-is.

3. **Add your environment variables.** In the Netlify UI: Site configuration →
   Environment variables → Add a variable.
   - `ANTHROPIC_API_KEY` — required, get one at console.anthropic.com
   - `CLAUDE_MODEL` — optional, defaults to `claude-sonnet-5`
   - `OWNER_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
     `SMTP_PASS`, `SMTP_FROM` — optional, only if you want chat transcripts and
     follow-up requests emailed to you (same values you'd have put in `.env`
     locally)

   Never paste your actual key into a chat with me — enter it directly into
   Netlify's dashboard.

4. **Redeploy** (Netlify usually does this automatically after you save
   environment variables — if not, trigger a manual deploy from the Deploys tab).

5. **Test it.** Visit your `*.netlify.app` URL. The AI Concierge should show
   "Live — grounded in 33 articles" instead of "Demo mode."

6. **Connect litigationfinanceinstitute.com.** Site configuration → Domain
   management → Add a domain. Netlify will show you the DNS records to add. Go
   to GoDaddy → your domain → DNS → Manage DNS, remove the default parking
   records, and add what Netlify gave you. Netlify auto-issues an SSL
   certificate once the domain verifies. DNS changes can take minutes to hours.

## One real limitation to know about

Netlify Functions are serverless — each request spins up fresh rather than
running on a server that's always on. Two practical effects:

- **Timeouts.** Functions on Netlify's free tier have a 10-second execution
  limit. A single Claude reply is normally well within that, but this system
  prompt embeds the *entire* research library and financier directory into
  every request (same approach `server.js` used), which makes each call to
  Claude a bit heavier than a minimal chatbot. If you ever see chat requests
  fail with a timeout-shaped error, that's the likely cause — the fix would be
  trimming what's included per-request rather than sending the whole corpus
  every time, which is a real engineering task, not a config change.
- **Cold starts.** The first request after a period of inactivity can feel a
  beat slower while the function spins up. Not usually noticeable, but worth
  knowing if the very first message of the day feels sluggish.

Neither of these come up with the local server or with Render (which keeps a
process running continuously), which is why I'd flagged Render as the simpler
default earlier. Netlify works — just with those two caveats.

## If something doesn't work

- **Concierge still says "Demo mode"** — check that `ANTHROPIC_API_KEY` is set
  in Netlify's environment variables and that you redeployed after adding it.
- **Function errors in the Netlify UI** — Site → Functions tab shows logs for
  each invocation, including the actual error message.
- **"Email isn't configured"** — expected and harmless if you didn't set the
  SMTP variables; the site still works, it just won't email you.
