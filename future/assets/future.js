import { Categories, loadCache, saveCache, getPendingCount, addEntry, installErrorOverlay } from '../../assets/store.js';

installErrorOverlay();

const els = {
  range: document.getElementById('range'),
  focusCategory: document.getElementById('focusCategory'),
  generate: document.getElementById('generate'),
  dataHint: document.getElementById('dataHint'),
  cardA: document.getElementById('cardA'),
  cardB: document.getElementById('cardB'),
  cardC: document.getElementById('cardC'),
  choice: document.getElementById('choice'),
  did: document.getElementById('did'),
  memo: document.getElementById('memo'),
  save: document.getElementById('save'),
  saveMsg: document.getElementById('saveMsg'),
  pending: document.getElementById('pending'),
};

function nowISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${yyyy}-${mm}-${dd}`;
}

function nowHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setPending() {
  els.pending.textContent = String(getPendingCount());
}

function fillCategories() {
  els.focusCategory.innerHTML = '<option value="">（指定なし）</option>' + Categories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

function recentEntries(days) {
  const cache = loadCache();
  const cutoff = Date.now() - days*24*60*60*1000;
  const entries = Array.isArray(cache.entries) ? cache.entries : [];
  return entries.filter(e => {
    const t = Date.parse(e.date || '') || 0;
    return t >= cutoff;
  });
}

function summarize(entries) {
  const byCat = new Map();
  for (const c of Categories) byCat.set(c, 0);
  for (const e of entries) {
    const c = Categories.includes(e.category) ? e.category : 'その他';
    byCat.set(c, (byCat.get(c) || 0) + 1);
  }
  // sort desc
  const sorted = [...byCat.entries()].sort((a,b) => b[1]-a[1]);
  return { byCat, sorted };
}

function propose(days, focusCat='') {
  const entries = recentEntries(days);
  if (!entries.length) {
    return {
      A: { title: '1分だけ触る', body: 'まずはログがないと予測のしようがない。今日ページで一歩を1件入れて戻ってきて。', minutes: 1, cat: 'その他' },
      B: { title: '3分で知覚を整える', body: '「今の気分」と「今いちばん詰まってる条件」を3行で書く。', minutes: 3, cat: '心・メンタル' },
      C: { title: '盲点メモ1行', body: '今日のつまずき条件を1行で書いて保存。', minutes: 2, cat: '心・メンタル' },
      meta: { note: 'ログが少ないため暫定。' },
    };
  }

  const { sorted } = summarize(entries);
  const top = sorted[0] || ['その他', 0];
  const bottom = [...sorted].reverse().find(([c,n]) => c !== 'その他') || ['その他', 0];
  const focus = focusCat && Categories.includes(focusCat) ? focusCat : '';

  // Idea: If focus is set, bias toward it. Else, balance toward bottom category.
  const target = focus || bottom[0];
  const drift = top[0];

  const A = {
    title: '1分だけ触る',
    body: `直近${days}日で「${esc(drift)}」が多め。今日は${esc(target)}を1分だけ触って、偏りを少し戻す。\n例：${esc(target)}の超ミニ行動を1つやって記録。`,
    minutes: 1,
    cat: target,
  };

  const B = {
    title: '3分で知覚を整える',
    body: `直近の傾向をメモ化して行動に変える。\n1) 最近多いカテゴリ: ${esc(drift)}\n2) 足りないカテゴリ: ${esc(target)}\n3) 今日やる最小の一歩: 1つ\nこれを3分で書く。`,
    minutes: 3,
    cat: '心・メンタル',
  };

  const C = {
    title: '盲点メモ1行',
    body: `「${esc(target)}が薄くなる理由」を1行で書く（例：時間, 体力, 優先度, 摩擦）。\n書いたら保存して、明日の自分に投げる。`,
    minutes: 2,
    cat: '心・メンタル',
  };

  return { A, B, C, meta: { days, drift, target, count: entries.length } };
}

let lastProposals = null;

function renderCards(p) {
  const tpl = (k, obj, tone) => {
    return `
      <div class="card-head">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="badge">${k}</span>
            <strong style="font-size:18px;">${esc(obj.title)}</strong>
          </div>
          <div class="score-pill"><span>目安</span><strong>${obj.minutes}</strong><span>分</span></div>
        </div>
        <div class="form-note" style="margin-top:6px;">カテゴリ: <strong>${esc(obj.cat)}</strong></div>
      </div>
      <div style="white-space:pre-wrap;line-height:1.55;margin-top:10px;">${esc(obj.body)}</div>
    `;
  };

  els.cardA.innerHTML = tpl('A', p.A);
  els.cardB.innerHTML = tpl('B', p.B);
  els.cardC.innerHTML = tpl('C', p.C);
}

function showHint(msg, kind='warn') {
  els.dataHint.style.display = 'block';
  els.dataHint.textContent = msg;
  els.dataHint.className = 'message ' + (kind === 'ok' ? 'success' : '');
}

function clearHint() {
  els.dataHint.style.display = 'none';
  els.dataHint.textContent = '';
  els.dataHint.className = 'message';
}

els.generate.addEventListener('click', () => {
  clearHint();
  const days = parseInt(els.range.value || '7', 10);
  const focusCat = els.focusCategory.value || '';
  const p = propose(days, focusCat);
  lastProposals = p;
  renderCards(p);
  setPending();
  showHint(`生成した。参照:${days}日 / ログ:${p.meta?.count ?? 0}件 / ねらい:${p.meta?.target ?? '-'}`, 'ok');
});

els.save.addEventListener('click', () => {
  els.saveMsg.textContent = '';
  if (!lastProposals) {
    els.saveMsg.textContent = '先に「提案を生成」を押して。';
    return;
  }

  const pick = els.choice.value || 'A';
  const chosen = lastProposals[pick];
  if (!chosen) {
    els.saveMsg.textContent = '採用が変。A/B/Cのどれかにして。';
    return;
  }

  const did = els.did.value || 'はい';
  const memo = (els.memo.value || '').trim();

  const text = `[未来提案${pick}] ${chosen.title}（${chosen.minutes}分）` + (did === 'はい' ? ' 実行' : ' 未実行') + (memo ? ` / メモ: ${memo}` : '');

  // Save as a normal entry so 今日ページに反映される
  addEntry({ dateISO: nowISO(), timeHHMM: nowHHMM(), text, category: chosen.cat, meta: { source: 'future' } });

  els.saveMsg.textContent = '保存した。今日ページに戻る。';
  setPending();

  // Navigate back to root dashboard
  setTimeout(() => { location.href = '../'; }, 450);
});

// init
fillCategories();
setPending();
els.generate.click();
