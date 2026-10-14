#!/usr/bin/env node
// Checks help-directory.json, the verified resource list behind "Other Ways to
// Get Help". Run before any change to the list, and on the review schedule
// (every 90 days at most). It never edits the file; it reports.
//   node scripts/check-help-directory.js [path] [--offline]
// Exit code 1 if any verified entry fails a check.
//
// Checks, per entry:
//   - required fields present; tier and category from the allowed sets
//   - a source_url on the organization's own (or official) site
//   - checked within the last 90 days (else STALE: recheck before showing it)
//   - contact URL and source URL answer (2xx or 3xx); 4xx/5xx/unreachable = BROKEN
//   - no em or en dashes in any visitor-facing text

const fs = require("fs");
const path = require("path");

const file = process.argv.find(a => a.endsWith(".json")) || path.join(__dirname, "..", "help-directory.json");
const offline = process.argv.includes("--offline");
const TIERS = new Set(["national-us", "state", "uk"]);
const CATS = new Set(["legal-aid-finder", "lawyer-referral", "court-self-help", "free-legal-answers", "community-resources", "crisis", "emergency"]);
const MAX_AGE_DAYS = 90;
// En and em dash, built from character codes so this file passes the dash sweep.
const DASHES = new RegExp("[" + String.fromCharCode(0x2013, 0x2014) + "]");

async function reachable(url) {
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (directory link check; Institute for Litigation Finance)" }, signal: AbortSignal.timeout(20000) });
    return { ok: r.status < 400, status: r.status };
  } catch (e) {
    return { ok: false, status: "unreachable: " + (e.cause && e.cause.code || e.name) };
  }
}

(async () => {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  const today = new Date();
  let failures = 0;
  const rows = [];
  const warnings = [];
  for (const e of d.entries || []) {
    const problems = [];
    for (const k of ["id", "name", "tier", "jurisdiction", "category", "service", "contact", "source_url", "verified"]) if (e[k] === undefined || e[k] === null || e[k] === "") problems.push(`missing ${k}`);
    if (e.tier && !TIERS.has(e.tier)) problems.push(`bad tier ${e.tier}`);
    if (e.category && !CATS.has(e.category)) problems.push(`bad category ${e.category}`);
    const checked = e.checked || d.checked;
    const age = checked ? Math.floor((today - new Date(checked)) / 86400000) : Infinity;
    if (age > MAX_AGE_DAYS) problems.push(`STALE (${checked || "never checked"})`);
    const text = [e.name, e.service, e.eligibility_known, e.unknown, e.cost_note].filter(Boolean).join(" ");
    if (DASHES.test(text)) problems.push("contains an em or en dash");
    if (!offline && e.verified === true) {
      const urls = [...new Set([e.contact && e.contact.url, e.source_url].filter(Boolean))];
      for (const u of urls) {
        const r = await reachable(u);
        // Some official sites refuse scripted requests (bot protection). That is
        // not proof the page is gone, so it is a warning to check by hand.
        if ([401, 403, 429].includes(r.status)) warnings.push(`${e.id}: ${u} refused a scripted check (${r.status}); open it by hand`);
        else if (!r.ok) problems.push(`BROKEN ${u} (${r.status})`);
      }
    }
    if (e.verified === true && problems.length) failures++;
    rows.push(`${problems.length ? (e.verified ? "FAIL" : "note") : "ok  "}  ${e.id}${problems.length ? ": " + problems.join("; ") : ""}`);
  }
  console.log(rows.join("\n"));
  if (warnings.length) console.log("\nCheck by hand:\n  " + warnings.join("\n  "));
  const v = (d.entries || []).filter(e => e.verified === true).length;
  console.log(`\n${(d.entries || []).length} entries, ${v} verified, ${failures} verified entries failing.`);
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
