const { corpus, API_KEY, mailer, MODEL, INSIGHTS_WEBHOOK_URL, JSON_HEADERS } = require("./_shared");

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      ok: true,
      hasApiKey: Boolean(API_KEY),
      hasEmail: Boolean(mailer),
      hasInsightsWebhook: Boolean(INSIGHTS_WEBHOOK_URL),
      articles: corpus.articles.length,
      financiers: corpus.financiers.length,
      disputes: (corpus.disputes || []).length,
      model: MODEL
    })
  };
};
