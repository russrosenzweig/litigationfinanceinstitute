# Institute for Litigation Finance, working notes

This file is auto-loaded by Claude Code. It is the technical and editorial handoff for
this repository. NOTE: this repo is PUBLIC. Never commit client names, claimant details,
deal terms, contact information, API keys, or anything from a chat transcript.

## What this is

litigationfinanceinstitute.com. An educational institute and matching service for
litigation finance, operated by Arete & Associates, LLC. Russ Rosenzweig is Executive
Director (he is also CEO of Round Table Group, an expert-witness referral firm, which is
relevant background but is never named as a vendor anywhere on the site or in bot output).

Three audiences: claimants and business owners with legal matters, lawyers evaluating
financing for clients, and litigation funders. The site's centerpiece is an AI Concierge
(titled "Senior Fellow for Litigation Finance") that gives free, honest financeability
assessments. The business model is a flat fee for preparing and introducing genuinely
fundable matters. Never a percentage, never contingent on a deal closing. See the
compliance section below, this is not a stylistic preference.

## Deployment, read this before changing anything

- **Render is the live site.** It runs `server.js` directly from `main` on GitHub. A push
  to `main` triggers redeploy. That is the only deployment path that matters.
- **`netlify/functions/` is a stale mirror.** It duplicates the backend for a Netlify
  deployment that is not the live path. It has NOT been kept in sync with `server.js`
  and currently lacks every system-prompt change from mid-2026 onward. Either sync it
  deliberately or ignore it, but do not assume edits there affect production.
- **Environment variables live in the Render dashboard**, not in the repo. See
  `.env.example` for names: `ANTHROPIC_API_KEY`, `OWNER_EMAIL`, `RESEND_API_KEY` (aliased
  from `SMTP_PASS`), `SMTP_FROM`, optional `INSIGHTS_WEBHOOK_URL`, `CLAUDE_MODEL`,
  `INSIGHTS_MODEL`.
- Email sends via **Resend's HTTPS API**, not SMTP. Render's free tier blocks SMTP ports.
- Mail is sent from `director@litigationfinanceinstitute.com` (Google Workspace, MX points
  to `smtp.google.com`). DKIM has never been set up; the domain has a DMARC
  `p=quarantine` policy, so DKIM is worth adding for deliverability.
- The domain also carries leftover Microsoft 365 DNS records (autodiscover, lyncdiscover,
  msoid, sip CNAMEs, a `NETORGFT...onmicrosoft.com` TXT) from an old GoDaddy bundle. They
  are inert now that MX points to Google, but that bundle may still be billing.

## Repository map

- `server.js`, Express server, the AI Concierge backend, and the system prompt. The most
  important file in the repo. See the next section.
- `concierge-widget.js`, the persistent chat widget injected into every page. Contains
  the demo-mode fallback replies, the coverage-dimension indicator, the lead-capture
  form, GA4 event firing, and `sending`/`leadSending` duplicate-submit guards.
- `financiers.html`, 40 funder profiles. `const financiers = [...]` is parsed directly
  out of this file by `server.js` at boot and becomes part of the concierge corpus. Same
  pattern for `research.html` (`const articles`) and `disputes.html` (`const disputes`).
  **Editing these HTML files updates the bot's knowledge. There is no separate corpus.**
- `research/`, 54 research library articles. `disputes/`, 50 dispute pages.
  `financiers/`, funder detail pages.
- `scholarship.html`, an annotated bibliography of the academic literature, and
  `primary-sources.html`, the official government/court/bar documents. Both are
  standalone pages, NOT parsed into the concierge corpus, so the system prompt
  references them explicitly instead. Update the prompt if either page changes
  substantially.
