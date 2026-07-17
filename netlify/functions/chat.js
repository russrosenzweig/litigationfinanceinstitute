const { API_KEY, MODEL, SYSTEM_PROMPT, JSON_HEADERS } = require("./_shared");
const { recordInsight } = require("./_insights");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        error: "No ANTHROPIC_API_KEY configured on this Netlify site. Add it under Site settings → Environment variables, then redeploy."
      })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "No messages provided." }) };
  }

  const audience = typeof body.audience === "string" ? body.audience : null;
  const system = audience
    ? `${SYSTEM_PROMPT}\n\n=== CURRENT CONVERSATION CONTEXT ===\nThe interface already told you this user's role: "${audience}". Do not ask the role-detection question — go directly into the matching flow described above for that constituency.`
    : SYSTEM_PROMPT;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: system,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Anthropic API error:", response.status, errText);
      return {
        statusCode: 502,
        headers: JSON_HEADERS,
        body: JSON.stringify({ error: `Anthropic API error (${response.status}). Check your API key and model name.` })
      };
    }

    const data = await response.json();
    const reply = (data.content || []).map(block => block.text || "").join("");

    // Note: unlike the old version of this function, we no longer email a
    // running transcript on every single turn — that got noisy fast on any
    // real conversation. Instead, the client calls /api/end-session once,
    // when the conversation actually wraps up (see concierge-widget.js), and
    // that's what sends the one consolidated transcript email. We do keep
    // the lightweight structured-insights tagging here, since it's cheap,
    // non-identifying, and powers the funder demand brief / Deal Alerts.
    // Like the old sendMail call, this is awaited rather than fire-and-forget
    // — a Netlify Function's execution environment can freeze the moment the
    // handler returns, so a truly "fire and forget" promise risks never
    // actually finishing.
    const session = typeof body.session === "string" ? body.session : "unknown-session";
    const fullTranscript = [...messages, { role: "assistant", content: reply }];
    try {
      await recordInsight(session, audience, fullTranscript);
    } catch (e) { /* insights tagging is best-effort — never fail the chat response over it */ }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ reply }) };
  } catch (e) {
    console.error("Chat request failed:", e);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Request to Anthropic API failed: " + e.message }) };
  }
};
