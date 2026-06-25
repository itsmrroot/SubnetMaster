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
let selectedClass = 'random'; // 'A' | 'B' | 'C' | 'random'

/* ── Network options per class ── */
const NET_OPTS = {
  A: ['10.0.1','10.0.2','10.1.5','50.30.10','100.50.5','126.10.20'],
  B: ['172.16.1','172.16.5','150.20.10','130.50.3','180.10.7','191.5.20'],
  C: ['192.168.10','192.168.20','192.168.50','192.168.77','192.168.33','192.168.99'],
};

/* ── Class selector ── */
function setClass(cls) {
  selectedClass = cls;
  ['cls-btn-r','cls-btn-a','cls-btn-b','cls-btn-c'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active');
  });
  const map = { random:'cls-btn-r', A:'cls-btn-a', B:'cls-btn-b', C:'cls-btn-c' };
  const btn = document.getElementById(map[cls]);
  if (btn) btn.classList.add('active');
  newTask();
}

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
  const trans = PAGE_TRANS[currentLang] || PAGE_TRANS['de'];
  set('lbl-how',    trans['how-label']  || 'So funktioniert es');
  set('cls-label',  trans['cls-label']  || 'IP-Klasse:');
  set('cls-txt-r',  trans['cls-random'] || 'Zufällig');
  set('cls-txt-a',  trans['cls-a']      || 'Klasse A');
  set('cls-txt-b',  trans['cls-b']      || 'Klasse B');
  set('cls-txt-c',  trans['cls-c']      || 'Klasse C');

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
  const cls     = selectedClass === 'random'
    ? ['A','B','C'][Math.floor(Math.random() * 3)]
    : selectedClass;
  const netOpts = NET_OPTS[cls];

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
    cls,
    firstOctet: net.split('.')[0],
    answers: {
      a: cls,
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

/* ── Step explanations (language-aware) ── */
const CLS_RANGE = { A:['1','126'], B:['128','191'], C:['192','223'] };

const STEP_TRANS = {
  de: (d) => { const r=CLS_RANGE[d.cls]; return ({
    a: [
      { t: `Erste Zahl der IP: <code>${d.firstOctet}</code>` },
      { t: `Klasse A = 1–126 &nbsp;|&nbsp; B = 128–191 &nbsp;|&nbsp; C = 192–223` },
      { t: `${d.firstOctet} liegt zwischen ${r[0]} und ${r[1]} → <b>Klasse ${d.cls}</b>` }
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
  }); },
  en: (d) => { const r=CLS_RANGE[d.cls]; return ({
    a: [
      { t: `First number of IP: <code>${d.firstOctet}</code>` },
      { t: `Class A = 1–126 &nbsp;|&nbsp; B = 128–191 &nbsp;|&nbsp; C = 192–223` },
      { t: `${d.firstOctet} is between ${r[0]} and ${r[1]} → <b>Class ${d.cls}</b>` }
    ],
    b: [
      { t: `${d.sr} SR + 1 VW + 1 RS = <code>${d.needed}</code> required` },
      { t: `Powers of 2: 2, 4, 8, 16, 32 ... → next ≥ ${d.needed}` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount}</b>` }
    ],
    c: [
      { t: `2^? = ${d.subnetCount}` },
      { t: `2^${d.subnetBits} = ${d.subnetCount} → borrow <b>${d.subnetBits} bits</b>` }
    ],
    d: [
      { t: `Largest subnet = <code>${d.pcsPerSR} PCs</code> (training room)` },
      { t: `Answer: <b>${d.pcsPerSR}</b>` }
    ],
    e: [
      { t: `4th byte has 8 bits — ${d.subnetBits} borrowed (question c)` },
      { t: `8 − ${d.subnetBits} = <b>${d.hostBits} host bits</b>` }
    ],
    f: [
      { t: `Base network /24 + ${d.subnetBits} borrowed bits` },
      { t: `24 + ${d.subnetBits} = <b>/${d.prefix}</b>` }
    ],
    g: [
      { t: `Bytes 1–3 remain <code>255.255.255</code>` },
      { t: `4th byte binary: <code>${d.binStr.slice(0,4)} ${d.binStr.slice(4)}</code>` },
      { t: `Add ones: ${d.addParts} = <b>${d.mb}</b>` },
      { t: `Subnet mask: <b>${d.mask}</b>` }
    ],
    h: [
      { t: `${d.hostBits} host bits (question e)` },
      { t: `2^${d.hostBits} = <b>${d.totalPerSub} addresses</b> per subnet` }
    ],
    i: [
      { t: `${d.totalPerSub} addresses total (question h)` },
      { t: `− 1 network address − 1 broadcast` },
      { t: `${d.totalPerSub} − 2 = <b>${d.usable} usable hosts</b>` }
    ],
    j: [
      { t: `${d.subnetBits} subnet bits borrowed (question c)` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount} possible networks</b>` }
    ]
  }); },
  ar: (d) => { const r=CLS_RANGE[d.cls]; return ({
    a: [
      { t: `الرقم الأول في IP: <code>${d.firstOctet}</code>` },
      { t: `الفئة A = 1–126 &nbsp;|&nbsp; B = 128–191 &nbsp;|&nbsp; C = 192–223` },
      { t: `${d.firstOctet} يقع بين ${r[0]} و ${r[1]} → <b>الفئة ${d.cls}</b>` }
    ],
    b: [
      { t: `${d.sr} SR + 1 VW + 1 RS = <code>${d.needed}</code> مطلوبة` },
      { t: `قوى العدد 2: 2، 4، 8، 16، 32 ... → التالية ≥ ${d.needed}` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount}</b>` }
    ],
    c: [
      { t: `2^? = ${d.subnetCount}` },
      { t: `2^${d.subnetBits} = ${d.subnetCount} → استعر <b>${d.subnetBits} بت</b>` }
    ],
    d: [
      { t: `أكبر شبكة = <code>${d.pcsPerSR} أجهزة</code> (غرفة التدريب)` },
      { t: `الإجابة: <b>${d.pcsPerSR}</b>` }
    ],
    e: [
      { t: `البايت الرابع له 8 بت — ${d.subnetBits} مستعارة (سؤال c)` },
      { t: `8 − ${d.subnetBits} = <b>${d.hostBits} بتات مضيف</b>` }
    ],
    f: [
      { t: `الشبكة الأساسية /24 + ${d.subnetBits} بتات مستعارة` },
      { t: `24 + ${d.subnetBits} = <b>/${d.prefix}</b>` }
    ],
    g: [
      { t: `البايتات 1–3 تبقى <code>255.255.255</code>` },
      { t: `البايت الرابع ثنائياً: <code>${d.binStr.slice(0,4)} ${d.binStr.slice(4)}</code>` },
      { t: `جمع الآحاد: ${d.addParts} = <b>${d.mb}</b>` },
      { t: `قناع الشبكة: <b>${d.mask}</b>` }
    ],
    h: [
      { t: `${d.hostBits} بتات مضيف (سؤال e)` },
      { t: `2^${d.hostBits} = <b>${d.totalPerSub} عنوان</b> لكل شبكة` }
    ],
    i: [
      { t: `${d.totalPerSub} عنوان إجمالاً (سؤال h)` },
      { t: `− 1 عنوان شبكة − 1 عنوان بث` },
      { t: `${d.totalPerSub} − 2 = <b>${d.usable} مضيف صالح</b>` }
    ],
    j: [
      { t: `${d.subnetBits} بتات شبكة مستعارة (سؤال c)` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount} شبكة ممكنة</b>` }
    ]
  }); },
  tr: (d) => { const r=CLS_RANGE[d.cls]; return ({
    a: [
      { t: `IP'nin ilk sayısı: <code>${d.firstOctet}</code>` },
      { t: `A Sınıfı = 1–126 &nbsp;|&nbsp; B = 128–191 &nbsp;|&nbsp; C = 192–223` },
      { t: `${d.firstOctet}, ${r[0]} ile ${r[1]} arasında → <b>${d.cls} Sınıfı</b>` }
    ],
    b: [
      { t: `${d.sr} SR + 1 VW + 1 RS = <code>${d.needed}</code> gerekli` },
      { t: `2'nin kuvvetleri: 2, 4, 8, 16, 32 ... → ≥ ${d.needed} olan bir sonraki` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount}</b>` }
    ],
    c: [
      { t: `2^? = ${d.subnetCount}` },
      { t: `2^${d.subnetBits} = ${d.subnetCount} → <b>${d.subnetBits} bit</b> ödünç al` }
    ],
    d: [
      { t: `En büyük alt ağ = <code>${d.pcsPerSR} PC</code> (eğitim odası)` },
      { t: `Cevap: <b>${d.pcsPerSR}</b>` }
    ],
    e: [
      { t: `4. byte 8 bit — ${d.subnetBits} tanesi ödünç alındı (soru c)` },
      { t: `8 − ${d.subnetBits} = <b>${d.hostBits} host biti</b>` }
    ],
    f: [
      { t: `Temel ağ /24 + ${d.subnetBits} ödünç bit` },
      { t: `24 + ${d.subnetBits} = <b>/${d.prefix}</b>` }
    ],
    g: [
      { t: `1–3. byte <code>255.255.255</code> kalır` },
      { t: `4. byte ikili: <code>${d.binStr.slice(0,4)} ${d.binStr.slice(4)}</code>` },
      { t: `1'leri topla: ${d.addParts} = <b>${d.mb}</b>` },
      { t: `Alt ağ maskesi: <b>${d.mask}</b>` }
    ],
    h: [
      { t: `${d.hostBits} host biti (soru e)` },
      { t: `2^${d.hostBits} = alt ağ başına <b>${d.totalPerSub} adres</b>` }
    ],
    i: [
      { t: `${d.totalPerSub} adres toplam (soru h)` },
      { t: `− 1 ağ adresi − 1 yayın adresi` },
      { t: `${d.totalPerSub} − 2 = <b>${d.usable} kullanılabilir host</b>` }
    ],
    j: [
      { t: `${d.subnetBits} alt ağ biti ödünç alındı (soru c)` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount} olası ağ</b>` }
    ]
  }); },
  fr: (d) => { const r=CLS_RANGE[d.cls]; return ({
    a: [
      { t: `Premier nombre de l'IP : <code>${d.firstOctet}</code>` },
      { t: `Classe A = 1–126 &nbsp;|&nbsp; B = 128–191 &nbsp;|&nbsp; C = 192–223` },
      { t: `${d.firstOctet} est entre ${r[0]} et ${r[1]} → <b>Classe ${d.cls}</b>` }
    ],
    b: [
      { t: `${d.sr} SR + 1 VW + 1 RS = <code>${d.needed}</code> requis` },
      { t: `Puissances de 2 : 2, 4, 8, 16, 32 ... → prochaine ≥ ${d.needed}` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount}</b>` }
    ],
    c: [
      { t: `2^? = ${d.subnetCount}` },
      { t: `2^${d.subnetBits} = ${d.subnetCount} → emprunter <b>${d.subnetBits} bits</b>` }
    ],
    d: [
      { t: `Plus grand sous-réseau = <code>${d.pcsPerSR} PC</code> (salle de formation)` },
      { t: `Réponse : <b>${d.pcsPerSR}</b>` }
    ],
    e: [
      { t: `Le 4e octet a 8 bits — ${d.subnetBits} empruntés (question c)` },
      { t: `8 − ${d.subnetBits} = <b>${d.hostBits} bits hôte</b>` }
    ],
    f: [
      { t: `Réseau de base /24 + ${d.subnetBits} bits empruntés` },
      { t: `24 + ${d.subnetBits} = <b>/${d.prefix}</b>` }
    ],
    g: [
      { t: `Octets 1–3 restent <code>255.255.255</code>` },
      { t: `4e octet binaire : <code>${d.binStr.slice(0,4)} ${d.binStr.slice(4)}</code>` },
      { t: `Additionner les 1 : ${d.addParts} = <b>${d.mb}</b>` },
      { t: `Masque de sous-réseau : <b>${d.mask}</b>` }
    ],
    h: [
      { t: `${d.hostBits} bits hôte (question e)` },
      { t: `2^${d.hostBits} = <b>${d.totalPerSub} adresses</b> par sous-réseau` }
    ],
    i: [
      { t: `${d.totalPerSub} adresses au total (question h)` },
      { t: `− 1 adresse réseau − 1 broadcast` },
      { t: `${d.totalPerSub} − 2 = <b>${d.usable} hôtes utilisables</b>` }
    ],
    j: [
      { t: `${d.subnetBits} bits sous-réseau empruntés (question c)` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount} réseaux possibles</b>` }
    ]
  }); },
  es: (d) => { const r=CLS_RANGE[d.cls]; return ({
    a: [
      { t: `Primer número de IP: <code>${d.firstOctet}</code>` },
      { t: `Clase A = 1–126 &nbsp;|&nbsp; B = 128–191 &nbsp;|&nbsp; C = 192–223` },
      { t: `${d.firstOctet} está entre ${r[0]} y ${r[1]} → <b>Clase ${d.cls}</b>` }
    ],
    b: [
      { t: `${d.sr} SR + 1 VW + 1 RS = <code>${d.needed}</code> requeridas` },
      { t: `Potencias de 2: 2, 4, 8, 16, 32 ... → siguiente ≥ ${d.needed}` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount}</b>` }
    ],
    c: [
      { t: `2^? = ${d.subnetCount}` },
      { t: `2^${d.subnetBits} = ${d.subnetCount} → prestar <b>${d.subnetBits} bits</b>` }
    ],
    d: [
      { t: `Subred más grande = <code>${d.pcsPerSR} PCs</code> (aula de formación)` },
      { t: `Respuesta: <b>${d.pcsPerSR}</b>` }
    ],
    e: [
      { t: `El 4.º byte tiene 8 bits — ${d.subnetBits} prestados (pregunta c)` },
      { t: `8 − ${d.subnetBits} = <b>${d.hostBits} bits de host</b>` }
    ],
    f: [
      { t: `Red base /24 + ${d.subnetBits} bits prestados` },
      { t: `24 + ${d.subnetBits} = <b>/${d.prefix}</b>` }
    ],
    g: [
      { t: `Bytes 1–3 permanecen <code>255.255.255</code>` },
      { t: `4.º byte binario: <code>${d.binStr.slice(0,4)} ${d.binStr.slice(4)}</code>` },
      { t: `Sumar unos: ${d.addParts} = <b>${d.mb}</b>` },
      { t: `Máscara de subred: <b>${d.mask}</b>` }
    ],
    h: [
      { t: `${d.hostBits} bits de host (pregunta e)` },
      { t: `2^${d.hostBits} = <b>${d.totalPerSub} direcciones</b> por subred` }
    ],
    i: [
      { t: `${d.totalPerSub} direcciones en total (pregunta h)` },
      { t: `− 1 dirección de red − 1 broadcast` },
      { t: `${d.totalPerSub} − 2 = <b>${d.usable} hosts utilizables</b>` }
    ],
    j: [
      { t: `${d.subnetBits} bits de subred prestados (pregunta c)` },
      { t: `2^${d.subnetBits} = <b>${d.subnetCount} redes posibles</b>` }
    ]
  }); },
};

function getSteps(id) {
  const fn = STEP_TRANS[currentLang] || STEP_TRANS['de'];
  return (fn(D)[id]) || [];
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
