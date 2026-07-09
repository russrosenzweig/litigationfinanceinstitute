const { API_KEY, MODEL, SYSTEM_PROMPT, sendMail, transcriptText, JSON_HEADERS } = require("./_shared");

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

    // Unlike the local Express server, a Netlify Function's execution environment
    // can freeze the moment the handler returns — so, unlike server.js, we await
    // the transcript email here instead of firing it and moving on, or it might
    // never actually finish sending.
    const session = typeof body.session === "string" ? body.session : "unknown-session";
    const fullTranscript = [...messages, { role: "assistant", content: reply }];
    try {
      await sendMail(
        `Institute chat transcript — session ${session}`,
        `Audience: ${audience || "not yet identified"}\n\n${transcriptText(fullTranscript)}`
      );
    } catch (e) { /* email is best-effort — never fail the chat response over it */ }

    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ reply }) };
  } catch (e) {
    console.error("Chat request failed:", e);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Request to Anthropic API failed: " + e.message }) };
  }
};
