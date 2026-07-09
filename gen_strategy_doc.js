const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, AlignmentType, LevelFormat, convertInchesToTwip
} = require("docx");

const NAVY = "0B1F3A";
const GOLD = "B8923F";
const MUTED = "5B6472";
const LINE = "E4DFD3";

function h1(text){ return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing:{before:360, after:160} }); }
function h2(text){ return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing:{before:260, after:120} }); }
function body(text, opts={}){
  return new Paragraph({
    spacing:{after:160, line:276},
    children:[ new TextRun({text, size:22, color:"1B2430", ...opts}) ]
  });
}
function bullet(text){
  return new Paragraph({
    numbering:{ reference:"bullets", level:0 },
    spacing:{after:90},
    children:[ new TextRun({text, size:22, color:"1B2430"}) ]
  });
}
function label(text){
  return new Paragraph({ spacing:{before:200, after:60}, children:[ new TextRun({text, bold:true, size:20, color:GOLD, allCaps:true, characterSpacing:20}) ]});
}
function pageBreakPara(){ return new Paragraph({ children:[], pageBreakBefore:true }); }

function cell(text, {header=false, width=2000, shade=null, bold=false, color="1B2430"}={}){
  return new TableCell({
    width:{size:width, type:WidthType.DXA},
    shading: shade ? {type:ShadingType.CLEAR, color:"auto", fill:shade} : undefined,
    margins:{top:100, bottom:100, left:120, right:120},
    children:[ new Paragraph({ children:[ new TextRun({text, bold: header||bold, size:20, color: header? "FFFFFF": color}) ] }) ]
  });
}

const tierTable = new Table({
  width:{size:9350, type:WidthType.DXA},
  columnWidths:[1700,2100,5550],
  rows:[
    new TableRow({children:[cell("Tier",{header:true,width:1700,shade:NAVY}), cell("Model",{header:true,width:2100,shade:NAVY}), cell("What's Included",{header:true,width:5550,shade:NAVY})]}),
    new TableRow({children:[cell("Free",{width:1700,shade:"F7F5F0",bold:true}), cell("Open access",{width:2100}), cell("Full research library, Ask Lex (AI Professor), basic preliminary screening",{width:5550})]}),
    new TableRow({children:[cell("Premium",{width:1700,shade:"F7F5F0",bold:true}), cell("Per-assessment fee",{width:2100}), cell("Full Institute Report (20 pages): scoring, confidence intervals, suggested funding structures",{width:5550})]}),
    new TableRow({children:[cell("Professional",{width:1700,shade:"F7F5F0",bold:true}), cell("Success-based / placement fee",{width:2100}), cell("Case packaging, funding memorandum, curated funder introductions, negotiation support",{width:5550})]}),
    new TableRow({children:[cell("Institutional",{width:1700,shade:"F7F5F0",bold:true}), cell("Annual license",{width:2100}), cell("Private funder dashboard, custom alert preferences, anonymized market analytics",{width:5550})]}),
  ]
});

const roadmapTable = new Table({
  width:{size:9350, type:WidthType.DXA},
  columnWidths:[1500,3300,4550],
  rows:[
    new TableRow({children:[cell("Phase",{header:true,width:1500,shade:NAVY}), cell("Focus",{header:true,width:3300,shade:NAVY}), cell("Goal",{header:true,width:4550,shade:NAVY})]}),
    new TableRow({children:[cell("Phase 1",{width:1500,shade:"F7F5F0",bold:true}), cell("Research Library + Lex (AI Professor)",{width:3300}), cell("Build organic authority and SEO before any marketplace claims are made; no funder-facing promises yet",{width:4550})]}),
    new TableRow({children:[cell("Phase 2",{width:1500,shade:"F7F5F0",bold:true}), cell("Concierge + Institute Report",{width:3300}), cell("Convert traffic into structured intake; begin building the proprietary case-outcome dataset",{width:4550})]}),
    new TableRow({children:[cell("Phase 3",{width:1500,shade:"F7F5F0",bold:true}), cell("The Exchange: funder profiles + dashboards",{width:3300}), cell("Launch matching only once inbound volume justifies funder onboarding effort",{width:4550})]}),
    new TableRow({children:[cell("Phase 4",{width:1500,shade:"F7F5F0",bold:true}), cell("Institutional analytics + platform expansion",{width:3300}), cell("Anonymized market insights product; template for adjacent Digital Echo verticals",{width:4550})]}),
  ]
});

