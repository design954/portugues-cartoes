/* Daily review ("Hoje") — spaced repetition over the cards defined in index.html,
   plus section tabs and "Practice" (10 cards: PT→RU round, then RU→PT round, no effect on Hoje).
   Reads the global arrays WORDS, VERBS, FRASES, PARES, PEDIDOS (whichever exist) and reuses
   the page's voice (`chosen`) and speed slider (`rateEl`). Progress lives in localStorage. */
(function(){
  const KEY = 'pt-srs-v1';
  const INTERVALS = [1,3,7,14,30];   // days until next review for box 1..5
  const MAX_DUE = 15;

  /* ---- Cards from the page ---- */
  function collect(){
    const out = [];
    const add = (arr, kind) => (arr||[]).forEach(d=>{
      let pt, hint = '';
      if(kind==='noun'){ pt = `${d.a} ${d.w}`; hint = d.ex || ''; }
      else if(kind==='verb'){ pt = d.w + (d.prep ? ` (${d.prep})` : ''); }
      else { pt = d.pt; }
      out.push({id:`${kind}:${pt}`, kind, pt, say:d.say || (kind==='verb'?d.w:pt),
        ipa:d.ipa||'', ru:d.ru||'', en:d.en||'', g:d.g, hint});
    });
    try{ add(WORDS,'noun'); }catch(e){}
    try{ add(VERBS,'verb'); }catch(e){}
    try{ add(FRASES,'phrase'); }catch(e){}
    try{ add(PARES,'pair'); }catch(e){}
    try{ add(PEDIDOS,'ask'); }catch(e){}
    return out;
  }

  /* ---- Storage ---- */
  function load(){
    try{ const s = JSON.parse(localStorage.getItem(KEY)); if(s && s.cards) return s; }catch(e){}
    return {cards:{}, streak:{last:'',count:0}, perDay:5};
  }
  function save(){ try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){} }
  let state = load();

  /* ---- Dates (local) ---- */
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const today = () => iso(new Date());
  const addDays = n => { const d = new Date(); d.setDate(d.getDate()+n); return iso(d); };

  const shuffle = a => { for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };

  function dueCards(all){
    const t = today();
    return all.filter(c=>state.cards[c.id] && state.cards[c.id].due<=t)
              .sort((a,b)=>state.cards[a.id].due.localeCompare(state.cards[b.id].due));
  }
  const newCards = all => all.filter(c=>!state.cards[c.id]);

  /* ---- Styles ---- */
  const css = document.createElement('style');
  css.textContent = `
  .hoje-btn{font:inherit;font-size:14px;font-weight:600;padding:9px 16px;border-radius:10px;border:0;
    background:var(--accent);color:var(--card);cursor:pointer;white-space:nowrap}
  .hoje-btn:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
  .hoje-btn .n{opacity:.8;font-weight:500;margin-left:4px}
  .qz{position:fixed;inset:0;z-index:50;background:var(--bg);display:none;flex-direction:column;
    padding:max(16px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom))}
  .qz.open{display:flex}
  body.qz-lock{overflow:hidden}
  .qz-top{display:flex;align-items:center;gap:12px;max-width:560px;width:100%;margin:0 auto}
  .qz-x{font:inherit;font-size:22px;line-height:1;background:none;border:0;color:var(--muted);cursor:pointer;padding:6px 8px;border-radius:8px}
  .qz-bar{flex:1;height:6px;border-radius:99px;background:var(--line);overflow:hidden}
  .qz-bar i{display:block;height:100%;background:var(--accent);width:0;transition:width .2s}
  .qz-count{font-size:13px;color:var(--muted);min-width:44px;text-align:right;white-space:nowrap}
  .qz-body{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:560px;width:100%;margin:0 auto}
  .qz-card{background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);
    padding:28px 22px;text-align:center;min-height:260px;display:flex;flex-direction:column;justify-content:center;gap:10px}
  .qz-dir{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}
  .qz-pt{font-size:30px;font-weight:650;letter-spacing:-.01em;line-height:1.2;overflow-wrap:anywhere}
  .qz-ru{font-size:22px;line-height:1.3}
  .qz-ipa{font-size:16px;color:var(--accent)}
  .qz-en{font-size:15px;color:var(--muted)}
  .qz-hint{font-size:13px;color:var(--warn);line-height:1.35}
  .qz-g{display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;margin:0 auto}
  .qz-g.m{color:var(--m);background:var(--m-bg)} .qz-g.f{color:var(--f);background:var(--f-bg)}
  .qz-back{display:none;flex-direction:column;gap:8px;border-top:1px dashed var(--line);padding-top:14px;margin-top:6px}
  .qz.revealed .qz-back{display:flex}
  .qz-spk{font:inherit;font-size:14px;align-self:center;background:none;border:1px solid var(--line);
    color:var(--ink);border-radius:999px;padding:8px 16px;cursor:pointer}
  .qz-actions{display:flex;gap:10px;max-width:560px;width:100%;margin:16px auto 0}
  @media (min-width:600px){ .qz-body{flex:0 0 auto;margin-top:auto} .qz-actions{margin-bottom:auto} }
  .qz-actions button{flex:1;font:inherit;font-size:16px;font-weight:600;padding:16px 12px;border-radius:14px;border:0;cursor:pointer}
  .qz-actions button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
  .qz-show{background:var(--ink);color:var(--bg)}
  .qz-no{background:var(--warn-bg);color:var(--warn)}
  .qz-yes{background:var(--accent);color:var(--card)}
  .qz .after{display:none} .qz.revealed .after{display:block} .qz.revealed .before{display:none}
  .qz-done{text-align:center;display:flex;flex-direction:column;gap:12px;align-items:center}
  .qz-done h2{margin:0;font-size:24px}
  .qz-done p{margin:0;color:var(--muted);font-size:15px;line-height:1.45}
  .qz-row{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:8px}
  .qz-sec{font:inherit;font-size:14px;padding:10px 16px;border-radius:10px;border:1px solid var(--line);
    background:var(--card);color:var(--ink);cursor:pointer}
  .qz-set{display:flex;flex-wrap:wrap;gap:10px 16px;justify-content:center;align-items:center;font-size:13px;color:var(--muted);margin-top:18px}
  .qz-set label{display:flex;align-items:center;gap:6px}
  .tabs{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;
    margin:0 -16px 8px;padding:10px 0 10px 16px;background:var(--bg);border-bottom:1px solid var(--line)}
  .tabs-scroll{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-right:16px;min-width:0}
  .tabs-scroll::-webkit-scrollbar{display:none}
  .tab{font:inherit;font-size:13px;font-weight:600;white-space:nowrap;padding:7px 12px;border-radius:999px;
    border:1px solid var(--line);background:var(--card);color:var(--muted);cursor:pointer;flex-shrink:0}
  .tab .c{font-weight:500;opacity:.7;margin-left:4px}
  .tab[aria-pressed="true"]{background:var(--ink);color:var(--bg);border-color:var(--ink)}
  .tab:focus-visible,.prac-btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .prac-btn{font:inherit;font-size:13px;font-weight:600;white-space:nowrap;padding:7px 14px;border-radius:999px;
    border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;flex-shrink:0}
  .tabs .sep{width:1px;align-self:stretch;background:var(--line);flex-shrink:0}
  .tab-off{display:none!important}
  `;
  document.head.appendChild(css);

  /* ---- Markup ---- */
  const btn = document.createElement('button');
  btn.className = 'hoje-btn';
  btn.type = 'button';
  const controls = document.querySelector('header .controls') || document.querySelector('header');
  controls.prepend(btn);

  const qz = document.createElement('div');
  qz.className = 'qz';
  qz.setAttribute('role','dialog');
  qz.setAttribute('aria-label','Daily review');
  qz.innerHTML = `
    <div class="qz-top">
      <button class="qz-x" type="button" aria-label="Close">×</button>
      <div class="qz-bar"><i></i></div>
      <div class="qz-count"></div>
    </div>
    <div class="qz-body"></div>
    <div class="qz-actions"></div>`;
  document.body.appendChild(qz);
  const $body = qz.querySelector('.qz-body'), $act = qz.querySelector('.qz-actions');
  const $bar = qz.querySelector('.qz-bar i'), $count = qz.querySelector('.qz-count');

  /* ---- Section tabs ---- */
  const TABS = [
    {kind:'all',    label:'All'},
    {kind:'noun',   label:'Substantivos', grid:'grid',         head:'head-sub'},
    {kind:'verb',   label:'Verbos',       grid:'grid-verbs',   head:'head-verbs'},
    {kind:'phrase', label:'Frases',       grid:'grid-frases',  head:'head-frases'},
    {kind:'pair',   label:'Pares',        grid:'grid-pares',   head:'head-pares'},
    {kind:'ask',    label:'Posso / podes',grid:'grid-pedidos', head:'head-pedidos'},
  ].filter(t=>t.kind==='all' || document.getElementById(t.grid));
  let tab = 'all';
  try{ const t = localStorage.getItem('pt-tab'); if(TABS.some(x=>x.kind===t)) tab = t; }catch(e){}

  const bar = document.createElement('div');
  bar.className = 'tabs';
  bar.setAttribute('role','toolbar');
  bar.setAttribute('aria-label','Sections');
  const counts = {}; collect().forEach(c=>counts[c.kind]=(counts[c.kind]||0)+1);
  bar.innerHTML = `<button class="prac-btn" type="button">▶ Practice</button><span class="sep"></span><div class="tabs-scroll">` +
    TABS.map(t=>`<button class="tab" type="button" data-kind="${t.kind}">${t.label}${t.kind==='all'?'':`<span class="c">${counts[t.kind]||0}</span>`}</button>`).join('') + `</div>`;
  const hdr = document.querySelector('header');
  hdr.parentNode.insertBefore(bar, hdr.nextSibling);

  function setTab(kind){
    tab = kind;
    try{ localStorage.setItem('pt-tab', kind); }catch(e){}
    bar.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-pressed', b.dataset.kind===kind));
    TABS.forEach(t=>{
      if(t.kind==='all') return;
      const off = kind!=='all' && kind!==t.kind;
      [t.grid,t.head].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.toggle('tab-off', off); });
    });
  }
  bar.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
    setTab(b.dataset.kind);
    const top = bar.getBoundingClientRect().top + scrollY;
    if(scrollY > top) scrollTo({top});
  }));
  setTab(tab);

  function refreshBtn(){
    const all = collect();
    const n = Math.min(dueCards(all).length, MAX_DUE) + Math.min(newCards(all).length, state.perDay);
    btn.innerHTML = `Hoje<span class="n">· ${n}</span>`;
  }

  /* ---- Speech (reuses page voice + speed) ---- */
  function say(text){
    if(!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    let v = null; try{ v = chosen; }catch(e){}
    u.lang = v ? v.lang : 'pt-PT';
    if(v) u.voice = v;
    try{ u.rate = parseFloat(rateEl.value); }catch(e){ u.rate = .9; }
    speechSynthesis.speak(u);
  }
  const autoSpeak = () => state.autoSpeak !== false;

  /* ---- Session ---- */
  let queue = [], pos = 0, total = 0, failed = new Set(), stats = {yes:0,no:0};
  const PRACTICE_SIZE = 10;
  let mode = 'hoje', round = 1, picked = [], roundStats = [];

  function open(){ qz.classList.add('open'); document.body.classList.add('qz-lock'); }

  function practice(){
    mode = 'practice';
    const all = collect().filter(c=>tab==='all' || c.kind===tab);
    picked = shuffle(all).slice(0, PRACTICE_SIZE);
    roundStats = [];
    open();
    startRound(1);
  }
  function startRound(r){
    round = r;
    queue = shuffle(picked.map(c=>({...c, reverse: r===2})));
    pos = 0; total = queue.length; failed = new Set(); stats = {yes:0,no:0};
    queue.length ? showCard() : showPracticeDone();
  }

  function start(extraNew){
    mode = 'hoje';
    const all = collect();
    const due = dueCards(all).slice(0, MAX_DUE);
    const fresh = shuffle(newCards(all)).slice(0, extraNew ?? state.perDay);
    queue = shuffle([...due, ...fresh]).map(c=>{
      const box = state.cards[c.id] ? state.cards[c.id].box : 0;
      return {...c, reverse: box>=2 && Math.random()<.4};
    });
    pos = 0; total = queue.length; failed = new Set(); stats = {yes:0,no:0};
    open();
    queue.length ? showCard() : showDone(true);
  }

  function close(){
    qz.classList.remove('open'); document.body.classList.remove('qz-lock');
    try{ speechSynthesis.cancel(); }catch(e){}
    refreshBtn();
  }

  function progress(){
    $bar.style.width = total ? `${Math.min(100, Math.round(pos/queue.length*100))}%` : '100%';
    const n = queue.length ? `${Math.min(pos+1, queue.length)} / ${queue.length}` : '';
    $count.textContent = mode==='practice' ? `${round===1?'PT → RU':'RU → PT'} · ${n}` : n;
  }

  function showCard(){
    const c = queue[pos];
    qz.classList.remove('revealed');
    progress();
    const g = c.g ? `<span class="qz-g ${c.g}">${c.g==='m'?'masculino':'feminino'}</span>` : '';
    const ptBlock = `<div class="qz-pt">${c.pt}</div>`;
    const details = `<div class="qz-ipa">${c.ipa}</div>${c.en?`<div class="qz-en">${c.en}</div>`:''}${g}${c.hint?`<div class="qz-hint">${c.hint}</div>`:''}`;
    const spk = `<button class="qz-spk" type="button">🔊 Listen</button>`;
    $body.innerHTML = c.reverse
      ? `<div class="qz-card"><div class="qz-dir">Say it in Portuguese</div><div class="qz-ru">${c.ru}</div>
           <div class="qz-back">${ptBlock}${details}${spk}</div></div>`
      : `<div class="qz-card"><div class="qz-dir">What does it mean?</div>${ptBlock}${spk}
           <div class="qz-back"><div class="qz-ru">${c.ru}</div>${details}</div></div>`;
    $body.querySelectorAll('.qz-spk').forEach(b=>b.addEventListener('click',()=>say(c.say)));
    $act.innerHTML = `<button class="qz-show before" type="button">Show answer</button>
      <button class="qz-no after" type="button">Forgot</button>
      <button class="qz-yes after" type="button">Got it</button>`;
    $act.querySelector('.qz-show').addEventListener('click', reveal);
    $act.querySelector('.qz-no').addEventListener('click', ()=>answer(false));
    $act.querySelector('.qz-yes').addEventListener('click', ()=>answer(true));
    $act.querySelector('.qz-show').focus({preventScroll:true});
    if(!c.reverse && autoSpeak()) say(c.say);
  }

  function reveal(){
    if(qz.classList.contains('revealed')) return;
    qz.classList.add('revealed');
    const c = queue[pos];
    if(c.reverse && autoSpeak()) say(c.say);
    $act.querySelector('.qz-yes').focus({preventScroll:true});
  }

  function answer(ok){
    const c = queue[pos];
    if(mode==='practice'){
      ok ? stats.yes++ : stats.no++;
      if(!ok && !failed.has(c.id)){ failed.add(c.id); queue.push({...c}); }
      pos++;
      if(pos < queue.length) return showCard();
      roundStats[round-1] = {...stats, first: total - failed.size};
      return round===1 ? showRoundBreak() : showPracticeDone();
    }
    const s = state.cards[c.id] || {box:0, due:today()};
    if(ok){
      stats.yes++;
      if(!failed.has(c.id)){ s.box = Math.min(s.box+1, INTERVALS.length); s.due = addDays(INTERVALS[s.box-1]); }
    } else {
      stats.no++;
      s.box = 1; s.due = addDays(1);
      if(!failed.has(c.id)){ failed.add(c.id); queue.push({...c, reverse:false}); }
    }
    state.cards[c.id] = s; save();
    pos++;
    pos < queue.length ? showCard() : showDone(false);
  }

  function bumpStreak(){
    const t = today(), y = addDays(-1), st = state.streak;
    if(st.last === t) return;
    st.count = st.last === y ? st.count+1 : 1;
    st.last = t; save();
  }

  function showDone(empty){
    if(!empty) bumpStreak();
    $bar.style.width = '100%'; $count.textContent = '';
    const all = collect();
    const learned = all.filter(c=>state.cards[c.id] && state.cards[c.id].box>=3).length;
    const seen = all.filter(c=>state.cards[c.id]).length;
    const tomorrow = all.filter(c=>state.cards[c.id] && state.cards[c.id].due<=addDays(1)).length;
    const st = state.streak;
    const streak = st.last===today() ? st.count : 0;
    $body.innerHTML = `<div class="qz-done">
      <h2>${empty ? 'Nothing due today' : 'Done for today'}</h2>
      ${empty ? '' : `<p>Got it: ${stats.yes} · Forgot: ${stats.no}</p>`}
      <p>Streak: ${streak} day${streak===1?'':'s'} · Learned: ${learned} of ${all.length} · Started: ${seen}<br>Tomorrow: ${tomorrow} to review</p>
      <div class="qz-row">
        <button class="qz-sec" type="button" data-more>+5 new cards</button>
      </div>
      <div class="qz-set">
        <label>New per day
          <select data-per>${[3,5,10,15].map(n=>`<option ${n===state.perDay?'selected':''}>${n}</option>`).join('')}</select></label>
        <label><input type="checkbox" data-auto ${autoSpeak()?'checked':''}> Auto-play audio</label>
      </div>
      <div class="qz-row">
        <button class="qz-sec" type="button" data-export>Export progress</button>
        <button class="qz-sec" type="button" data-import>Import progress</button>
      </div>
    </div>`;
    $act.innerHTML = `<button class="qz-show" type="button">Close</button>`;
    $act.firstChild.addEventListener('click', close);
    $body.querySelector('[data-more]').addEventListener('click', ()=>start(5));
    $body.querySelector('[data-per]').addEventListener('change', e=>{ state.perDay = +e.target.value; save(); });
    $body.querySelector('[data-auto]').addEventListener('change', e=>{ state.autoSpeak = e.target.checked; save(); });
    $body.querySelector('[data-export]').addEventListener('click', exportProgress);
    $body.querySelector('[data-import]').addEventListener('click', importProgress);
  }

  const tabLabel = () => (TABS.find(t=>t.kind===tab)||TABS[0]).label;

  function showRoundBreak(){
    $bar.style.width = '100%'; $count.textContent = '';
    const r = roundStats[0];
    $body.innerHTML = `<div class="qz-done">
      <h2>Round 1 done</h2>
      <p>PT → RU: ${r.first} of ${total} right first time</p>
      <p>Now the same ${total} the other way: RU → PT.</p>
    </div>`;
    $act.innerHTML = `<button class="qz-yes" type="button">Start round 2</button>`;
    $act.firstChild.addEventListener('click', ()=>startRound(2));
    $act.firstChild.focus({preventScroll:true});
  }

  function showPracticeDone(){
    $bar.style.width = '100%'; $count.textContent = '';
    const [a,b] = roundStats;
    const n = picked.length;
    $body.innerHTML = n ? `<div class="qz-done">
      <h2>Practice done</h2>
      <p>${tabLabel()} · ${n} cards</p>
      <p>PT → RU: ${a.first} of ${n} right first time<br>RU → PT: ${b.first} of ${n} right first time</p>
      <div class="qz-row"><button class="qz-sec" type="button" data-again>10 more from ${tabLabel()}</button></div>
    </div>` : `<div class="qz-done"><h2>No cards here yet</h2></div>`;
    $act.innerHTML = `<button class="qz-show" type="button">Close</button>`;
    $act.firstChild.addEventListener('click', close);
    const again = $body.querySelector('[data-again]');
    if(again) again.addEventListener('click', practice);
  }

  /* ---- Export / import ---- */
  function exportProgress(){
    const blob = new Blob([JSON.stringify(state, null, 1)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `portugues-progress-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }
  function importProgress(){
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.addEventListener('change', async ()=>{
      try{
        const s = JSON.parse(await inp.files[0].text());
        if(!s || !s.cards) throw new Error('bad file');
        state = {perDay:5, streak:{last:'',count:0}, ...s}; save();
        showDone(true);
      }catch(e){ alert('This file does not look like a progress export.'); }
    });
    inp.click();
  }

  /* ---- Wiring ---- */
  btn.addEventListener('click', ()=>start());
  bar.querySelector('.prac-btn').addEventListener('click', practice);
  qz.querySelector('.qz-x').addEventListener('click', close);
  document.addEventListener('keydown', e=>{
    if(!qz.classList.contains('open') || e.target.tagName==='SELECT') return;
    if(e.key==='Escape') return close();
    if(!queue[pos] || pos>=queue.length) return;
    const revealed = qz.classList.contains('revealed');
    if(!revealed && (e.key===' ' || e.key==='Enter')){ e.preventDefault(); reveal(); }
    else if(revealed && (e.key==='1' || e.key==='ArrowLeft')) answer(false);
    else if(revealed && (e.key==='2' || e.key==='ArrowRight')) answer(true);
  });
  refreshBtn();
})();
