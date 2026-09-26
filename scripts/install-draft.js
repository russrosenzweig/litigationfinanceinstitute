#!/usr/bin/env node
// Installs an approved Content Desk draft into the site in one step.
//
//   node scripts/install-draft.js path/to/draft.json --check   validate only, change nothing
//   node scripts/install-draft.js path/to/draft.json           install
//
// A draft is a JSON file of one of two shapes.
//
// Research article:
//   { "type": "article", "slug": "kebab-case-file-name",
//     "entry": { "cat": "...", "title": "...", "teaser": "...",
//                "body": ["paragraph", ...], "sources": [["label", "https://..."], ...] } }
//
// Dispute:
//   { "type": "dispute",
//     "entry": { "name", "cat", "court", "jurisdiction", "year", "citation", "status",
//                "funders", "posture", "background", "holding", "lesson", "slug" },
//     "sources": [["label", "https://..."], ...] }
//
// Installing: writes the page from the site template, appends the entry to the corpus
// array the concierge reads (research.html or disputes.html), adds the hub card, adds the
// sitemap URL, bumps the counts in index.html, llms.txt and CLAUDE.md, then reruns
// scripts/build-related.js so the new page is cross-linked. Nothing is committed or pushed.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SITE = "https://litigationfinanceinstitute.com";
const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const draftPath = args.find(a => !a.startsWith("--"));
if (!draftPath) { console.error("usage: node scripts/install-draft.js draft.json [--check]"); process.exit(2); }

const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
const today = new Date().toISOString().slice(0, 10);

function loadArray(file, name) {
  const src = read(file);
  const start = src.indexOf(`const ${name} = [`);
  const lines = src.slice(start).split("\n");
  const out = [];
  for (const l of lines) { out.push(l); if (l.trim() === "];") break; }
  // eslint-disable-next-line no-eval
  return eval(out.join("\n").replace(`const ${name} =`, "(").replace(/\];\s*$/, "])"));
}

// Escape for HTML text; leave existing entities alone.
const esc = s => String(s).replace(/&(?!amp;|lt;|gt;|quot;|#\d+;|[a-z]+;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attr = s => esc(s).replace(/"/g, "&quot;");
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n).replace(/\s+\S*$/, "") + "...");

// ---------------- validation ----------------
const draft = JSON.parse(fs.readFileSync(path.resolve(draftPath), "utf8"));
const problems = [];
const warn = [];
const raw = JSON.stringify(draft);

