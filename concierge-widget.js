/* ====================================================================
   Institute for Litigation Finance — shared AI Concierge widget.
   Loaded on every page. On the homepage it "docks" into the existing
   hero panel (a container with id="concierge-dock"); on every other
   page it builds a small floating bubble + panel in the corner.
   Conversation state is kept in sessionStorage so it survives clicking
   between pages within the same browser tab/session — closing the tab
   clears it, matching how a normal chat session should behave.
   ==================================================================== */

/* ---- Google Analytics (GA4) ----
   Loaded here rather than pasted into every individual HTML file, since
   this script already runs on all 5 core pages plus all 72 generated
   research/financier detail pages — one change here covers the whole site. */
(function(){
  var gaScript = document.createElement("script");
  gaScript.async = true;
  gaScript.src = "https://www.googletagmanager.com/gtag/js?id=G-T8XNM16PZ6";
  document.head.appendChild(gaScript);
  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', 'G-T8XNM16PZ6');
})();

/* ---- Conversion events (GA4 -> imported into Google Ads) ----
   Two signals, deliberately kept separate, using the key event names already
   configured in GA4 (Admin > Events): qualify_lead fires once per browser
   session the first time someone actually sends a live message to the
   Concierge (a real "used the product" signal, not just a page view), and
   close_convert_lead fires when someone submits the "Request a follow-up"
   form (the strongest intent signal on the site). Both are safe no-ops if
   gtag hasn't loaded yet for any reason. */
function trackEvent(name, params){
  try{
    if(typeof window.gtag === 'function'){
      window.gtag('event', name, params || {});
    }
  }catch(e){ /* never let analytics break the page */ }
}

