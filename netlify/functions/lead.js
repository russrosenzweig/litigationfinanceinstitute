const { sendMail, transcriptText, JSON_HEADERS } = require("./_shared");

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

  const { name, email, phone, session, transcript } = body || {};
  if (!name || !email) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Name and email are required." }) };
  }

  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone || "(not provided)"}`,
    `Session: ${session || "unknown-session"}`,
    ``,
    `--- Conversation so far ---`,
    Array.isArray(transcript) ? transcriptText(transcript) : "(no transcript provided)"
  ].join("\n");

  const result = await sendMail(`New Institute follow-up request from ${name}`, text);
  if (result && result.skipped) {
    return {
      statusCode: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({ ok: false, message: "Email isn't configured on this site yet (see NETLIFY_DEPLOY.md), so this request wasn't sent anywhere — but nothing broke." })
    };
  }
  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
};
