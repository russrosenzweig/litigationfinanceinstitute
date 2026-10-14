// Local preview of the assistance pathway: a stub Anthropic API plus the real
// server with ASSIST_PATHWAY=on. No model tokens, no email. Port 4480.
//   node scripts/dev-assist-preview.js   (ASSIST_PATHWAY=off to see it disabled)
const http = require("http");
const { spawn } = require("child_process");
const STUB = 4475;
http.createServer((req, res) => {
  let b = ""; req.on("data", c => (b += c)); req.on("end", () => {
    const j = JSON.parse(b || "{}");
    const last = (j.messages || []).slice(-1)[0];
    const text = /haiku/.test(j.model || "") ? "{}" :
      /other kinds of help/i.test(last && last.content || "")
        ? "That sounds difficult. Let's find the most useful next step. Where is your legal matter (state or country), and is there any date you already know about?\n<!--PATHWAY:assist-->"
        : "Thanks. Tell me what happened.";
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ model: j.model, stop_reason: "end_turn", content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 } }));
  });
}).listen(STUB, () => {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: require("path").join(__dirname, ".."), stdio: "inherit",
    env: { ...process.env, PORT: "4480", ASSIST_PATHWAY: process.env.ASSIST_PATHWAY ?? "on", ANTHROPIC_API_KEY: "stub", ANTHROPIC_BASE_URL: `http://localhost:${STUB}`, MAIL_DRYRUN_LOG: "1", RESEND_API_KEY: "", OWNER_EMAIL: "" },
  });
  process.on("SIGTERM", () => { child.kill(); process.exit(0); });
});
