// Pushes every URL in sitemap.xml to the IndexNow API so Bing (and, by
// extension, Copilot/ChatGPT Search/DuckDuckGo/Ecosia, which lean heavily on
// Bing's index) picks up new and changed pages fast instead of waiting on a
// crawl cycle.
//
// Runs automatically as part of the Netlify build (see netlify.toml) on
// every deploy, so it never needs to be triggered by hand. It fails soft:
// if the IndexNow API is unreachable or errors, the build still succeeds --
// this is a nice-to-have ping, not something that should ever break a
// deploy.
//
// Docs: https://www.indexnow.org/documentation

const fs = require('fs');
const path = require('path');

const HOST = 'litigationfinanceinstitute.com';
const KEY = 'aab5e04b200ebcc37e12cc804ab90b9a';
const KEY_LOCATION = 'https://' + HOST + '/' + KEY + '.txt';
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');
const ENDPOINT = 'https://api.indexnow.org/indexnow';

function extractUrlsFromSitemap(xml) {
    const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
    return matches.map((m) => m[1].trim()).filter(Boolean);
}

async function main() {
    let xml;
    try {
          xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
    } catch (err) {
          console.warn('[indexnow] Could not read sitemap.xml, skipping: ' + err.message);
          return;
    }

  const urlList = extractUrlsFromSitemap(xml);
    if (urlList.length === 0) {
          console.warn('[indexnow] No URLs found in sitemap.xml, skipping.');
          return;
    }

  const body = {
        host: HOST,
        key: KEY,
        keyLocation: KEY_LOCATION,
        urlList,
  };

  try {
        const res = await fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
                body: JSON.stringify(body),
        });
        console.log('[indexnow] Submitted ' + urlList.length + ' URLs. Status: ' + res.status + ' ' + res.statusText);
  } catch (err) {
        console.warn('[indexnow] Submission failed (non-fatal): ' + err.message);
  }
}

main();
