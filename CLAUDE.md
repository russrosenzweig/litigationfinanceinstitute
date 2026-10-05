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
- `research/`, 55 research library articles. `disputes/`, 50 dispute pages.
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
14. **Fifth audience, `lawfirm`: triage first, then the MSO readiness screen.** "Outside
    capital" is a fork, so the opening message states the purpose broadly and lays out
    three branches: capital against cases (portfolio and law firm lending, handled as
    ordinary litigation finance sized to the firm, and the branch most owners actually
    want), capital for the business (the MSO), and an exit or succession. The MSO
    readiness flow starts only once branch (b) or (c) is confirmed. No name ask and no
    enumerated intake list in the first message. Then: a law firm owner exploring
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

15. **Never sum an unexplained bucket.** Hard documented damages, discretionary
    damages (bad faith, punitive, distress), and unlabeled "costs" are shown
    separately with their basis; an unexplained bucket counts as zero.
16. **Economics gate.** The moment hard damages and requested budget are both known,
    divide. Below roughly 4:1 commercial funders decline on economics alone; say so
    in the first substantive reply after learning it, before naming financiers.
17. **Filed matters: ask about the other side's filings** (counterclaims,
    declaratory actions, petitions to compel appraisal or arbitration, earlier cases
    between the same parties). The bot cannot check dockets and says so.
18. **First-party household insurance disputes** are a narrower-fit category:
    underwrite the contract number, treat bad faith as unpriced upside.
19. **Run the gate even without a budget figure.** Hard damages of a few hundred
    thousand or less cannot pay for contested litigation; say so in the first
    substantive reply rather than asking four more questions first.
20. **Lost profits from a business that never opened** are a forecast, not evidence.
    Courts are hostile to them and funders discount them to zero; the recoverable
    number is usually money actually spent or actually owed.
21. **Co-owner disputes:** a diverted-opportunity claim usually belongs to the company,
    so the defendant owner shares in any recovery; the operating agreement's buy-sell
    mechanism is cheaper than suit; look for leverage outside the lawsuit (guaranties,
    leases); individual owners are weak collectability (homestead, retirement,
    protected settlement proceeds).
22. **When the claimant's own counsel recommends settlement,** treat that as evidence
    about the merits. Never speculate about counsel's motives or suggest the client
    needs a more aggressive lawyer. No funder finances a case the claimant's own
    lawyer thinks should settle. Offer a second opinion via the state bar instead.
23. **Never re-ask what the user already said.** When a later message contradicts an
    earlier one, name the tension and ask one question that resolves it.
24. **An unpaid award or judgment is an enforcement problem.** Ask amount, debtor
    solvency, challenge status, and enforcement status first; against a solvent debtor
    it is counsel's enforcement job, not a funding matter. Overrides the injury-claim
    calibration until resolved.
25. **Match the financing answer to the claimant's country.** Never name US-only
    funders to a non-US claimant; UK and Commonwealth injury claims run on conditional
    fees plus ATE insurance; flag the short maritime limitation period as a question
    for the solicitor.
26. **Second-language users:** short replies, one or two questions, no repeated
    explanations, one offer to switch languages. Grounding rule now also covers what a
    named company's contracts or tickets say.
27. **Net the ratio against what the claimant owes.** A conceded contract balance,
    retainage or counterclaim comes off the hard damages before the economics gate is
    run; the reply and the fit note state both the gross and the net.
28. **Match the funder to the size of the ask, not the claim.** Never name a funder
    whose published minimum is above the request; under $500K only Legalist and
    Greybridge reach it per the directory. No "institutional funders find this
    attractive" for a sub-$1M request.
29. **A short runway is an obstacle.** Trial or need within about two months means new
    funding is unlikely to close in time; name the ruling or report a funder would wait
    for. Never score the time horizon favorable because trial is near.
30. **Insurance limits are not coverage.** A contractor's general liability policy often
    excludes the cost of fixing its own work, and intentional torts are commonly
    excluded; raise both as questions for counsel and rest collectability on the
    defendant's own assets until answered.
31. **Read the date on anything pasted.** Today's date is in the per-request context
    block; a past motion in a case already in discovery is history, never a deadline.
32. **Settled means settled.** Once the user says an issue is agreed or decided (for
    example, both sides accept they were not an employee), stop raising it.
33. **Attribute statements correctly.** A defendant's inconsistent account to its
    insurer is the defendant's, not the carrier's, and creates no bad-faith claim.
34. **Limits are a ceiling, not a value.** Never call policy limits the claimant's asset
    or repeat a stacking theory; ask for medical bills, wage loss and future care.
35. **Self-represented, no financing path.** Crisis-section treatment even without a
    crisis: state bar lawyer referral service, contingency counsel, no Executive
    Director offer unless asked. Contact requests are capped: after a name and one
    contact method, ask for another at most once.

The claimant and "other" widget menus used to offer a chip reading "We won arbitration.
The defendant won't pay." Tapping it sent that sentence as the user's own message,
which produced at least two transcripts built on a false fact (the MSC cruise claimant
and a Wyoming injury claimant). It now reads "What if I won but can't collect?". Never
write a suggestion chip that asserts a fact about the user's case.

Law firm role, 5 Oct 2026: the widget's fallback opener and its three suggestion chips
were MSO-only, contradicting rule 14's three-way triage. The opener now lays out the
three branches and a "Can a firm borrow against its cases?" chip leads the list. The
prompt no longer says a multi-state firm "is governed by the most restrictive state"
(it is a planning assumption; which rules apply is a choice-of-law question for ethics
counsel) and tells the bot not to flatten the four state measures into one rule.

**Continuation mechanics (server, not prompt).** Claude 4.6+ models, including the
Sonnet 5 this server runs, return HTTP 400 for a prefilled final assistant turn. The
mid-sentence continuation is therefore a normal user turn asking for the remainder,
up to two rounds, and also fires on a "looks cut off" heuristic. Every chat call logs
`[chat] stop=... out_tokens=... chars=...` so a truncation is visible in Render logs.
Do not reintroduce prefill.

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

**Rerun `node scripts/build-related.js` after adding or editing any article, dispute,
or funder.** It is the site's internal concordance: TF-IDF related-content blocks on
every research, dispute, and funder page; BreadcrumbList JSON-LD on every detail page;
CollectionPage/ItemList/BreadcrumbList JSON-LD on the hubs and the other bare pages;
and it syncs the article/dispute/funder counts in the hub titles and meta descriptions.
Everything it writes sits between `RELATED`, `BREADCRUMB`, and `HUBSCHEMA` marker
comments and is replaced on each run, so it is safe to rerun. `--dry` prints the plan.
Funder exclusion clauses ("no mass tort") are stripped before matching so a funder is
never linked to work it refuses; short funder names that are ordinary words (Balance,
Validity) only count as a mention when the full name appears.

**Content Desk drafts install with one command:** `node scripts/install-draft.js draft.json`
(`--check` validates without changing anything). It writes the page from the site
template, appends the entry to the corpus array, adds the hub card and sitemap URL, bumps
the counts in index.html, llms.txt and this file, and reruns build-related.js. Drafts are
produced weekly by the private Content Desk scheduled task and staged outside the repo;
nothing is installed until the Executive Director approves it. The validator rejects em or
en dashes, HTML tags, a named vendor, missing sources, non-https sources, fewer than 350
words, duplicate titles, and unknown article categories.

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
