const { corpus, API_KEY, mailer, MODEL, JSON_HEADERS } = require("./_shared");

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: JSON_HEADERS,
    body: JSON.stringify({
      ok: true,
      hasApiKey: Boolean(API_KEY),
      hasEmail: Boolean(mailer),
      articles: corpus.articles.length,
      financiers: corpus.financiers.length,
      model: MODEL
    })
  };
};
