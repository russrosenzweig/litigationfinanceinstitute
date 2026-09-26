#!/usr/bin/env node
// Builds the site's internal "concordance": contextual cross-links between
// research articles, dispute pages, and funder profiles, plus BreadcrumbList
// JSON-LD on every detail page. Idempotent: everything it writes sits between
// marker comments and is replaced on each run. Rerun after adding content:
//
//   node scripts/build-related.js          (write)
//   node scripts/build-related.js --dry    (report only)
//
// Relevance is TF-IDF cosine similarity over page text, with boosts for
// shared category and for a funder being named explicitly in the text.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = "https://litigationfinanceinstitute.com";
const DRY = process.argv.includes("--dry");

// ---------- load the three corpora the same way server.js does ----------
function loadArray(file, name) {
  const src = fs.readFileSync(path.join(ROOT, file), "utf8");
  const start = src.indexOf(`const ${name} = [`);
  if (start < 0) throw new Error(`${name} not found in ${file}`);
  const lines = src.slice(start).split("\n");
  const out = [];
  for (const l of lines) { out.push(l); if (l.trim() === "];") break; }
  // eslint-disable-next-line no-eval
  return eval(out.join("\n").replace(`const ${name} =`, "(").replace(/\];\s*$/, "])"));
}

const decode = s => String(s || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&amp;/g, "&").replace(/&middot;/g, " ").replace(/&rarr;|&larr;/g, " ")
  .replace(/&[a-z]+;/g, " ").replace(/&#\d+;/g, " ");
const esc = s => String(s).replace(/&(?!amp;|#\d+;|[a-z]+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const articlesData = loadArray("research.html", "articles");
const disputesData = loadArray("disputes.html", "disputes");
const fundersData = loadArray("financiers.html", "financiers");

// Map data to real files via the page <h1>, never by guessing slugs.
function h1Of(html) { const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/); return m ? decode(m[1]).trim() : ""; }
const norm = s => decode(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function indexDir(dir) {
  const map = new Map();
  for (const f of fs.readdirSync(path.join(ROOT, dir))) {
    if (!f.endsWith(".html")) continue;
    const html = fs.readFileSync(path.join(ROOT, dir, f), "utf8");
    map.set(norm(h1Of(html)), `/${dir}/${f}`);
  }
  return map;
}
const researchFiles = indexDir("research");
const disputeFiles = indexDir("disputes");
const funderFiles = indexDir("financiers");

const docs = [];
for (const a of articlesData) {
  const url = researchFiles.get(norm(a.title));
  if (!url) { console.warn("no page for article:", a.title); continue; }
  docs.push({ type: "article", title: decode(a.title).trim(), cat: a.cat, url,
    text: [a.title, a.title, a.title, a.teaser, a.teaser, ...(a.body || [])].map(decode).join(" ") });
}
for (const d of disputesData) {
  const url = d.slug ? `/disputes/${d.slug}.html` : disputeFiles.get(norm(d.name));
  if (!url || !fs.existsSync(path.join(ROOT, url))) { console.warn("no page for dispute:", d.name); continue; }
  docs.push({ type: "dispute", title: decode(d.name).trim(), cat: d.cat, url, funders: decode(d.funders || ""),
    text: [d.name, d.cat, d.cat, d.background, d.holding, d.lesson, d.funders].map(decode).join(" ") });
}
for (const f of fundersData) {
  const url = funderFiles.get(norm(f.name));
  if (!url) { console.warn("no page for funder:", f.name); continue; }
  // Strip exclusion clauses ("no consumer or mass tort claims", "explicitly
  // excludes personal injury") so a funder is never matched to the very
  // work it refuses.
  const positive = s => decode(s).replace(/[^.;]*\b(no|not|never|excludes?|excluding|avoids?|does not|doesn't|won't)\b[^.;]*[.;]?/gi, " ");
  docs.push({ type: "funder", title: decode(f.name).trim(), url,
    text: [f.name, positive(f.desc), positive(f.criteria), positive(f.criteria)].join(" ") });
}

// ---------- TF-IDF ----------
const STOP = new Set(("a an and are as at be been but by can could did do does for from had has have how if in into is it its " +
  "may more most much must no not of on one or other our out over own same should so some such than that the their them then " +
  "there these they this those through to too under up very was we were what when where which while who whom why will with " +
  "would you your also any each many often only per rather case cases claim claims funder funders funding litigation finance " +
  "financing capital court courts law legal party parties typically usually").split(" "));
const tokens = t => t.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
  .filter(w => w.length > 2 && !STOP.has(w) && !/^\d+$/.test(w))
  .map(w => w.replace(/(ies)$/, "y").replace(/([^s])s$/, "$1"));

const df = new Map();
for (const d of docs) { d.tf = new Map(); for (const w of tokens(d.text)) d.tf.set(w, (d.tf.get(w) || 0) + 1);
  for (const w of d.tf.keys()) df.set(w, (df.get(w) || 0) + 1); }
const N = docs.length;
for (const d of docs) {
  d.vec = new Map(); let norm2 = 0;
  for (const [w, c] of d.tf) { const v = (1 + Math.log(c)) * Math.log(N / df.get(w)); d.vec.set(w, v); norm2 += v * v; }
  d.norm = Math.sqrt(norm2) || 1;
}
function cos(a, b) { let s = 0; const [x, y] = a.vec.size < b.vec.size ? [a, b] : [b, a];
  for (const [w, v] of x.vec) { const u = y.vec.get(w); if (u) s += v * u; } return s / (a.norm * b.norm); }

// Explicit funder mentions (first distinctive word of the name is enough for most).
function funderAliases(name) {
  const base = name.replace(/\(.*?\)/g, "").replace(/\b(Capital|Group|Partners|Management|Finance|Funding|Legal|Litigation|Asset|Global|Investment|LLC|Ltd)\b/gi, "").trim();
  const aliases = [name.replace(/\(.*?\)/g, "").trim()];
  // Short names that are also ordinary English words ("balance sheet",
  // "validity of the claim") would create false mentions, so they only
  // count when the full name appears.
  const COMMON = new Set(["balance", "validity", "fortress", "orchard", "delta", "harbour", "augusta", "bench walk"]);
  if (base.length >= 5 && !COMMON.has(base.toLowerCase())) aliases.push(base);
  return aliases.map(s => s.toLowerCase());
}
const funders = docs.filter(d => d.type === "funder");
for (const f of funders) f.aliases = funderAliases(f.title);
const mentions = (doc, f) => f.aliases.some(al => new RegExp(`\\b${al.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(doc.text));

function top(doc, pool, n, minScore, boost = () => 0) {
  return pool.filter(o => o !== doc)
    .map(o => ({ o, s: cos(doc, o) + boost(o) }))
    .filter(x => x.s >= minScore)
    .sort((p, q) => q.s - p.s).slice(0, n).map(x => x.o);
}

const articles = docs.filter(d => d.type === "article");
const disputes = docs.filter(d => d.type === "dispute");

const plan = new Map(); // url -> {sections, crumbs}
for (const a of articles) {
  plan.set(a.url, { doc: a, sections: [
    ["Related Research", top(a, articles, 4, 0.06, o => (o.cat === a.cat ? 0.04 : 0))],
    ["Related Disputes", top(a, disputes, 3, 0.07)],
    ["Funder Profiles on This Topic", top(a, funders, 4, 0.13, o => (mentions(a, o) ? 0.25 : 0))],
  ] });
}
for (const f of funders) {
  const named = disputes.filter(d => f.aliases.some(al => d.funders.toLowerCase().includes(al)));
  plan.set(f.url, { doc: f, sections: [
    ["Research on This Funder's Focus", top(f, articles, 4, 0.07, o => (mentions(o, f) ? 0.25 : 0))],
    ["Disputes Involving This Funder", named.slice(0, 5)],
    ["Similar Funders", top(f, funders, 3, 0.08)],
  ] });
}
for (const d of disputes) {
  const named = funders.filter(f => f.aliases.some(al => d.funders.toLowerCase().includes(al)));
  const sections = [["Funder Profiles", named.slice(0, 4)]];
  // The original 50 dispute pages carry hand-curated related blocks. Pages added later
  // (scripts/install-draft.js) do not, so generate them there and only there.
  const html = fs.readFileSync(path.join(ROOT, d.url), "utf8");
  if (!html.includes('<div class="st">Related Research Library Articles</div>')) {
    sections.unshift(["Related Disputes", top(d, disputes, 3, 0.07, o => (o.cat === d.cat ? 0.04 : 0))]);
    sections.unshift(["Related Research", top(d, articles, 4, 0.06)]);
  }
  plan.set(d.url, { doc: d, sections });
}

// ---------- render ----------
const START = "<!-- RELATED:START (generated by scripts/build-related.js, do not hand-edit) -->";
const END = "<!-- RELATED:END -->";
const BC_START = "<!-- BREADCRUMB:START -->";
const BC_END = "<!-- BREADCRUMB:END -->";

function renderSections(sections) {
  const blocks = sections.filter(([, list]) => list.length).map(([label, list]) =>
    `    <div class="modal-sources" style="margin-top:28px; padding-top:20px; border-top:1px solid var(--line);">\n` +
    `      <div class="st">${esc(label)}</div>\n` +
    `      <div>${list.map(o => `<a href="${o.url}">${esc(o.title)}</a>`).join("")}</div>\n    </div>`);
  if (!blocks.length) return "";
  return `${START}\n${blocks.join("\n")}\n    ${END}\n`;
}

const HUB = { article: ["Research Library", "/research.html"], dispute: ["Dispute Library", "/disputes.html"], funder: ["Meet the Financiers", "/financiers.html"] };
function breadcrumb(doc) {
  const [hubName, hubUrl] = HUB[doc.type];
  const json = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: hubName, item: `${SITE}${hubUrl}` },
    { "@type": "ListItem", position: 3, name: doc.title, item: `${SITE}${doc.url}` },
  ] };
  return `${BC_START}\n<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n</script>\n${BC_END}\n`;
}

let changed = 0, linkCount = 0;
const report = [];
for (const [url, { doc, sections }] of plan) {
  const file = path.join(ROOT, url);
  let html = fs.readFileSync(file, "utf8");
  const before = html;

  // strip previous generated blocks
  html = html.replace(new RegExp(`${START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END}\\n?`, "g"), "");
  html = html.replace(new RegExp(`${BC_START}[\\s\\S]*?${BC_END}\\n?`, "g"), "");

  // drop anything already linked on the page so we never duplicate a link
  const already = new Set([...html.matchAll(/href="(\/(?:research|disputes|financiers)\/[^"]+)"/g)].map(m => m[1]));
  const filtered = sections.map(([l, list]) => [l, list.filter(o => !already.has(o.url))]);
  const block = renderSections(filtered);
  filtered.forEach(([, list]) => (linkCount += list.length));
  report.push(`${url}\n${filtered.map(([l, list]) => `   ${l}: ${list.map(o => o.title).join(" | ") || "(none)"}`).join("\n")}`);

  // insert before the "Back to ..." paragraph (last one in the section)
  if (block) {
    const backRe = /(\s*<p style="margin-top:\d+px;"><a href="\/(?:research|disputes|financiers)\.html">&larr; Back to)/;
    if (!backRe.test(html)) { console.warn("no insertion point:", url); continue; }
    html = html.replace(backRe, `\n${block.replace(/\n$/, "")}$1`);
  }
  html = html.replace("</head>", `${breadcrumb(doc)}</head>`);

  if (html !== before) { changed++; if (!DRY) fs.writeFileSync(file, html); }
}

// ---------- hub pages: counts, CollectionPage + ItemList + BreadcrumbList ----------
const HUB_START = "<!-- HUBSCHEMA:START (generated by scripts/build-related.js) -->";
const HUB_END = "<!-- HUBSCHEMA:END -->";
const metaDesc = html => (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
const titleOf = html => ((html.match(/<title>([^<]*)<\/title>/) || [])[1] || "").split("|")[0].trim();

const hubs = [
  { file: "research.html", name: "Research Library", items: articles,
    counts: [[/\b\d+ (Cited Articles|cited articles)/g, n => `${n} $1`]] },
  { file: "disputes.html", name: "Dispute Library", items: disputes,
    counts: [[/\b\d+ (Litigation Finance Disputes|real litigation finance disputes|real disputes)/g, n => `${n} $1`]] },
  { file: "financiers.html", name: "Meet the Financiers", items: funders,
    counts: [[/\b\d+ (Litigation Funders|litigation finance funders|litigation funders)/g, n => `${n} $1`]] },
  { file: "academy.html", name: "Academy" },
  { file: "for-funders.html", name: "For Funders" },
  { file: "privacy.html", name: "Privacy Policy" },
  { file: "terms.html", name: "Terms of Service" },
];
// Funder count reflects profiles a visitor can actually open.
for (const h of hubs) {
  const file = path.join(ROOT, h.file);
  let html = fs.readFileSync(file, "utf8");
  const before = html;
  html = html.replace(new RegExp(`${HUB_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${HUB_END}\\n?`, "g"), "");
  if (h.counts) {
    const n = h.items.length;
    // only rewrite counts in the <head> and in prose, never inside the data arrays
    const dataStart = html.search(/const (articles|disputes|financiers) = \[/);
    const head = dataStart > 0 ? html.slice(0, dataStart) : html;
    const tail = dataStart > 0 ? html.slice(dataStart) : "";
    let newHead = head;
    for (const [re, fn] of h.counts) newHead = newHead.replace(re, fn(n));
    html = newHead + tail;
  }
  const url = `${SITE}/${h.file}`;
  const graph = [];
  if (h.items) {
    graph.push({ "@type": "CollectionPage", "@id": `${url}#page`, url, name: titleOf(html), description: metaDesc(html),
      isPartOf: { "@type": "WebSite", name: "Institute for Litigation Finance", url: `${SITE}/` },
      mainEntity: { "@type": "ItemList", numberOfItems: h.items.length,
        itemListElement: h.items.map((o, i) => ({ "@type": "ListItem", position: i + 1, name: o.title, url: `${SITE}${o.url}` })) } });
  } else {
    graph.push({ "@type": "WebPage", "@id": `${url}#page`, url, name: titleOf(html), description: metaDesc(html),
      isPartOf: { "@type": "WebSite", name: "Institute for Litigation Finance", url: `${SITE}/` } });
  }
  graph.push({ "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name: h.name, item: url } ] });
  const block = `${HUB_START}\n<script type="application/ld+json">\n${JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 2)}\n</script>\n${HUB_END}\n`;
  html = html.replace("</head>", `${block}</head>`);
  if (html !== before) { changed++; if (!DRY) fs.writeFileSync(file, html); }
  if (DRY) console.log(`${h.file}: ${h.items ? h.items.length + " items" : "WebPage"}`);
}

if (DRY) console.log(report.join("\n"));
console.log(`${DRY ? "[dry] " : ""}${plan.size} pages planned, ${changed} changed, ${linkCount} contextual links.`);
