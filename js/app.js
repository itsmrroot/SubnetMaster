/* ════════════════════════════════════════
   SubnetMaster – Trainer App Logic v1.1
   Fixed: infinite recursion, FOUC, edge cases
   ════════════════════════════════════════ */

/* ── Apply theme IMMEDIATELY (before render) to prevent FOUC ── */
(function() {
  const saved = localStorage.getItem('sm-theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
})();

/* ── State ── */
let D = {};
let totalDone = 0, totalCorrect = 0, totalAnswers = 0, streak = 0;

/* ── Math helpers ── */
function nextPow2(n) { let p = 1; while (p < n) p *= 2; return p; }
function howBits(n)  { return Math.round(Math.log2(n)); }
function maskByte(sb){ let v = 0; for (let i = 0; i < sb; i++) v += Math.pow(2, 7-i); return v; }
function toBin8(sb)  { return '1'.repeat(sb) + '0'.repeat(8-sb); }

/* ── Hero IP animation ── */
(function initAnim() {
  const ids = ['o1','o2','o3','o4'];
  let idx = 0;
  setInterval(() => {
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('lit'); });
    const el = document.getElementById(ids[idx]);
    if (el) el.classList.add('lit');
    idx = (idx+1) % ids.length;
  }, 900);
})();

/* ── Theme toggle ── */
function toggleTheme() {
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const next = isDark ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('sm-theme', next);
}

/* ── Apply nav + footer language labels ── */
function applyNavLang() {
  const L = getLang();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('nav-trainer',   L.nav.trainer);
  set('nav-lernen',    L.nav.lernen);
  set('nav-anleitung', L.nav.anleitung);
  set('footer-text',   L.footerText);
}

/* ── Apply hero + stats + how-it-works text ── */
function applyHeroLang() {
  const L = getLang();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('h-eyebrow',     L.eyebrow);
  set('h-span',        L.span);
  set('h-cta-text',    L.ctaText);
  set('h-sub',         L.sub);
  set('h-title-main',  L.title);
  set('sl-done',       L.slDone);
  set('sl-correct',    L.slCorrect);
  set('sl-pct',        L.slPct);
  set('sl-streak',     L.slStreak);
  set('lbl-task',      L.lblTask);
  set('lbl-questions', L.lblQuestions);
  set('btn-new-text',        L.btnNew);
  set('btn-check-text',      L.btnCheck);
  set('btn-new-bottom-text', L.btnNew);

  const howGrid = document.getElementById('how-grid');
  if (howGrid && L.how) {
    howGrid.innerHTML = L.how.map(h => `
      <div class="how-card">
        <div class="how-num">${h.num}</div>
        <div class="how-title">${h.title}</div>
        <div class="how-text">${h.text}</div>
      </div>`).join('');
  }
}

/* ── Update task card texts ── */
function updateTaskUI() {
  const L = getLang();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };
  set('lbl-network', L.lblNetwork);
  set('lbl-needed',  L.lblNeeded);
  const tnNet = document.getElementById('tn-net');
  if (tnNet) tnNet.textContent = D.net + '.0';
  set('tn-mask',  L.maskLabel  + ': <span>255.255.255.0</span>');
  set('tn-hosts', L.hostsLabel + ': <span>254</span>');
  const needList = document.getElementById('need-list');
  if (needList) needList.innerHTML =
    `<li>${L.srLabel(D.sr, D.pcsPerSR)}</li>
     <li>${L.vwLabel(D.vw)}</li>
     <li>${L.rsLabel(D.rs)}</li>`;
}

/* ── Generate new task ── */
/* FIX: removed SR=8 from srOpts and PC>14 from pcOpts when SR is large
   Instead we compute valid combos deterministically to avoid infinite recursion */