- `law-firm-capital.html`, the Institute's second advisory desk: MSO readiness, structure
  blueprint (handed to the firm's counsel), and curated introductions to law firm capital,
  all flat-fee. Its CTA buttons open the concierge with the `lawfirm` role pre-selected
  (same pattern as the Academy bridge). Not parsed into the corpus; the system prompt
  carries the readiness flow directly.
- `index.html`, `about.html`, `academy.html`, `for-funders.html`, `terms.html`,
  `privacy.html`, `russ-rosenzweig-executive-director.html`.
- `data/`, runtime only, gitignored: `insights.jsonl` (anonymized conversation tags),
  `funder-alerts.jsonl` (funder Deal Alert registrations).
- `scripts/indexnow-submit.js`, IndexNow protocol submissions for Bing/AI-engine indexing.
- `llms.txt` at root is the AI-crawler manifest and carries its own summary of the site,
  including article and funder counts. It goes stale easily; update it whenever you add
  a section or change a count.
- `robots.txt` explicitly allowlists AI crawlers; `llms.txt` exists at root.

## The system prompt

`buildSystemPrompt()` in `server.js` assembles everything: role definition, per-audience
conversation flows, guardrails, then the interpolated research/dispute/financier corpora.
Every section below was added in response to a specific real failure observed in a live
transcript. Do not remove one without understanding what it was fixing.

Behavioural rules currently encoded:

1. **Honest fit first.** If a matter does not fit commercial litigation finance, say so in
   the first substantive reply. Never encourage and then walk it back.
2. **Narrower-fit claim types.** Personal injury, abuse claims, and individual mass-tort
   claims get calibrated expectations immediately.
3. **Grounding guardrail.** Never assert unverified facts about a named institution,
   facility, company, or defendant. Ask rather than guess, especially where the fact
   determines jurisdiction.
4. **Represented parties.** When a claimant has counsel: frame legal questions as
   questions for their lawyer rather than generating legal theories; never solicit
   documents into the chat (privilege waiver risk); never commit the Executive Director
   to specific deliverables.
5. **Attribute self-reported figures** in assessments ("as reported by the claimant").
6. **Probe the basis of a loss figure** before doing arithmetic with it. Ask what was
   actually bought, promised, or delivered per the paperwork. Surface industry-level
   regulatory enforcement patterns where they exist, never claims about the specific
   company.
7. **Claimants in crisis with no financing path** get real resources (state bar referral
   services, legal aid, law school clinics, court self-help centers, contingency
   representation, state bar grievance process) and NO Executive Director offer unless
   they ask.
8. **On follow-up acceptance, reply short and capture contact first.** Point to the
   "Request a follow-up from the Institute" button below the chat. Never bury the ask
   under an assessment.
9. **One-time softened name ask**; single follow-up offer; never repeat if declined.
10. **Hidden coverage tag.** Replies to claimants/lawyers end with a machine-readable
    `<!--COVERAGE:...-->` line that drives the widget's progress chips. Never explain it,
    never emit it for funders or researchers.
11. **Naming specific financiers is encouraged**, always framed as educational
    pattern-matching against public criteria, never a live-availability check.
12. **Reasoning frameworks from the scholarship.** A section teaches the bot to reason
    with the academic frameworks rather than just cite them: funding as venture capital
    rather than a loan, staged capital release as a series of call options, separation
    of ownership from control as the root governance problem, and holding the empirical
    evidence honestly (funders are measurably selective, but funding's aggregate effect
    on litigation volume is unsettled). Use the ideas without footnotes for claimants;
    name sources for lawyers, funders, and academics.
13. **Regulatory grounding.** The bot knows there is no federal statute specifically
    regulating funding and no national disclosure rule, that a Rule 26 amendment has been
    under study since October 2024, and that consumer and commercial funding are distinct
    businesses whose rules should not be conflated. It points lawyers and funders to
    `/primary-sources.html` by name.
14. **Fifth audience, `lawfirm`: the MSO readiness screen.** A law firm owner exploring
    outside capital gets a distinct flow: purpose sentence, intake across six dimensions
    (profile, economics, back office, jurisdiction, objective, structure), honest-fit
    first (too-small firms told immediately; revenue-share proposals flagged against the
    four state rules), the cost-side versus revenue-side lesson in every conversation, a
    banded readiness read in one of four fixed forms, and, on "Likely ready", a short
    reply that hands off to the Executive Director via the follow-up button. Emits its
    own six-key `<!--COVERAGE:profile=...-->` tag; the widget swaps chip sets by role.
    No legal advice, no naming a capital provider as having current appetite, no
    documents into the chat, no fee numbers, and an honest answer on any leadership
    conflict if asked.

## Compliance, non-negotiable

- Fees are **flat, agreed in advance, and never contingent** on funding being offered or
  accepted, and never a percentage of any funding or recovery. This is what keeps the
  Institute clear of broker-dealer and unregistered-finder exposure. Do not draft, publish,
  or let the bot suggest success fees, finder's fees, or percentage compensation.
- The bot must always state it does not provide legal or investment advice.
- Law Firm Capital follows the same fee rule. Additionally: the Institute forms no entities
  and drafts no MSAs (counsel's work); it takes no equity, debt, or revenue share in any
  firm or MSO; introduction terms get counsel review before the first compensated
  introduction because MSO capital raises can be securities transactions; and any
  leadership interest in an operator or capital provider must be disclosed in writing
  before an engagement. If the Executive Director launches an operator venture, it lives
  on a separate property, never on this site.
- Never name Round Table Group or any other vendor in site copy or bot output.
- `terms.html` is counsel-drafted (Arete & Associates, JAMS arbitration, Delaware
  governing law, Orange County venue). Do not edit its substance without counsel.
  Note: the counsel version dropped the previous public description of the fee structure,
  which is worth restoring somewhere public before charging clients.
- `privacy.html` predates the counsel review and is still the older in-house draft.

## Editorial style

- **No em dashes or en dashes anywhere.** Not in site copy, not in bot output, not in
  commit messages. Use a comma, a new sentence, or parentheses for asides; a plain hyphen
  for ranges. The entire site was stripped of 1,187 instances; do not reintroduce them.
  The only intentional dash characters in the repo are inside the system prompt rule that
  names the forbidden characters.
- Warm, direct, concise. Never salesy. The bot should read as a sharp, experienced
  professional more interested in getting the analysis right than in closing anything.
- Titles: the bot is "Senior Fellow for Litigation Finance"; the human is "Executive
  Director". Never CEO, Managing Director, or anything brokerage-sounding.

## Verifying changes

```
node -c server.js && node -c concierge-widget.js
git ls-files -z | xargs -0 grep -Iln "\xe2\x80\x94\|\xe2\x80\x93"   # dash sweep, ALL tracked text files
```

Sweep every tracked text file, not just `*.html` and `*.js`. An earlier narrower version
of this check missed dashes that had survived in `llms.txt`, the Markdown docs, and
`netlify/functions/corpus-data.json`. Expect only the style rule in `server.js` (which
names the forbidden characters) to match. As of August 2026 the Markdown dev docs
(`GOING_LIVE.md`, `NETLIFY_DEPLOY.md`, `RUNNING_LOCALLY.md`), `.env.example`,
`netlify.toml`, and the stale `corpus-data.json` still contain dashes; they are not
site copy or bot output, so they are lower priority, but they are not clean either.

After editing `financiers.html`, `research.html`, or `disputes.html`, confirm the array
still parses the way `server.js` reads it (find `const X = [`, read to the line that is
exactly `];`, eval). A malformed array silently empties the bot's corpus.

`GET /api/health` reports corpus counts, API key presence, and mailer status.
`GET /api/insights-summary` and `GET /api/demand-brief` expose aggregate conversation data.

## Known open items

- `netlify/functions/_shared.js` is far out of date with `server.js`.
- Transcript-email dedupe (`sessionEmailsSent` in `server.js`) is in-memory, so a Render
  restart between two end-of-session signals can double-send a transcript. Persist the
  dedupe keys to `data/` to fix.
- No rate limiting on `/api/chat`. Every conversation bills the Anthropic key. Bot and
  crawler traffic has already been observed.
- DKIM not configured for the sending domain.
- A drafted research article, `when-financed-cases-go-the-distance.html`, exists outside
  the repo awaiting approval to publish; it would need a sitemap entry.
- Google Ads: one active Search campaign, budget raised to $56/day. Roughly 20% of
  impressions lost to budget and 59% lost to rank, so a bid and quality pass on
  commercial-intent keywords is the largest remaining paid-growth lever.

## Working with Russ

Concise and direct. No filler. He reviews every concierge transcript personally and asks
for honest critique of the bot's performance, so evaluate transcripts candidly rather than
reassuringly. He values being told when an idea has a problem. He has a standing
preference that, where a genuine parallel exists, a response may close with a relevant
story from scripture, another faith tradition, philosophy, history, or classic
literature, quoted accurately and tied to the point.
