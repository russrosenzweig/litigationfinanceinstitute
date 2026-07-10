# Running the AI Concierge live

By default, `institute-prototype.html` works standalone — just open it in a browser, no setup needed. The AI Concierge will use scripted demo answers for the three sample prompts and a fallback message for anything else.

To make the Concierge give real, grounded answers instead, run the included local server. It calls Claude directly using your own Anthropic API key, and grounds every answer in the actual research library and financier directory already in the site — nothing is deployed anywhere, it all runs on your machine.

## Setup

1. **Install Node.js** (version 18 or later) if you don't already have it: https://nodejs.org

2. **Install dependencies.** Open a terminal in this folder and run:
   ```
   npm install
   ```

3. **Add your API key.** Copy `.env.example` to a new file named `.env`, and paste your Anthropic API key in:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
   Get a key at https://console.anthropic.com if you don't have one. Never share this file or paste your key into a chat with anyone, including an AI assistant — it's a credential, not something to hand over.

4. **Start the server:**
   ```
   npm start
   ```

5. **Open the site:** go to `http://localhost:3000` in your browser. You'll see a small "Live" indicator next to the AI Concierge label once it's connected. If the server isn't running, the site still works — it just quietly falls back to demo mode.

## What the server actually does

`server.js` reads the `articles` and `financiers` data directly out of `institute-prototype.html` at startup, so the live AI and the static site are always working from the same content — there's no separate database to keep in sync. Every question you ask gets sent to Claude along with the full research library and financier directory as context, with instructions to cite specific articles and stay honest about the limits of what it knows.

This is meant for local testing and demos, not production. Before this became a real product, you'd want a proper backend, rate limiting, a server-side key that's never exposed to the browser bundle, and a real retrieval system rather than stuffing the whole corpus into every request.

## Optional: email notifications

If you want chat transcripts and "request a follow-up" submissions emailed to you, set a couple of values in `.env`. If you leave them blank, everything still works — the AI Concierge and the "Request a follow-up" form just won't send anything anywhere, and will say so honestly if someone tries.

Email is sent through [Resend](https://resend.com)'s HTTPS API rather than traditional SMTP. This is deliberate: many hosts (Render's free tier included) block outbound SMTP ports (25/465/587) entirely as an anti-spam measure, which causes sends to silently time out no matter how correctly SMTP is configured. A normal HTTPS API call isn't affected by that block, so this approach works everywhere without needing a paid hosting tier.

1. Sign up at resend.com using the same address you want notifications sent to (e.g. `you@yourcompany.com`). Without verifying a custom domain, Resend's free "sandbox" mode only delivers to that same signup address — which is exactly what we want here.
2. Create an API key: Dashboard → API Keys → Create API Key. Copy it immediately; it's only shown once.
3. In `.env`, set:
   ```
   OWNER_EMAIL=you@yourcompany.com
   SMTP_PASS=re_your_resend_api_key
   SMTP_FROM=onboarding@resend.dev
   ```
   (The variable is still named `SMTP_PASS` for compatibility with the original setup — it just holds your Resend API key now. `RESEND_API_KEY` works too if you'd rather name it that.)
4. Restart the server. The startup log will confirm whether email is configured.

Every AI Concierge conversation gets emailed to `OWNER_EMAIL` as it progresses (each reply re-sends the running transcript, tagged with a session ID, so your inbox naturally threads a single visitor's conversation together). Anyone who fills out "Request a follow-up" in the chat widget also triggers an immediate email with their name, email, phone, and the conversation so far.

Once you're ready to send to more than just your own inbox (e.g. a real team distribution list), verify a domain at resend.com/domains and update `SMTP_FROM` to an address on that domain.
