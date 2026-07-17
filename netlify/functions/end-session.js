const { getStore } = require("@netlify/blobs");
const { sendMail, transcriptText, JSON_HEADERS } = require("./_shared");

// Called once by the client when a chat conversation actually wraps up —
// the browser tab closes/hides, or the user goes idle for a while — rather
// than on every single turn (see concierge-widget.js). Sends ONE
// consolidated transcript email per session, and uses a small Blobs store
// as a dedupe guard so a slow network retry or multiple end-of-session
// signals firing close together can't send it twice.
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: "Method not allowed." }) };
  }

  let body;
  try {
    // sendBeacon (used on page-unload) posts a Blob with no explicit
    // content-type header guarantee across browsers, so parse leniently.
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: "Invalid JSON body." }) };
  }

  const session = typeof body.session === "string" ? body.session : null;
  const audience = typeof body.audience === "string" ? body.audience : null;
  const transcript = Array.isArray(body.transcript) ? body.transcript : [];

  if (!session || transcript.length === 0) {
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: false, message: "Nothing to send." }) };
  }

  // Keyed on transcript length, not just session id, so a conversation that
  // resumes after an idle-triggered send (rare, but possible) still gets a
  // follow-up email covering the new tail — while two near-simultaneous
  // signals for the same final state (e.g. visibilitychange + beforeunload)
  // still only send once.
  const dedupeKey = `${session}::${transcript.length}`;
  const dedupeStore = getStore("session-emails-sent");
  try {
    const already = await dedupeStore.get(dedupeKey);
    if (already) {
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true, message: "Already sent." }) };
    }
    // Mark as sent before actually sending, so two near-simultaneous
    // end-of-session signals (e.g. visibilitychange + beforeunload) can't
    // both slip through and double-send.
    await dedupeStore.set(dedupeKey, new Date().toISOString());
  } catch (e) {
    console.error("Dedupe check failed (non-fatal, may double-send in rare cases):", e.message);
  }

  try {
    await sendMail(
      `Institute chat transcript — session ${session}`,
      `Audience: ${audience || "not yet identified"}\n\n${transcriptText(transcript)}`
    );
  } catch (e) {
    console.error("End-of-session email failed:", e.message);
  }

  return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
};
