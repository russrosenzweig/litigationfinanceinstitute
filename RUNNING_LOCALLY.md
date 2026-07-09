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

If you want chat transcripts and "request a follow-up" submissions emailed to you, fill in the email section of `.env`. If you leave it blank, everything still works — the AI Concierge and the "Request a follow-up" form just won't send anything anywhere, and will say so honestly if someone tries.

Any SMTP provider works. The simplest option if you already have a Gmail account:

1. Turn on 2-Step Verification on your Google account (required for the next step): https://myaccount.google.com/security
2. Create an "App Password" at https://myaccount.google.com/apppasswords — choose "Mail" as the app. Google gives you a 16-character password. This is not your regular Gmail password, and it only works for this one purpose.
3. In `.env`, set:
   ```
   OWNER_EMAIL=you@gmail.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=you@gmail.com
   SMTP_PASS=the-16-character-app-password
   ```
4. Restart the server. The startup log will confirm whether email is configured.

Every AI Concierge conversation gets emailed to `OWNER_EMAIL` as it progresses (each reply re-sends the running transcript, tagged with a session ID, so your inbox naturally threads a single visitor's conversation together). Anyone who fills out "Request a follow-up" in the chat widget also triggers an immediate email with their name, email, phone, and the conversation so far.

If you'd rather use a dedicated transactional email service instead of Gmail (Resend, Postmark, SendGrid's SMTP relay, etc. — better for anything beyond casual personal use), just swap in the SMTP host/port/credentials they give you; the rest of the setup is identical.
