# Durability: why data/ keeps emptying, and how to fix it

## The problem

Render's free tier gives the app an **ephemeral filesystem**. Everything under
`data/` is wiped on every deploy and every restart. Since a push to `main`
triggers a redeploy, the practical effect is that local data does not survive
normal development.

Two things live under `data/`, and one of them was silently broken.

**`insights.jsonl`** (anonymized conversation tags). These are mirrored to a
Google Sheet by `INSIGHTS_WEBHOOK_URL`, so the underlying data survives. But
`/api/insights-summary` and `/api/demand-brief` read the local file, so they
reported near-zero while the real history sat in a spreadsheet that nothing on
the site could read. As of August 2026 the live summary endpoint reported one
total conversation. That was not the true number.

**`funder-alerts.jsonl`** (funder Deal Alert registrations). Worse. These were
written to the local file only, with no webhook mirror at all. After any
deploy, `loadFunderAlerts()` returned an empty array, so
`matchAndNotifyFunders()` matched nothing and no registered funder was ever
notified again. The signup confirmation emails were the only surviving record,
and they are not machine readable. This was a functional bug, not just a data
retention issue.

## The fix

Treat `data/` as a cache and the Google Sheet as the source of truth:

- **Write:** already handled. `INSIGHTS_WEBHOOK_URL` mirrors insights, and
  `FUNDER_ALERTS_WEBHOOK_URL` now mirrors alerts the same way.
- **Read:** on boot, `rehydrateAll()` pulls the full history back from
  `INSIGHTS_READ_URL` and `FUNDER_ALERTS_READ_URL` and rewrites the local files.

Both read URLs are **optional**. If unset, the app behaves exactly as before,
so this code is safe to deploy before the endpoints exist. It logs a warning at
boot and `GET /api/health` reports `durableStore: false` with an explanation.

## Setup, roughly fifteen minutes

### 1. Add a GET handler to the existing Apps Script

Open the Google Sheet receiving insights, then Extensions, Apps Script. The
script already has a `doPost`. Add a `doGet` alongside it:

```javascript
function doGet(e) {
  var sheetName = (e && e.parameter && e.parameter.sheet) || 'Insights';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var headers = values[0];
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      var key = String(headers[j]).trim();
      if (!key) continue;
      var val = values[i][j];
      // key_topics is stored as a comma-joined string; send it back as an array
      if (key === 'key_topics' && typeof val === 'string') {
        obj[key] = val ? val.split(',').map(function (s) { return s.trim(); }) : [];
      } else if (key === 'exchange_mentioned') {
        obj[key] = (val === true || val === 'true' || val === 'TRUE');
      } else {
        obj[key] = val;
      }
    }
    if (obj.session) rows.push(obj);
  }

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. Add a second sheet for funder alerts

In the same spreadsheet, add a tab named `FunderAlerts`. Extend `doPost` to
route by payload shape, since alerts and insights have different fields:

```javascript
function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  // Funder alert registrations carry a firm; insight records carry a session.
  var sheetName = data.firm ? 'FunderAlerts' : 'Insights';
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(Object.keys(data));
  }
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function (h) {
    var v = data[h];
    return Array.isArray(v) ? v.join(', ') : (v === undefined ? '' : v);
  });
  sheet.appendRow(row);

  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 3. Redeploy the Apps Script

Deploy, New deployment, type Web app. Execute as **Me**. Who has access:
**Anyone**. Copy the `/exec` URL.

The URL is unguessable but not authenticated, so treat it as a secret. The data
behind it is already anonymized (no claimant names, emails, or phone numbers,
enforced by `INSIGHTS_SCHEMA_PROMPT`), but funder alert rows do contain funder
contact details, so do not publish the URL.

### 4. Set the Render environment variables

In the Render dashboard, add:

```
FUNDER_ALERTS_WEBHOOK_URL = <the /exec URL>
INSIGHTS_READ_URL         = <the /exec URL>?sheet=Insights
FUNDER_ALERTS_READ_URL    = <the /exec URL>?sheet=FunderAlerts
```

`INSIGHTS_WEBHOOK_URL` should already be set. It can be the same `/exec` URL.

### 5. Verify

After the redeploy, check `GET /api/health`. Expect:

```
"durableStore": true,
"durabilityWarning": null,
"activeFunderAlerts": <a number that survives the next deploy>,
"insightRecords": <the full history from the Sheet, not 0 or 1>
```

The boot log should show `[durability] restored N insight record(s) from remote
store`. Push a trivial commit and confirm the counts do not reset.

## Related known issues

- `sessionEmailsSent` and `sessionMidTagged` are in-memory Sets. A restart
  between two end-of-session signals can double-send one transcript email, or
  cause one extra insight tag. Low impact, same root cause, would be fixed by
  moving those keys into the durable store too.
- `notifiedPairs` (funder alert dedupe) is also in-memory, so a restart
  mid-conversation could re-notify a funder once about the same matter.
