// Conversation insights + funder Deal Alerts, backed by Netlify Blobs.
//
// Netlify Functions don't share a persistent local disk the way server.js's
// Express process does — writes to /tmp can vanish the moment a function's
// execution environment is recycled. Netlify Blobs is Netlify's own durable
// key/value store, scoped to this site, reachable from any function
// invocation — so it's the serverless-appropriate equivalent of the local
// data/insights.jsonl and data/funder-alerts.jsonl files server.js uses.
//
// Mirrors the logic in server.js as closely as possible so the two stay easy
// to compare; see that file for the fuller commentary on the privacy rules
// this schema follows (categorical/topical tags only, never names or contact
// details).

const { getStore } = require("@netlify/blobs");
const { API_KEY, INSIGHTS_MODEL, INSIGHTS_WEBHOOK_URL, sendMail } = require("./_shared");

function insightsStore() { return getStore("insights"); }
function alertsStore() { return getStore("funder-alerts"); }
function notifiedStore() { return getStore("notified-pairs"); }

const INSIGHTS_SCHEMA_PROMPT = `You are a data-tagging function, not a conversational assistant. You will be shown a conversation between a user and the Institute for Litigation Finance's AI Concierge. Read it and output ONLY a single JSON object (no prose, no markdown fences, no commentary) with exactly these fields:

{
  "audience": one of "claimant" | "lawyer" | "funder" | "researcher" | "other" | "unknown",
  "matter_category": a short category string (e.g. "commercial dispute", "IP/patent", "mass tort", "construction", "securities", "portfolio financing", "not yet known") — infer from the taxonomy of a litigation finance research library if possible, otherwise "not yet known",
  "claim_size_bucket": one of "<$250k" | "$250k-$2M" | "$2M-$10M" | "$10M+" | "unknown",
  "jurisdiction": a short jurisdiction string if mentioned (e.g. "New York", "UK", "federal - 7th Circuit") or "unknown",
  "funder_criteria_summary": if audience is "funder", a short (<25 word) neutral summary of the investment criteria they described, else empty string "",
  "key_topics": an array of up to 5 short lowercase tags (e.g. ["champerty", "settlement authority", "disclosure"]),
  "exchange_mentioned": true or false — whether the Exchange or Middle-Market Placement Service came up,
  "stage": one of "early" | "mid" | "assessment given" | "closing" — how far the conversation got.

Never include names, email addresses, phone numbers, company names of claimants, or any verbatim quotes that could identify a real person or specific real dispute. Funder names (e.g. "Burford", "Legalist") are fine since those are public companies, not private individuals. If information for a field genuinely isn't present, use the "unknown"/"not yet known"/empty-string/false default shown above rather than guessing.`;

function transcriptText(messages) {
  return messages.map(m => `[${m.role.toUpperCase()}] ${m.content}`).join("\n\n");
}

async function extractInsights(messages, audience) {
  if (!API_KEY) return null;
  try {
    const convoText = transcriptText(messages).slice(0, 12000);
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: INSIGHTS_MODEL,
        max_tokens: 400,
        temperature: 0,
        system: INSIGHTS_SCHEMA_PROMPT,
        messages: [{
          role: "user",
          content: `Known audience (if any): ${audience || "unknown"}\n\nConversation:\n${convoText}`
        }]
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = (data.content || []).map(b => b.text || "").join("").trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error("Insight extraction failed (non-fatal):", e.message);
    return null;
  }
}

function normalize(str) {
  return (str || "").toString().trim().toLowerCase();
}

function alertMatchesTags(alert, tags) {
  const matterOk = alert.categories.length === 0 || alert.categories.some(c =>
    normalize(tags.matter_category).includes(normalize(c)) || normalize(c).includes(normalize(tags.matter_category))
  );
  const sizeOk = alert.claimSizeBuckets.length === 0 || alert.claimSizeBuckets.includes(tags.claim_size_bucket);
  const jurisdictionOk = alert.jurisdictions.length === 0 || alert.jurisdictions.some(j =>
    normalize(tags.jurisdiction).includes(normalize(j)) || normalize(j).includes(normalize(tags.jurisdiction))
  );
  return matterOk && sizeOk && jurisdictionOk;
}

async function loadFunderAlerts() {
  const store = alertsStore();
  const { blobs } = await store.list();
  const alerts = await Promise.all(blobs.map(b => store.get(b.key, { type: "json" }).catch(() => null)));
  return alerts.filter(a => a && a.active !== false);
}

async function saveFunderAlert(alert) {
  await alertsStore().setJSON(alert.id, alert);
}