const doc = new Document({
  numbering:{
    config:[{ reference:"bullets", levels:[{level:0, format:LevelFormat.BULLET, text:"•", alignment:AlignmentType.LEFT, style:{paragraph:{indent:{left:convertInchesToTwip(0.3), hanging:convertInchesToTwip(0.15)}}}}]}]
  },
  sections:[{
    properties:{ page:{ size:{width:12240, height:15840}, margin:{top:1080,bottom:1080,left:1080,right:1080} } },
    children:[
      new Paragraph({ spacing:{after:40}, children:[ new TextRun({text:"STRATEGY & BUSINESS PLAN", bold:true, size:20, color:GOLD, allCaps:true, characterSpacing:30}) ]}),
      new Paragraph({ spacing:{after:100}, children:[ new TextRun({text:"Institute for Litigation Finance", bold:true, size:44, color:NAVY}) ]}),
      new Paragraph({ spacing:{after:400}, children:[ new TextRun({text:"Prepared for Russy  •  July 8, 2026", size:20, color:MUTED, italics:true}) ]}),
      new Paragraph({ border:{bottom:{color:LINE, space:1, style:BorderStyle.SINGLE, size:6}}, spacing:{after:300} }),

      h1("Executive Summary"),
      body("The Institute for Litigation Finance is an education-first platform that reframes litigation finance matching as market infrastructure rather than lead generation. The site leads with mission — access to justice — not with financing, and builds credibility through an extensive research library and an AI professor before ever introducing a marketplace. The core insight in the original vision is sound and unusually well-suited to an AI-native product: this is one of the few domains where the AI is not a support feature but the primary product — it teaches, interviews, scores, and orchestrates introductions."),
      body("This document lays out brand architecture, product sequencing, the business model, and the risk considerations that should shape how this gets built, alongside how it connects to the broader Digital Echo concierge platform thesis."),

      h1("Positioning & Brand Architecture"),
      body("A competitive check turned up no exact matches for “Litigation Finance Institute,” “International Institute for Litigation Finance,” or “The Litigation Finance Exchange.” The closest adjacent organizations are the International Legal Finance Association (ILFA), the industry’s trade association for funders themselves, and the International Institute of Law & Finance (IILF), a broader academic law-and-finance institute unrelated to litigation funding specifically. The name space is open, though a formal trademark and domain search is still warranted before launch."),
      body("Rather than choosing a single name, the recommendation is a two-tier brand architecture:"),
      bullet("Institute for Litigation Finance — the master brand, carrying the academic authority needed for the research and education layer to be taken seriously."),
      bullet("The Exchange — a named product within the Institute for the matching marketplace, invoked once a user is ready to be introduced to capital. This mirrors how S&P Global houses the S&P 500 index, or how CME Group operates as the parent of an actual exchange."),
      body("This separation matters commercially: it lets the Institute be indexed, cited, and trusted as a neutral reference work, while the Exchange carries the transactional, matching-specific framing without diluting that neutrality."),

      h1("Product Architecture"),
      h2("1. Learn"),
      body("A plain-language orientation to litigation finance — history, economics, ethics, returns, portfolio theory, leading cases and scholars, major funders, regulatory issues, tax, and international developments. This is the entry point for first-time visitors arriving from search."),
      h2("2. Research Library"),
      body("The long-tail content engine: hundreds of articles in one consistent voice — academic but readable — covering financeability criteria, damages, collectability, industry verticals (patent, trade secret, international arbitration), structures (portfolio financing, law firm lending, appeal financing), and investor psychology. This is the primary SEO and authority asset, and should be built out before the marketplace launches."),
      h2("3. Lex — the AI Professor"),
      body("A conversational interface trained across the research corpus, funder criteria, procedural law, case law, and finance theory. Distinct from the Concierge: Lex teaches and answers open-ended questions; it does not collect a case for assessment."),
      h2("4. The Concierge"),
      body("An interview-driven intake flow (“tell me your story,” not “upload documents”) that gathers case facts conversationally, then produces a preliminary, funder-style scorecard across dimensions such as liability clarity, damages support, collectability, jurisdiction, and counsel quality — paired with plain-English explanations of why each score landed where it did. This is the moment the product becomes genuinely educational rather than transactional."),
      h2("5. The Institute Report"),
      body("A premium, twenty-page deliverable: executive summary, strengths and weaknesses, likely funder objections, suggested funding structures, ideal funder profiles, comparable funded matters, and educational references. This is the natural monetization point before any introduction is made."),
      h2("6. The Exchange"),
      body("A curated marketplace of funder profiles (minimum investment, industries, jurisdictions, risk tolerance, structural preferences), matched narrowly — three introductions, not a mass blast. Funders get private dashboards to set standing alert criteria (“notify us whenever…”), so the system proactively surfaces matching inquiries rather than requiring funders to search."),
      h2("7. The Meritoriousness Academy"),
      body("A standalone education track on how sophisticated investors actually analyze disputes — liability vs. damages, merits vs. collectability, time value of money, jurisdiction and enforcement risk, portfolio diversification. Framed as durable, shareable content independent of whether the user ever seeks funding — strong organic distribution potential (the kind of content that gets cited and linked)."),

      h1("Business Model"),
      body("Four layers, structured so the Institute’s primary identity stays educational and analytical, with matching as a natural extension rather than the front door:"),
      new Paragraph({ spacing:{before:120, after:280}, children:[] }),
      tierTable,

      pageBreakPara(),
      h1("Sequencing & Roadmap"),
      body("The marketplace cannot work on day one — it needs content-driven traffic and a critical mass of funder profiles before matching has any value. Recommended sequencing:"),
      new Paragraph({ spacing:{before:120, after:280}, children:[] }),
      roadmapTable,

      h1("Risk & Compliance Considerations"),
      label("Scoring and liability exposure"),
      body("Presenting a case with a precise numeric score (e.g., “Funding attractiveness: 83”) edges toward investment advice or case valuation, which invites scrutiny in jurisdictions that specifically regulate litigation finance disclosure. Recommendation: use qualitative bands (Strong / Moderate / Needs Development / Unknown) rather than false-precision numbers, and pair every score with explicit “educational, not legal or investment advice” framing. Disclaimer language should be reviewed by qualified counsel before real users interact with the Concierge."),
      label("Regulatory variance"),
      body("Litigation finance disclosure and regulation differ materially by U.S. state and by country. Content and disclaimers should avoid blanket claims and instead route users toward jurisdiction-specific guidance where it matters (e.g., states with mandatory funding disclosure rules)."),
      label("Trust as the actual product"),
      body("In a category this new, credibility is the binding constraint, not content volume. A visible advisory board — retired judges, academics, and funder veterans — will move conversion more than the size of the research library. This should appear prominently on the homepage, not buried in an About page."),
      label("Cold-start sequencing"),
      body("Launching all four business-model layers simultaneously risks an empty-feeling marketplace. Content and education should run well ahead of any funder-facing claims."),

      h1("Data Moat & Long-Term Defensibility"),
      body("The durable asset here is not the marketing content — it is the anonymized outcomes dataset: cases scored, funded, and resolved, with results tracked over time. This is what would eventually make Lex’s assessments genuinely predictive rather than well-read. The data model for capturing this (case attributes → score → funding outcome → resolution outcome) should be designed from the outset, even while the corpus is thin, so early users are already contributing to the asset that compounds."),

      h1("Connection to the Digital Echo Platform Vision"),
      body("The architecture here — research corpus, intelligent interview, personalized assessment, curated introductions, ongoing orchestration — is domain-agnostic. If it works for litigation finance, the same pattern should transfer to other high-stakes, high-complexity decisions: executive education, failure analysis, specialized scientific or technical consulting, and other long-tail expert domains. The Institute for Litigation Finance is best understood as the first proof point for that broader concierge model, not a one-off vertical product."),

      h1("Next Steps"),
      bullet("Run a formal trademark and domain availability check on the recommended name (Institute for Litigation Finance / The Exchange)."),
      bullet("Identify and recruit 3–4 real advisory board members before any public launch."),
      bullet("Commission the first 15–20 research library articles to establish voice and SEO footing."),
      bullet("Have litigation finance counsel review Concierge scoring language and all disclaimers."),
      bullet("Define the case-outcome data schema before Concierge intake begins, so early data is usable later."),
    ]
  }]
});

Packer.toBuffer(doc).then(buf => {
  require("fs").writeFileSync("Institute-for-Litigation-Finance-Strategy.docx", buf);
  console.log("done");
});