function newTask() {
  const sb = document.getElementById('score-bar');
  const st = document.getElementById('solution-table');
  if (sb) sb.className = 'score-bar';
  if (st) st.className = 'solution-table';

  const srOpts  = [4, 5, 6, 8];
  const pcOpts  = [8, 10, 12, 14, 20, 25, 30];
  const vwOpts  = [5, 6, 8, 10];
  const rsOpts  = [2, 3, 4, 5];
  const netOpts = ['192.168.10','192.168.20','192.168.50',
                   '192.168.77','192.168.33','192.168.99'];

  /* FIX: build only valid (sr, pc) pairs first, then pick randomly */
  const validPairs = [];
  srOpts.forEach(sr => {
    pcOpts.forEach(pc => {
      const needed      = sr + 2;
      const subnetCount = nextPow2(needed);
      const subnetBits  = howBits(subnetCount);
      const hostBits    = 8 - subnetBits;
      const usable      = Math.pow(2, hostBits) - 2;
      if (usable >= pc) validPairs.push({ sr, pc });
    });
  });

  /* pick a random valid pair */
  const pair     = validPairs[Math.floor(Math.random() * validPairs.length)];
  const sr       = pair.sr;
  const pcsPerSR = pair.pc;
  const vw       = vwOpts[Math.floor(Math.random() * vwOpts.length)];
  const rs       = rsOpts[Math.floor(Math.random() * rsOpts.length)];
  const net      = netOpts[Math.floor(Math.random() * netOpts.length)];

  const needed      = sr + 2;
  const subnetCount = nextPow2(needed);
  const subnetBits  = howBits(subnetCount);
  const hostBits    = 8 - subnetBits;
  const totalPerSub = Math.pow(2, hostBits);
  const usable      = totalPerSub - 2;
  const prefix      = 24 + subnetBits;
  const mb          = maskByte(subnetBits);
  const mask        = '255.255.255.' + mb;
  const binStr      = toBin8(subnetBits);
  const bitVals     = [128, 64, 32, 16, 8, 4, 2, 1];
  const addParts    = bitVals.slice(0, subnetBits).join('+');

  D = {
    sr, pcsPerSR, vw, rs, net, needed,
    subnetCount, subnetBits, hostBits,
    totalPerSub, usable, prefix, mask, mb, binStr, addParts,
    firstOctet: net.split('.')[0],
    answers: {
      a: 'C',
      b: String(subnetCount),
      c: String(subnetBits),
      d: String(pcsPerSR),
      e: String(hostBits),
      f: '/' + prefix,
      g: mask,
      h: String(totalPerSub),
      i: String(usable),
      j: String(subnetCount)
    }
  };

  /* update hero IP */
  ['o1','o2','o3'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.textContent = net.split('.')[i];
  });
  const titleEl = document.getElementById('task-title');
  if (titleEl) titleEl.textContent = 'aufgabe_' + net.replace(/\./g,'_') + '.subnet';

  updateTaskUI();
  renderQuestions();
}

/* ── Render question rows ── */
const IDS = ['a','b','c','d','e','f','g','h','i','j'];

function renderQuestions() {
  const L    = getLang();
  const wrap = document.getElementById('questions');
  if (!wrap) return;
  wrap.innerHTML = IDS.map((id, i) => `
    <div class="q-row" id="qrow-${id}">
      <div class="q-letter">${id}.</div>
      <div class="q-content">
        <div class="q-text">${L.qTexts[i]}</div>
        <div class="q-explain" id="qe-${id}"></div>
      </div>
      <input class="q-input" id="qi-${id}" placeholder="${L.qPh[i]}"
             oninput="resetRow('${id}')"
             onkeydown="if(event.key==='Enter') focusNext('${id}')">
      <span class="q-badge" id="qb-${id}"></span>
    </div>`).join('');
}

function focusNext(id) {
  const idx = IDS.indexOf(id);
  if (idx < IDS.length - 1) {
    const el = document.getElementById('qi-' + IDS[idx+1]);
    if (el) el.focus();
  } else {
    checkAnswers();
  }
}

function resetRow(id) {
  const row   = document.getElementById('qrow-' + id);
  const badge = document.getElementById('qb-'   + id);
  const expl  = document.getElementById('qe-'   + id);
  if (row)   row.className        = 'q-row';
  if (badge) badge.style.display  = 'none';
  if (expl)  expl.style.display   = 'none';
}

/* ── Step explanations ── */
function getSteps(id) {
  const d = D;
  const map = {
    a: [
      { t: `Erste Zahl der IP: <code>${d.firstOctet}</code>` },
      { t: `Klasse A = 1–126 &nbsp;|&nbsp; B = 128–191 &nbsp;|&nbsp; C = 192–223` },
      { t: `${d.firstOctet} liegt zwischen 192 und 223 → <b>Klasse C</b>` }
    ],
    b: [
      { t: `${d.sr} SR + 1 VW + 1 RS = <code>${d.needed}</code> benötigt` },
      { t: `2er-Potenzen: 2, 4, 8, 16, 32 ... → nächste ≥ ${d.needed}` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount}</b>` }
    ],
    c: [
      { t: `2^? = ${d.subnetCount}` },
      { t: `2^${d.subnetBits} = ${d.subnetCount} → <b>${d.subnetBits} Bits</b> borgen` }
    ],
    d: [
      { t: `Größtes Subnetz = <code>${d.pcsPerSR} PCs</code> (Schulungsraum)` },
      { t: `Antwort: <b>${d.pcsPerSR}</b>` }
    ],
    e: [
      { t: `4. Byte hat 8 Bits — davon ${d.subnetBits} geborgt (Frage c)` },
      { t: `8 − ${d.subnetBits} = <b>${d.hostBits} Hostbits</b>` }
    ],
    f: [
      { t: `Ausgangsnetz /24 + ${d.subnetBits} geborgene Bits` },
      { t: `24 + ${d.subnetBits} = <b>/${d.prefix}</b>` }
    ],
    g: [
      { t: `Bytes 1–3 bleiben <code>255.255.255</code>` },
      { t: `4. Byte binär: <code>${d.binStr.slice(0,4)} ${d.binStr.slice(4)}</code>` },
      { t: `Einsen addieren: ${d.addParts} = <b>${d.mb}</b>` },
      { t: `Subnetzmaske: <b>${d.mask}</b>` }
    ],
    h: [
      { t: `${d.hostBits} Hostbits (Frage e)` },
      { t: `2^${d.hostBits} = <b>${d.totalPerSub} Adressen</b> je Subnetz` }
    ],
    i: [
      { t: `${d.totalPerSub} Adressen gesamt (Frage h)` },
      { t: `− 1 Netzadresse − 1 Broadcast` },
      { t: `${d.totalPerSub} − 2 = <b>${d.usable} nutzbare Hosts</b>` }
    ],
    j: [
      { t: `${d.subnetBits} Subnetzbits geborgt (Frage c)` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount} mögliche Netze</b>` }
    ]
  };
  return map[id] || [];
}