async function matchAndNotifyFunders(session, tags) {
  if (!tags) return;
  if (tags.audience !== "claimant" && tags.audience !== "lawyer") return;
  if (!tags.matter_category || tags.matter_category === "not yet known") return;

  const alerts = await loadFunderAlerts();
  const notified = notifiedStore();
  for (const alert of alerts) {
    const pairKey = `${session}::${alert.id}`;
    const already = await notified.get(pairKey);
    if (already) continue;
    if (!alertMatchesTags(alert, tags)) continue;
    await notified.set(pairKey, "1");

    const body = [
      `A new matter tagged at the Institute appears to match your stated Deal Alert criteria.`,
      ``,
      `Matter category: ${tags.matter_category}`,
      `Estimated claim size: ${tags.claim_size_bucket || "unknown"}`,
      `Jurisdiction: ${tags.jurisdiction || "unknown"}`,
      `Topics: ${(tags.key_topics || []).join(", ") || "none noted"}`,
      ``,
      `No identifying details are included in this notice by design. If you'd like the Institute to explore whether an introduction makes sense through the Exchange, just reply to this email.`,
      ``,
      `— Institute for Litigation Finance`,
      `To stop receiving Deal Alerts, reply "unsubscribe" and we'll remove ${alert.email}.`
    ].join("\n");

    await sendMail(`Deal Alert: ${tags.matter_category} matter matching your criteria`, body, alert.email);
  }
}

async function recordInsight(session, audience, messages) {
  const tags = await extractInsights(messages, audience);
  if (!tags) return;

  const record = {
    session,
    timestamp: new Date().toISOString(),
    message_count: messages.length,
    ...tags
  };

  try {
    await insightsStore().setJSON(session, record);
  } catch (e) {
    console.error("Failed to write insight to Blobs (non-fatal):", e.message);
  }

  // Check this conversation's tags against registered funder Deal Alerts.
  // Awaited (not fire-and-forget) since a Netlify Function's execution
  // environment can freeze the moment its caller returns — see chat.js.
  try {
    await matchAndNotifyFunders(session, tags);
  } catch (e) { console.error("Deal Alert matching failed (non-fatal):", e.message); }

  if (INSIGHTS_WEBHOOK_URL) {
    try {
      await fetch(INSIGHTS_WEBHOOK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(record)
      });
    } catch (e) {
      console.error("Failed to POST insight to webhook (non-fatal):", e.message);
    }
  }
}

async function loadInsightRecords() {
  const store = insightsStore();
  const { blobs } = await store.list();
  const records = await Promise.all(blobs.map(b => store.get(b.key, { type: "json" }).catch(() => null)));
  return records.filter(Boolean);
}

function rankedCounts(records, field, opts = {}) {
  const { excludeValues = ["unknown", "not yet known", ""], limit = 8 } = opts;
  const counts = {};
  for (const r of records) {
    const v = (r[field] || "").toString().trim();
    if (!v || excludeValues.includes(v.toLowerCase())) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, n]) => ({ label, count: n, pct: total ? Math.round((n / total) * 100) : 0 }));
}

async function buildDemandBrief() {
  const records = await loadInsightRecords();
  const total = records.length;
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const recent = records.filter(r => {
    const t = Date.parse(r.timestamp || "");
    return !isNaN(t) && (now - t) <= THIRTY_DAYS;
  });

  const topicCounts = {};
  for (const r of records) {
    const topics = Array.isArray(r.key_topics) ? r.key_topics : [];
    for (const t of topics) {
      const key = (t || "").toString().trim().toLowerCase();
      if (!key) continue;
      topicCounts[key] = (topicCounts[key] || 0) + 1;
    }
  }
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, n]) => ({ label, count: n }));

  const claimantOrLawyer = records.filter(r => r.audience === "claimant" || r.audience === "lawyer");

  return {
    generatedAt: new Date().toISOString(),
    totalConversations: total,
    conversationsLast30Days: recent.length,
    hasEnoughData: total >= 8,
    matterCategories: rankedCounts(claimantOrLawyer, "matter_category"),
    claimSizeBuckets: rankedCounts(claimantOrLawyer, "claim_size_bucket", { limit: 6 }),
    jurisdictions: rankedCounts(claimantOrLawyer, "jurisdiction"),
    topTopics,
    exchangeMentionedCount: records.filter(r => r.exchange_mentioned).length,
    exchangeMentionedPct: total ? Math.round((records.filter(r => r.exchange_mentioned).length / total) * 100) : 0
  };
}

module.exports = {
  recordInsight,
  loadInsightRecords,
  buildDemandBrief,
  loadFunderAlerts,
  saveFunderAlert
};