if (/[\u2013\u2014]/.test(raw)) problems.push("contains an em dash or en dash (house style forbids both; use a comma, a new sentence, parentheses, or a plain hyphen)");
if (/round\s*table/i.test(raw)) problems.push("names Round Table Group (never named in site copy)");
if (/success fee|finder'?s fee|percentage of (the )?(funding|recovery)/i.test(raw)) warn.push("mentions success/finder fees or percentage compensation; confirm it is describing the market, not the Institute");
if (/<[a-z/][^>]*>/i.test(raw)) problems.push("contains HTML tags; drafts are plain text");

const RESEARCH_CATS = ["Fundamentals", "Damages & Valuation", "Structures", "Industry Verticals", "Regulation & Ethics", "Tax", "History", "Recent Developments"];
const checkSources = (src, min) => {
  if (!Array.isArray(src) || src.length < min) { problems.push(`needs at least ${min} sources`); return; }
  src.forEach((s, i) => {
    if (!Array.isArray(s) || s.length !== 2 || !s[0] || !/^https:\/\//.test(s[1])) problems.push(`source ${i + 1} must be ["label", "https://..."]`);
  });
};
const kebab = s => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s || "");

let type = draft.type, slug, e = draft.entry || {};
if (type === "article") {
  slug = draft.slug;
  for (const k of ["cat", "title", "teaser", "body", "sources"]) if (!e[k] || (Array.isArray(e[k]) && !e[k].length)) problems.push(`entry.${k} is missing`);
  if (e.cat && !RESEARCH_CATS.includes(e.cat)) problems.push(`entry.cat "${e.cat}" is not one of: ${RESEARCH_CATS.join(", ")}`);
  if (Array.isArray(e.body)) {
    const words = e.body.join(" ").split(/\s+/).length;
    if (e.body.length < 3) problems.push("body needs at least 3 paragraphs");
    if (words < 350) problems.push(`body is only ${words} words (minimum 350)`);
    if (words > 2600) warn.push(`body is ${words} words, long for this library`);
  }
  checkSources(e.sources, 2);
  const existing = loadArray("research.html", "articles");
  if (existing.some(a => a.title.trim().toLowerCase() === String(e.title).trim().toLowerCase())) problems.push("an article with this title already exists");
} else if (type === "dispute") {
  const keys = ["name", "cat", "court", "jurisdiction", "year", "citation", "status", "funders", "posture", "background", "holding", "lesson", "slug"];
  for (const k of keys) if (!e[k]) problems.push(`entry.${k} is missing`);
  const extra = Object.keys(e).filter(k => !keys.includes(k));
  if (extra.length) problems.push(`entry has unexpected keys: ${extra.join(", ")}`);
  slug = e.slug;
  const existing = loadArray("disputes.html", "disputes");
  const cats = [...new Set(existing.map(d => d.cat))];
  if (e.cat && !cats.includes(e.cat)) warn.push(`new dispute category "${e.cat}" (existing: ${cats.join(", ")})`);
  if (existing.some(d => d.name.trim().toLowerCase() === String(e.name).trim().toLowerCase())) problems.push("a dispute with this name already exists");
  checkSources(draft.sources, 1);
} else {
  problems.push(`type must be "article" or "dispute"`);
}
if (!kebab(slug)) problems.push(`slug "${slug}" must be lowercase kebab-case`);
const dir = type === "dispute" ? "disputes" : "research";
if (slug && fs.existsSync(path.join(ROOT, dir, `${slug}.html`))) problems.push(`${dir}/${slug}.html already exists`);

for (const w of warn) console.log("WARN  " + w);
for (const p of problems) console.log("FAIL  " + p);
if (problems.length) { console.log(`\n${problems.length} problem(s). Not installed.`); process.exit(1); }
console.log(`OK    ${type} "${type === "article" ? e.title : e.name}" -> /${dir}/${slug}.html`);
if (CHECK) process.exit(0);

// ---------------- templates ----------------
function shell(templateFile) {
  const t = read(templateFile);
  const bodyStart = t.indexOf("<body>");
  const mainStart = t.indexOf('<div style="padding-top:44px;"></div>');
  const mainEnd = t.indexOf("</section>", t.indexOf("<section", mainStart)) + "</section>".length;
  if (bodyStart < 0 || mainStart < 0 || mainEnd < 10) throw new Error(`template ${templateFile} has an unexpected structure`);
  return { header: t.slice(bodyStart, mainStart), footer: t.slice(mainEnd) };
}

function head({ title, section, desc, url, headline, articleSection }) {
  const ld = { "@context": "https://schema.org", "@type": "Article", headline, description: desc, articleSection, url,
    datePublished: today, dateModified: today,
    author: { "@type": "Organization", name: "Institute for Litigation Finance", url: `${SITE}/` },
    publisher: { "@type": "Organization", name: "Institute for Litigation Finance", url: `${SITE}/` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url } };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | ${section} | Institute for Litigation Finance</title>
<meta name="description" content="${attr(desc)}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Institute for Litigation Finance">
<meta property="og:title" content="${attr(title)} | Institute for Litigation Finance">
<meta property="og:description" content="${attr(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og-image.png">
<meta name="twitter:title" content="${attr(title)}">
<meta name="twitter:description" content="${attr(desc)}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="/styles.css">
<script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
</script>
</head>
`;
}

const sourcesBlock = src => `    <div class="modal-sources" style="margin-top:32px; padding-top:20px; border-top:1px solid var(--line);">
      <div class="st">Sources</div>
      <div>${src.map(([l, u]) => `<a href="${attr(u)}" target="_blank" rel="noopener">${esc(l)}</a>`).join("")}</div>
    </div>
`;

// Serialize an entry the way the existing arrays are written (one object literal per entry).
const js = s => JSON.stringify(s);
function articleLiteral(a) {
  return `{cat:${js(a.cat)}, title:${js(a.title)}, teaser:${js(a.teaser)}, body:[\n${a.body.map(js).join(",\n")}\n], sources:${JSON.stringify(a.sources)}},`;
}
function disputeLiteral(d) {
  const keys = ["name", "cat", "court", "jurisdiction", "year", "citation", "status", "funders", "posture", "background", "holding", "lesson", "slug"];
  return `{${keys.map(k => `${k}:${js(d[k])}`).join(", ")}},`;
}

function appendToArray(file, name, literal) {
  let src = read(file);
  const start = src.indexOf(`const ${name} = [`);
  const lines = src.slice(start).split("\n");
  let offset = start, closeAt = -1;
  for (const l of lines) { if (l.trim() === "];") { closeAt = offset; break; } offset += l.length + 1; }
  if (closeAt < 0) throw new Error(`could not find the end of ${name} in ${file}`);
  let before = src.slice(0, closeAt).replace(/\s*$/, "");
  if (!before.endsWith(",")) before += ",";
  return before + "\n" + literal + "\n" + src.slice(closeAt);
}

function insertCard(file, card) {
  let src = read(file);
  let best = -1, bestEnd = -1;
  for (const m of src.matchAll(/<a class="article"[^>]*data-idx="(\d+)"[\s\S]*?<\/a>/g)) {
    const i = Number(m[1]); if (i > best) { best = i; bestEnd = m.index + m[0].length; }
  }
  if (bestEnd < 0) throw new Error(`no cards found in ${file}`);
  return src.slice(0, bestEnd) + "\n      " + card + src.slice(bestEnd);
}

// ---------------- install ----------------
const url = `${SITE}/${dir}/${slug}.html`;
if (type === "article") {
  const { header, footer } = shell("research/collectability-matters-more-than-liability.html");
  const page = head({ title: e.title, section: "Research Library", desc: e.teaser, url, headline: e.title, articleSection: e.cat }) + header +
`<div style="padding-top:44px;"></div>
<section style="padding-top:60px;">
  <div class="wrap-narrow prose">
    <div class="eyebrow">${esc(e.cat)}</div>
    <h1 style="font-family:Georgia,serif; font-size:32px; color:var(--navy); line-height:1.25; margin-bottom:18px;">${esc(e.title)}</h1>
${e.body.map(p => `    <p>${esc(p)}</p>`).join("\n")}
${sourcesBlock(e.sources)}    <p style="margin-top:32px;"><a href="/research.html">&larr; Back to the Research Library</a></p>
  </div>
</section>` + footer;
  const idx = loadArray("research.html", "articles").length;
  write(`research/${slug}.html`, page);
  write("research.html", appendToArray("research.html", "articles", articleLiteral(e)));
  write("research.html", insertCard("research.html",
    `<a class="article" href="/research/${slug}.html" data-cat="${e.cat}" data-idx="${idx}"><span class="tag">${e.cat}</span><h4>${esc(e.title)}</h4><p>${esc(e.teaser)}</p></a>`));
} else {
  const { header, footer } = shell("disputes/carina-ventures-llc-v-pilgrim-s-pride-corp.html");
  const desc = clip(e.holding, 180);
  const h3 = (t, first) => `    <h3 style="font-family:Georgia,serif; color:var(--navy); ${first ? "font-size:18px; margin-top:8px;" : "margin-top:28px; font-size:18px;"}">${t}</h3>`;
  const page = head({ title: e.name, section: "Dispute Library", desc, url, headline: e.name, articleSection: e.cat }) + header +
`<div style="padding-top:44px;"></div>
<section style="padding-top:60px;">
  <div class="wrap-narrow prose">
    <div class="eyebrow">${esc(e.cat)}</div>
    <h1 style="font-family:Georgia,serif; font-size:28px; color:var(--navy); line-height:1.3; margin-bottom:8px;">${esc(e.name)}</h1>
    <p style="font-family:-apple-system,sans-serif; font-size:13px; color:var(--muted); margin-bottom:6px;">${esc(e.court)} &middot; ${esc(e.jurisdiction)} &middot; ${esc(e.year)} &middot; ${esc(e.status)}</p>
    <p style="font-family:-apple-system,sans-serif; font-size:12.5px; color:var(--muted); margin-bottom:24px;">Citation/Docket: ${esc(e.citation)}</p>

${h3("Parties &amp; Funders", true)}
    <p><strong>Posture:</strong> ${esc(e.posture)}<br><strong>Funder(s) involved:</strong> ${esc(e.funders)}</p>

${h3("Background")}
    <p>${esc(e.background)}</p>

${h3("Holding &amp; Outcome")}
    <p>${esc(e.holding)}</p>

${h3("Practical Lesson")}
    <p>${esc(e.lesson)}</p>

${sourcesBlock(draft.sources)}    <div class="neutral-block" style="margin-top:28px;">
      <p>Matters like this one often turn on expert testimony, on valuation, industry custom and practice, legal ethics, or damages. The Institute partners with world-class expert witness referral companies for this purpose.</p>
    </div>

    <p style="font-family:-apple-system,sans-serif; font-size:11.5px; color:var(--muted); margin-top:24px; line-height:1.6;">Compiled from public sources (court filings, published opinions, and secondary reporting). This is educational material, not legal advice; case citations should be independently verified before relied upon.</p>

    <p style="margin-top:24px;"><a href="/disputes.html">&larr; Back to the Dispute Library</a></p>
  </div>
</section>` + footer;
  const idx = loadArray("disputes.html", "disputes").length;
  write(`disputes/${slug}.html`, page);
  write("disputes.html", appendToArray("disputes.html", "disputes", disputeLiteral(e)));
  write("disputes.html", insertCard("disputes.html",
    `<a class="article" href="/disputes/${slug}.html" data-cat="${esc(e.cat)}" data-idx="${idx}"><span class="tag">${esc(e.cat)}</span><h4>${esc(e.name)}</h4><p>${esc(clip(e.holding, 120).replace(/\.\.\.$/, "\u2026"))}</p></a>`));
}

// sitemap
let sm = read("sitemap.xml");
if (!sm.includes(url)) {
  sm = sm.replace("</urlset>", `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>`);
  write("sitemap.xml", sm);
}

// counts
const nA = loadArray("research.html", "articles").length;
const nD = loadArray("disputes.html", "disputes").length;
write("index.html", read("index.html")
  .replace(/(data-count="articles">)\d+/g, `$1${nA}`)
  .replace(/(data-count="disputes">)\d+/g, `$1${nD}`));
write("llms.txt", read("llms.txt")
  .replace(/\b\d+ cited articles/g, `${nA} cited articles`)
  .replace(/\b\d+ real, cited/g, `${nD} real, cited`));
write("CLAUDE.md", read("CLAUDE.md")
  .replace(/`research\/`, \d+ research library articles\. `disputes\/`, \d+ dispute pages\./, `\`research/\`, ${nA} research library articles. \`disputes/\`, ${nD} dispute pages.`));

// cross-links, breadcrumbs, hub counts
execFileSync(process.execPath, [path.join(__dirname, "build-related.js")], { stdio: "inherit" });

// ---------------- verify ----------------
const after = type === "article" ? loadArray("research.html", "articles") : loadArray("disputes.html", "disputes");
const last = after[after.length - 1];
const ok = type === "article" ? last.title === e.title : last.name === e.name;
const pageHtml = read(`${dir}/${slug}.html`);
const dashFree = !/[\u2013\u2014]/.test(pageHtml);
const ldOk = [...pageHtml.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].every(m => { try { JSON.parse(m[1]); return true; } catch { return false; } });
console.log(`${ok ? "OK  " : "FAIL"}  corpus array now has ${after.length} entries, last is the new one`);
console.log(`${dashFree ? "OK  " : "FAIL"}  page is dash-free`);
console.log(`${ldOk ? "OK  " : "FAIL"}  page JSON-LD parses`);
console.log(`\nInstalled /${dir}/${slug}.html. Review with git diff, then commit. Nothing was pushed.`);
if (!ok || !dashFree || !ldOk) process.exit(1);
