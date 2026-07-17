const { JSON_HEADERS, sendMail } = require("./_shared");
const { saveFunderAlert } = require("./_insights");

// Funder registers Deal Alert criteria — matter categories, claim size
// buckets, jurisdictions (any of these left empty means "any"). Stored in
// Netlify Blobs and matched against every subsequent tagged conversation
// (see _insights.js's matchAndNotifyFunders, called from chat.js).
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const { name, firm, email, categories, claimSizeBuckets, jurisdictions, notes } = body || {};
  if (!email || !firm) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Firm name and email are required." }) };
  }

  const alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: (name || "").toString().slice(0, 200),
    firm: firm.toString().slice(0, 200),
    email: email.toString().slice(0, 200),
    categories: Array.isArray(categories) ? categories.map(c => c.toString().slice(0, 80)).slice(0, 20) : [],
    claimSizeBuckets: Array.isArray(claimSizeBuckets) ? claimSizeBuckets.map(c => c.toString().slice(0, 40)).slice(0, 10) : [],
    jurisdictions: Array.isArray(jurisdictions) ? jurisdictions.map(j => j.toString().slice(0, 80)).slice(0, 20) : [],
    notes: (notes || "").toString().slice(0, 1000),
    active: true,
    createdAt: new Date().toISOString()
  };

  try {
    await saveFunderAlert(alert);
  } catch (e) {
    console.error("Failed to save funder alert (non-fatal):", e.message);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Could not save your Deal Alert. Please try again." }) };
  }

  await sendMail(
    `New Deal Alert signup — ${alert.firm}`,
    `Name: ${alert.name || "(not provided)"}\nFirm: ${alert.firm}\nEmail: ${alert.email}\nCategories: ${alert.categories.join(", ") || "any"}\nClaim size buckets: ${alert.claimSizeBuckets.join(", ") || "any"}\nJurisdictions: ${alert.jurisdictions.join(", ") || "any"}\nNotes: ${alert.notes || "(none)"}`
  );
  await sendMail(
    `You're set up for Institute Deal Alerts`,
    `Thanks for registering, ${alert.name || "there"} — you're now set up to receive Deal Alerts from the Institute for Litigation Finance for matters matching:\n\nCategories: ${alert.categories.join(", ") || "any"}\nClaim size: ${alert.claimSizeBuckets.join(", ") || "any"}\nJurisdictions: ${alert.jurisdictions.join(", ") || "any"}\n\nEach alert is anonymized — no claimant names or contact details — and any introduction still runs through the Institute. Reply "unsubscribe" at any time to stop.\n\n— Institute for Litigation Finance`,
    alert.email
  );

  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
};
