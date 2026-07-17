const { JSON_HEADERS } = require("./_shared");
const { buildDemandBrief } = require("./_insights");

// Funder-facing "State of Demand" brief — ranked, percented, windowed. Powers
// for-funders.html. Read-only; safe to call as often as the page loads.
exports.handler = async () => {
  try {
    const brief = await buildDemandBrief();
    return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify(brief) };
  } catch (e) {
    console.error("Failed to build demand brief:", e.message);
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: "Failed to build demand brief." }) };
  }
};