(function(){

const WELCOME_HTML = "Welcome. Whether you're a business owner, a lawyer, an investor, or just curious, I'm here to help you understand a matter. To tailor this conversation, which best describes you today?";

const ROLES = {
  claimant: {
    audience: "a business owner, claimant, or law firm with a legal matter seeking assessment",
    demoReply: "Thank you &mdash; my job is to help you assess the likelihood of securing litigation financing, and where it fits, help connect you with the most suitable financier. I have a few questions that will help me understand the legal and financial characteristics of this matter. Tell me what happened: who's involved, roughly when, and what you're hoping to resolve. There's no form to fill out &mdash; just tell me the story, and I'll ask follow-ups as we go.",
    followups: [
      {label:"We won arbitration. The defendant won't pay.", demo:"manufacturing"},
      {label:"Why does collectability matter more than liability?", demo:"collectability"},
      {label:"Start my case assessment", action:"assessment"}
    ]
  },
  lawyer: {
    audience: "a lawyer or law firm exploring financing options on behalf of a client",
    demoReply: "Good &mdash; I'll treat this the way I'd treat a call from outside counsel. Tell me about the matter: claim type, jurisdiction, stage of litigation, and what kind of capital you're exploring (fees, working capital, portfolio, appeal bond). I'll walk through it the way an institutional investor would, and flag where the record needs more support before approaching the market.",
    followups: [
      {label:"How is patent litigation finance different?", demo:"patent"},
      {label:"What makes a case financeable?", demo:"collectability"},
      {label:"Start a case assessment", action:"assessment"}
    ]
  },
  funder: {
    audience: "a representative of a litigation finance firm or funder, here to share investment criteria",
    demoReply: "Welcome &mdash; it's good to have you here. How can I help you today? (And whenever you're ready: one thing we do is try to send funders matters that actually fit what they're looking for, rather than shopping every deal to everyone. If you have about five minutes, I'd love to ask a few questions about your investment criteria so we can flag genuine fits for your firm &mdash; entirely up to you.)",
    followups: [
      {label:"What industries do you focus on?", demo:"funderIndustries"},
      {label:"Tell me about your risk appetite instead", demo:"funderRisk"}
    ]
  },
  researcher: {
    audience: "a researcher, academic, journalist, or policymaker studying litigation finance",
    demoReply: "Happy to help. The Research Library covers fundamentals, structures, regulation and ethics, tax, and history, all cited to primary sources. Our flagship aggregate publication, The State of Litigation Finance, is forthcoming and not yet published &mdash; ask me about any specific topic in the meantime and I'll point you to the relevant research and sources.",
    followups: [
      {label:"What's in the research library?", demo:"library"},
      {label:"Tell me about The State of Litigation Finance report", demo:"stateReport"}
    ]
  },
  other: {
    audience: "someone exploring the site generally, role not yet specified",
    demoReply: "No problem &mdash; ask me anything about litigation finance, or tell me what brought you here, and I'll take it from there.",
    followups: [
      {label:"We won arbitration. The defendant won't pay.", demo:"manufacturing"},
      {label:"Why does collectability matter more than liability?", demo:"collectability"},
      {label:"How is patent litigation finance different?", demo:"patent"}
    ]
  }
};

const demos = {
  manufacturing: {kw:["defendant won't pay","defendant wont pay","won arbitration","won't pay","wont pay","collect on my judgment","enforce my judgment","enforcement"],
    reply:"That's a well-suited profile for <strong>judgment enforcement financing</strong> &mdash; capital advanced against an award you've already won, used to fund collection: asset tracing, cross-border enforcement, local counsel. Funders favor this category because liability is already resolved; the open question becomes collectability. I'd want to know next: is the defendant solvent, where are its assets, and has an enforcement strategy been mapped out yet? <a href='/research.html' style=\"color:#D8BE85;\">See: Judgment Enforcement Financing &rarr;</a>"},
  collectability: {kw:["collectability","collectible","why does liability","strong case","win my case","case is strong"],
    reply:"Because a favorable ruling that can't be collected is worth zero to a funder. Liability tells you whether you're right; collectability tells you whether you'll ever see the money. Funders will often pass on a near-certain win against an insolvent, judgment-proof defendant, and take real interest in a messier liability picture against a defendant with clear, reachable assets. <a href='/research.html' style=\"color:#D8BE85;\">See: Collectability Matters More Than Liability &rarr;</a>"},
  patent: {kw:["patent","ip litigation","intellectual property"],
    reply:"Patent cases are financed more like venture bets than commercial disputes: damages models are heavily contested, timelines often run 3&ndash;5 years through appeal, and outcomes are frequently binary. Roughly 61% of patent suits filed since 2020 are believed to involve funding. Funders compensate for the risk by pricing in wide return ranges and favoring strong prior art positions and reputable damages experts. <a href='/research.html' style=\"color:#D8BE85;\">See: Patent & IP Litigation Financing &rarr;</a>"},
  funderIndustries: {kw:["what industries","which industries","what sectors","focus areas","what do you fund"],
    reply:"Across the Financier directory, commercial disputes, patent/IP, and construction &amp; energy see the deepest funder coverage, with growing appetite in international arbitration. In a live conversation I'd ask about your firm's specific focus and log it as part of your investment profile. <a href='/financiers.html' style=\"color:#D8BE85;\">See: Meet the Financiers &rarr;</a>"},
  funderRisk: {kw:["risk appetite","risk tolerance"],
    reply:"Risk appetite is one of the first things the Exchange profiles &mdash; strong-merits vs. novel-theory tolerance, matter size, and duration preference all shape which inquiries we'd ever bring to you. In live mode I'd build this into your Living Investment Profile as we talk."},
  library: {kw:["research library","what's in the library","whats in the library","topics covered","what do you have"],
    reply:"The library runs across Fundamentals, Damages &amp; Valuation, Structures, Industry Verticals, Regulation &amp; Ethics, Tax, and History &mdash; all cited to primary sources. <a href='/research.html' style=\"color:#D8BE85;\">Browse it here &rarr;</a>"},
  stateReport: {kw:["state of litigation finance","annual report","flagship report"],
    reply:"The State of Litigation Finance is the Institute's forthcoming annual report, built from aggregated, privacy-protected inquiry data &mdash; industry demand trends, financeability characteristics, and emerging structures. It hasn't published yet. <a href='/about.html#pillars' style=\"color:#D8BE85;\">Read more on the About page &rarr;</a>"},
  cost: {kw:["cost","fee","fees","price","pricing","charge","how much","expensive","retainer","payment"],
    reply:"Engagement terms and fees are discussed individually and vary by matter &mdash; that's intentional, since every case is different. If you'd like specifics for your situation, use \"Request a follow-up\" below and the Institute's Executive Director will reach out directly."},
  loan: {kw:["is this a loan","a loan","borrow money","take on debt","interest rate"],
    reply:"No &mdash; litigation finance is almost always structured as a non-recourse purchase of a contingent interest in a claim's proceeds, not a loan. If the case doesn't succeed, you typically owe nothing back out of pocket. <a href='/research.html' style=\"color:#D8BE85;\">See: Is Litigation Funding a Loan? &rarr;</a>"},
  timeline: {kw:["how long","timeline","how fast","turnaround","how quickly","how soon"],
    reply:"Timelines vary by matter, but an initial conversation like this one usually takes just a few exchanges. Packaging a matter and getting indications of interest from funders is typically measured in weeks; the underlying litigation itself can run years. <a href='/academy.html' style=\"color:#D8BE85;\">See the Meritoriousness Academy &rarr;</a>"},
  financiability: {kw:["financeable","fundable","qualify","eligible","get funded","what makes a case","do i qualify"],
    reply:"Funders generally screen for five things: legal merit, quality of counsel, collectability (can the defendant actually pay?), expected duration, and claim size &mdash; most funders won't underwrite much below roughly $1&ndash;5 million in expected recovery. <a href='/research.html' style=\"color:#D8BE85;\">See: What Makes a Case Financeable? &rarr;</a>"},
  returns: {kw:["returns","irr","how much do investors make","profit","yield","what do funders earn"],
    reply:"Single-case litigation finance has historically targeted internal rates of return in the 30% range, with a meaningful share of matters &mdash; often cited around 20&ndash;40% &mdash; producing no recovery at all, offset by outsized wins elsewhere in a portfolio. <a href='/research.html' style=\"color:#D8BE85;\">See: How Funders Actually Perform &rarr;</a>"},
  taxes: {kw:["tax","taxed","taxable","irs"],
    reply:"Tax treatment turns on the &ldquo;origin of the claim&rdquo; doctrine &mdash; the character of the underlying claim, not the funding arrangement itself, generally determines whether proceeds are ordinary income or capital gain. The IRS hasn't issued comprehensive guidance specific to litigation finance. <a href='/research.html' style=\"color:#D8BE85;\">See: How Litigation Finance Is Taxed &rarr;</a>"},
  ethics: {kw:["ethics","champerty","control my case","conflict of interest","attorney independence","who controls"],
    reply:"Rule 5.4(c) prohibits a funder from directing a lawyer's independent professional judgment, and well-drafted agreements confirm funders have no right to control litigation strategy or settlement &mdash; consultation rights only. <a href='/research.html' style=\"color:#D8BE85;\">See: Attorney Independence and Ethics &rarr;</a>"},
  massTort: {kw:["mass tort","class action","consumer funding","mdl"],
    reply:"Consumer legal funding &mdash; advances to individual plaintiffs, often in mass tort matters &mdash; is the fastest-growing and most scrutinized segment of the industry, now facing direct rate regulation in several states. <a href='/research.html' style=\"color:#D8BE85;\">See: Mass Tort & Consumer Legal Funding &rarr;</a>"},
  arbitration: {kw:["arbitration","international dispute","icsid","cross-border dispute"],
    reply:"Third-party funding is now routine in international arbitration. Since 2022, ICSID Rule 14 requires disclosure of any funder's identity, though how much of the funding agreement itself must be disclosed remains unsettled. <a href='/research.html' style=\"color:#D8BE85;\">See: International Arbitration Funding &rarr;</a>"},
  funders: {kw:["who are the funders","which funders","list of funders","which firms fund","who funds","litigation funders","funders you know","name some funders"],
    reply:"The Meet the Financiers directory profiles 39 litigation funders, compiled from public sources and industry rankings &mdash; not an endorsement, just the field laid out plainly. <a href='/financiers.html' style=\"color:#D8BE85;\">Browse the directory &rarr;</a>"}
};

function findDemoMatch(text){
  const t = text.toLowerCase();
  for(const key in demos){
    if(demos[key].kw.some(k => t.includes(k))) return key;
  }
  return null;
}

/* ---------------- PERSISTENCE (sessionStorage) ---------------- */
const SK = { role:'lfi_role_key', convo:'lfi_convo', display:'lfi_display', session:'lfi_session_id', engaged:'lfi_engaged_tracked' };

function loadState(){
  try{
    const roleKey = sessionStorage.getItem(SK.role) || null;
    const convo = JSON.parse(sessionStorage.getItem(SK.convo) || '[]');
    const displayLog = JSON.parse(sessionStorage.getItem(SK.display) || '[]');
    let sessionId = sessionStorage.getItem(SK.session);
    if(!sessionId){
      sessionId = 'session-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem(SK.session, sessionId);
    }
    return { roleKey, convo, displayLog, sessionId };
  }catch(e){
    return { roleKey:null, convo:[], displayLog:[], sessionId:'session-' + Date.now().toString(36) };
  }
}

function saveState(state){
  try{
    sessionStorage.setItem(SK.role, state.roleKey || '');
    sessionStorage.setItem(SK.convo, JSON.stringify(state.convo));
    sessionStorage.setItem(SK.display, JSON.stringify(state.displayLog));
  }catch(e){ /* storage unavailable (private browsing, etc.) — chat still works, just won't persist */ }
}

/* ---------------- FLOATING SHELL (non-homepage pages) ---------------- */
function buildFloatingShell(hasExistingConvo){
  const bubble = document.createElement('button');
  bubble.className = 'concierge-bubble' + (hasExistingConvo ? ' has-convo' : '');
  bubble.setAttribute('aria-label', 'Open AI Concierge');
  bubble.innerHTML = '<span class="icon">AI</span><span class="label">' + (hasExistingConvo ? 'Continue chat' : 'Ask the Concierge') + '</span><span class="dot"></span>';

  const panel = document.createElement('div');
  panel.className = 'concierge-panel';
  panel.innerHTML = `
    <div class="ch-head">
      <div class="who">AI Concierge</div>
      <div class="sub">Senior Fellow for Litigation Finance</div>
      <div class="sub" id="chStatus" style="color:#7A869E; font-size:11px; margin-top:4px;">Demo mode &mdash; run the local server to activate live answers</div>
    </div>
    <div class="ch-log" id="chLog">
      <div class="msg ai">${WELCOME_HTML}</div>
    </div>
    <div class="prompts" id="promptRow">
      <div class="prompt-chip" data-role="claimant">I have a legal matter</div>
      <div class="prompt-chip" data-role="lawyer">I'm a lawyer</div>
      <div class="prompt-chip" data-role="funder">I represent a litigation finance firm</div>
      <div class="prompt-chip" data-role="researcher">I'm conducting research</div>
      <div class="prompt-chip" data-role="other">Something else</div>
    </div>
    <div class="ch-input">
      <input id="chInput" type="text" placeholder="Ask a question, or tell your story..." />
      <button id="chSend">Send</button>
    </div>
    <div class="ch-followup">
      <button id="followupToggle" type="button">Request a follow-up from the Institute &rarr;</button>
      <div id="followupForm" class="followup-form" style="display:none;">
        <input id="fuName" type="text" placeholder="Name" />
        <input id="fuEmail" type="email" placeholder="Email" />
        <input id="fuPhone" type="tel" placeholder="Phone (optional)" />
        <button id="fuSubmit" type="button" class="btn btn-primary" style="background:var(--gold-light); color:var(--navy);">Send request</button>
      </div>
    </div>`;

  document.body.appendChild(panel);
  document.body.appendChild(bubble);

  bubble.addEventListener('click', function(){
    panel.classList.toggle('open');
  });
}

/* ---------------- CORE WIRING (shared by docked + floating) ---------------- */
function wireLogic(){
  const chLog = document.getElementById('chLog');
  if(!chLog) return; // nothing to wire — shouldn't happen, but stay safe

  const promptRow = document.getElementById('promptRow');
  const state = loadState();
  let LIVE = false;
  let convo = state.convo;
  let displayLog = state.displayLog;
  let roleKey = state.roleKey;
  let audience = roleKey && ROLES[roleKey] ? ROLES[roleKey].audience : null;
  const sessionId = state.sessionId;

  function persist(){ saveState({ roleKey, convo, displayLog }); }

  // Resume a previous conversation, if one exists in this browser session.
  if(displayLog.length > 0){
    chLog.innerHTML = '';
    displayLog.forEach(function(m){
      const div = document.createElement('div');
      div.className = 'msg ' + m.role;
      div.innerHTML = m.html;
      chLog.appendChild(div);
    });
    chLog.scrollTop = chLog.scrollHeight;
    if(roleKey && ROLES[roleKey]){ setFollowups(ROLES[roleKey].followups); }
  }

  function formatMsg(text){
    const lines = text.split(/\n+/).map(function(l){ return l.trim(); }).filter(Boolean);
    let html = '';
    let inList = false;
    lines.forEach(function(line){
      const bolded = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      if(/^-\s+/.test(bolded)){
        if(!inList){ html += '<ul style="margin:6px 0 10px 18px; padding:0;">'; inList = true; }
        html += '<li style="margin-bottom:5px;">' + bolded.replace(/^-\s+/, '') + '</li>';
      } else {
        if(inList){ html += '</ul>'; inList = false; }
        html += '<p style="margin:0 0 10px 0;">' + bolded + '</p>';
      }
    });
    if(inList) html += '</ul>';
    return html || text;
  }

  function addMsg(role, html){
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    div.innerHTML = html;
    chLog.appendChild(div);
    chLog.scrollTop = chLog.scrollHeight;
    displayLog.push({ role: role, html: html });
    persist();
    return div;
  }

  function showTyping(){
    const typing = document.createElement('div');
    typing.className = 'msg ai';
    typing.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    chLog.appendChild(typing);
    chLog.scrollTop = chLog.scrollHeight;
    return typing;
  }

  function finalizeAiReply(typingEl, html){
    typingEl.innerHTML = html;
    displayLog.push({ role: 'ai', html: html });
    persist();
    chLog.scrollTop = chLog.scrollHeight;
  }

  const statusEl = document.getElementById('chStatus');
  fetch('/api/health').then(function(r){ return r.ok ? r.json() : Promise.reject(); }).then(function(data){
    if(data.hasApiKey){
      LIVE = true;
      if(statusEl){
        statusEl.textContent = 'Live — grounded in ' + data.articles + ' articles';
        statusEl.style.color = '#9BD6A8';
      }
    } else if(statusEl){
      statusEl.textContent = 'Server running, but no API key set — see RUNNING_LOCALLY.md';
    }
  }).catch(function(){ /* no server running — stay in demo mode, silently */ });

  /* ---------------- END-OF-CONVERSATION TRANSCRIPT EMAIL ----------------
     Rather than emailing a running transcript on every single turn (which
     got noisy fast on any real conversation), the Institute now gets ONE
     consolidated transcript email when a conversation actually appears to
     be over: the tab is hidden or closed, or the user goes idle for a
     while. Only meaningful in live mode — demo-mode conversations aren't
     sent anywhere, same as before. */
  const IDLE_MS = 8 * 60 * 1000; // 8 minutes of inactivity = conversation over
  let idleTimer = null;

  function sendEndSession(useBeacon){
    if(!convo || convo.length === 0) return;
    const payload = JSON.stringify({ session: sessionId, audience: audience, transcript: convo });
    try{
      if(useBeacon && navigator.sendBeacon){
        navigator.sendBeacon('/api/end-session', new Blob([payload], {type:'application/json'}));
      } else {
        fetch('/api/end-session', { method:'POST', headers:{'content-type':'application/json'}, body: payload, keepalive:true }).catch(function(){});
      }
    }catch(e){ /* best-effort — never let this break the page */ }
  }

  function resetIdleTimer(){
    if(idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(function(){ sendEndSession(false); }, IDLE_MS);
  }

  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){ sendEndSession(true); }
  });
  window.addEventListener('pagehide', function(){ sendEndSession(true); });

  function askLive(userText){
    convo.push({ role:'user', content: userText });
    persist();
    resetIdleTimer();
    try{
      if(!sessionStorage.getItem(SK.engaged)){
        sessionStorage.setItem(SK.engaged, '1');
        trackEvent('qualify_lead', { audience: audience || 'unspecified' });
      }
    }catch(e){ /* private browsing etc. — skip tracking, chat still works */ }
    const typing = showTyping();
    return fetch('/api/chat', {
      method:'POST',
      headers:{'content-type':'application/json'},
      body: JSON.stringify({ messages: convo, audience: audience, session: sessionId })
    }).then(function(res){
      return res.json().then(function(data){
        if(!res.ok) throw new Error(data.error || 'Request failed');
        finalizeAiReply(typing, formatMsg(data.reply));
        convo.push({ role:'assistant', content: data.reply });
        persist();
      });
    }).catch(function(e){
      typing.innerHTML = "Something went wrong reaching the live AI (" + e.message + "). Falling back to demo mode for this message.";
      chLog.scrollTop = chLog.scrollHeight;
    });
  }

  function setFollowups(items){
    if(!promptRow) return;
    promptRow.innerHTML = '';
    items.forEach(function(f){
      const chip = document.createElement('div');
      chip.className = 'prompt-chip';
      chip.textContent = f.label;
      if(f.action) chip.dataset.action = f.action;
      if(f.demo) chip.dataset.demo = f.demo;
      promptRow.appendChild(chip);
    });
    wireChips();
  }

  function selectRole(key, label){
    const role = ROLES[key];
    if(!role) return;
    roleKey = key;
    audience = role.audience;
    persist();
    addMsg('user', label);
    if(LIVE){ askLive(label); }
    else {
      const typing = showTyping();
      setTimeout(function(){ finalizeAiReply(typing, formatMsg(role.demoReply)); }, 800);
    }
    setFollowups(role.followups);
  }

  function runDemo(key, label){
    const entry = demos[key];
    if(!entry) return;
    addMsg('user', label || 'Tell me more');
    if(LIVE){ askLive(label || 'Tell me more'); return; }
    const typing = showTyping();
    setTimeout(function(){ finalizeAiReply(typing, entry.reply); }, 900);
  }

  function startAssessment(){
    const msg = "I'd like to start my case assessment.";
    addMsg('user', msg);
    if(LIVE){ askLive(msg); return; }
    const typing = showTyping();
    setTimeout(function(){
      finalizeAiReply(typing, "Happy to start. Tell me what happened &mdash; who's involved, roughly when, and what you're hoping to resolve. There's no form to fill out; I'll ask follow-ups as we go. (This is demo mode &mdash; run the local server, see RUNNING_LOCALLY.md, for a live, grounded assessment.)");
    }, 800);
  }

  function wireChips(){
    document.querySelectorAll('.prompt-chip').forEach(function(btn){
      btn.addEventListener('click', function(){
        if(btn.dataset.role){ selectRole(btn.dataset.role, btn.textContent); return; }
        if(btn.dataset.action === 'assessment'){ startAssessment(); return; }
        if(btn.dataset.demo){ runDemo(btn.dataset.demo, btn.textContent); return; }
      });
    });
  }
  wireChips();

  const chInput = document.getElementById('chInput');
  const chSend = document.getElementById('chSend');

  function sendCustom(){
    const val = chInput.value.trim();
    if(!val) return;
    addMsg('user', val);
    chInput.value = '';
    if(LIVE){ askLive(val); return; }
    const matched = findDemoMatch(val);
    const typing = showTyping();
    setTimeout(function(){
      if(matched){
        finalizeAiReply(typing, demos[matched].reply);
      } else {
        finalizeAiReply(typing, "I don't have a scripted answer for that specific question in demo mode &mdash; this prototype simulates a set of common topics until the live server is running (see RUNNING_LOCALLY.md), grounded in the full 33-article research library. Try asking about: what makes a case financeable, collectability, patent litigation, taxes, ethics, arbitration, mass torts, fees, timelines, returns, or a specific funder &mdash; or browse the <a href='/research.html' style=\"color:#D8BE85;\">Research Library</a> directly.");
      }
    }, 900);
  }
  if(chSend) chSend.addEventListener('click', sendCustom);
  if(chInput) chInput.addEventListener('keydown', function(e){ if(e.key === 'Enter') sendCustom(); });

  const followupToggle = document.getElementById('followupToggle');
  const followupForm = document.getElementById('followupForm');
  if(followupToggle && followupForm){
    followupToggle.addEventListener('click', function(){
      followupForm.style.display = followupForm.style.display === 'none' ? 'flex' : 'none';
    });
  }
  const fuSubmit = document.getElementById('fuSubmit');
  if(fuSubmit){
    fuSubmit.addEventListener('click', function(){
      const name = document.getElementById('fuName').value.trim();
      const email = document.getElementById('fuEmail').value.trim();
      const phone = document.getElementById('fuPhone').value.trim();
      if(!name || !email){
        addMsg('ai', "I'll need at least a name and email to pass this along.");
        return;
      }
      addMsg('user', "Please have the Institute's Executive Director follow up. Name: " + name + ", Email: " + email + (phone ? ', Phone: ' + phone : '') + ".");
      followupForm.style.display = 'none';
      document.getElementById('fuName').value = '';
      document.getElementById('fuEmail').value = '';
      document.getElementById('fuPhone').value = '';
      const typing = showTyping();
      fetch('/api/lead', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify({ name: name, email: email, phone: phone, session: sessionId, transcript: convo })
      }).then(function(res){ return res.json(); }).then(function(data){
        if(data.ok){
          trackEvent('close_convert_lead', { audience: audience || 'unspecified' });
          finalizeAiReply(typing, "Thank you &mdash; I've passed this along. The Institute's Executive Director will be in touch soon.");
        } else {
          finalizeAiReply(typing, "Thanks for sharing that. " + (data.message || "This didn't reach anyone yet since email notifications aren't configured on this server, but nothing was lost."));
        }
      }).catch(function(e){
        typing.innerHTML = "Thanks for sharing that &mdash; I wasn't able to confirm it sent (" + e.message + "), but your details are noted in this conversation.";
        chLog.scrollTop = chLog.scrollHeight;
      });
    });
  }
}

function init(){
  const isDocked = !!document.getElementById('concierge-dock');
  if(!isDocked){
    const state = loadState();
    buildFloatingShell(state.displayLog.length > 0);
  }
  wireLogic();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

})();