/* ── Check answers ── */
function norm(v) { return v.trim().toLowerCase().replace(/\s+/g, ''); }

function checkAnswers() {
  const L = getLang();
  let correct = 0;

  IDS.forEach(id => {
    const inp   = document.getElementById('qi-'   + id);
    const badge = document.getElementById('qb-'   + id);
    const expl  = document.getElementById('qe-'   + id);
    const row   = document.getElementById('qrow-' + id);
    if (!inp) return;

    const userVal    = norm(inp.value);
    const correctVal = norm(D.answers[id]);
    badge.style.display = 'inline-block';

    if (userVal === correctVal) {
      row.className     = 'q-row q-correct';
      badge.textContent = L.badgeOk;
      badge.className   = 'q-badge badge-ok';
      if (expl) expl.style.display = 'none';
      correct++;
    } else {
      row.className     = 'q-row q-wrong';
      badge.textContent = L.badgeErr;
      badge.className   = 'q-badge badge-err';
      if (expl) {
        const steps = getSteps(id);
        expl.innerHTML = `
          <div class="explain-title">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/>
            </svg>
            ${L.explainTitle('<code>' + D.answers[id] + '</code>')}
          </div>
          <div class="step-list">
            ${steps.map((s,i) => `
              <div class="step-item">
                <div class="step-num">${i+1}</div>
                <div class="step-text">${s.t}</div>
              </div>`).join('')}
          </div>`;
        expl.style.display = 'block';
      }
    }
  });

  /* stats */
  const total = IDS.length;
  totalDone++;
  totalCorrect += correct;
  totalAnswers += total;
  streak = (correct === total) ? streak + 1 : 0;
  updateStats();

  /* score bar */
  const sb = document.getElementById('score-bar');
  if (sb) {
    if (correct === total) {
      sb.className = 'score-bar show score-perfect';
      sb.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg> ${L.scorePerfect(total)}`;
    } else if (correct >= 7) {
      sb.className = 'score-bar show score-good';
      sb.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/></svg> ${L.scoreGood(correct, total)}`;
    } else {
      sb.className = 'score-bar show score-retry';
      sb.innerHTML = `<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg> ${L.scoreRetry(correct, total)}`;
    }
  }

  /* solution table */
  const solHeader = document.getElementById('sol-header');
  const solGrid   = document.getElementById('sol-grid');
  const solTable  = document.getElementById('solution-table');
  if (solHeader) solHeader.textContent = L.solHeader;
  if (solGrid) solGrid.innerHTML = IDS.map((id, i) => `
    <div class="sol-cell">
      <div class="sol-key">${id}. ${L.solKeys[i]}</div>
      <div class="sol-val">${D.answers[id]}</div>
    </div>`).join('');
  if (solTable) solTable.className = 'solution-table show';
}

/* ── Update stat counters ── */
function updateStats() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stat-done',    totalDone);
  set('stat-correct', totalCorrect);
  set('stat-pct',     totalAnswers > 0 ? Math.round(totalCorrect/totalAnswers*100) + '%' : '–');
  set('stat-streak',  streak);
}

/* ── Language switcher for index.html ── */
function changeLang(lang) {
  setLang(lang, () => {
    applyNavLang();
    applyHeroLang();
    if (D.sr) { updateTaskUI(); renderQuestions(); }
  });
  /* sync select if it exists */
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = lang;
}

/* ── Init on DOMContentLoaded ── */
document.addEventListener('DOMContentLoaded', () => {
  /* sync language select */
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = currentLang;

  /* apply language */
  setLang(currentLang, () => {
    applyNavLang();
    applyHeroLang();
    newTask();
  });
});
