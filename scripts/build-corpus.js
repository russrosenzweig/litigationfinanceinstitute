// Regenerates netlify/functions/corpus-data.json from the site's own HTML
// source files (research.html, financiers.html, disputes.html), which are
// the single source of truth for both the rendered pages and the AI
// Concierge's grounding corpus. Netlify Functions can't reliably parse HTML
// out of the deployed filesystem the way the local server.js does, so this
// script bakes the same data into a static JSON file at deploy time instead.
//
// Run automatically as part of the Netlify build (see netlify.toml's
// build.command), and can also be run manually with `node scripts/build-corpus.js`
// any time research.html / financiers.html / disputes.html change.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const RESEARCH_PATH = path.join(ROOT, "research.html");
const FINANCIERS_PATH = path.join(ROOT, "financiers.html");
const DISPUTES_PATH = path.join(ROOT, "disputes.html");
const OUT_PATH = path.join(ROOT, "netlify", "functions", "corpus-data.json");

function extractArrayFromFile(filePath, startMarker) {
  const html = fs.readFileSync(filePath, "utf8");
  const lines = html.split("\n");
  const startIdx = lines.findIndex(l => l.trim().startsWith(startMarker));
  if (startIdx === -1) throw new Error(`Could not find "${startMarker}" in ${path.basename(filePath)}`);
  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim() === "];") { endIdx = i; break; }
  }
  if (endIdx === -1) throw new Error(`Could not find closing "];" for ${startMarker} in ${path.basename(filePath)}`);
  const arrayText = lines.slice(startIdx, endIdx + 1).join("\n").replace(startMarker, "");
  // Safe in this context: this is our own repo file, not user-supplied input.
  return new Function("return " + arrayText)();
}

const articles = extractArrayFromFile(RESEARCH_PATH, "const articles =");
const financiers = extractArrayFromFile(FINANCIERS_PATH, "const financiers =");
const disputes = extractArrayFromFile(DISPUTES_PATH, "const disputes =");

const corpus = { articles, financiers, disputes };
fs.writeFileSync(OUT_PATH, JSON.stringify(corpus, null, 2));

console.log(`Wrote ${OUT_PATH}`);
console.log(`  articles:   ${articles.length}`);
console.log(`  financiers: ${financiers.length} (${financiers.filter(f => f.criteria).length} with investment criteria)`);
console.log(`  disputes:   ${disputes.length}`);
