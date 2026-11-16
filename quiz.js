/* Daily review ("Hoje") — spaced repetition over the cards defined in index.html,
   plus section tabs, "Practice" (10 cards: PT→RU round, then RU→PT round, no effect on Hoje)
   and "Study" (each verb, then every phrase that uses it; translations hidden until tapped).
   Game layer: daily goal (answers in any mode), streak of days with the goal met, week strip, medals.
   Reads the global arrays WORDS, VERBS, FRASES, PARES, PEDIDOS, ORACOES, LICAO4 (whichever exist) and reuses
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
    try{ add(ORACOES,'sent'); }catch(e){}
    try{ add(LICAO4,'l4'); }catch(e){}
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

  /* ---- Game: daily goal, streak, medals (kept in state.game, so it is exported too) ---- */
  function game(){
    if(!state.game){
      const old = state.streak || {};
      state.game = {goal:20, days:{}, streak:{count: old.count||0, last: old.last||''}, medals:{}, pseen:{}};
    }
    return state.game;
  }
  const answeredToday = () => game().days[today()] || 0;
  function streakNow(){
    const st = game().streak;
    return (st.last===today() || st.last===addDays(-1)) ? st.count : 0;
  }
  const FLAME = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="flame" d="M12 2c1 3.5-1.5 5.2-1.5 7.8 0 1.4 1 2.2 2 2.2 1.4 0 2.2-1.2 1.8-3.3C17 10.6 19 13.6 19 16.5 19 20.1 15.9 22 12 22s-7-1.9-7-5.5C5 11.6 9.8 9 12 2z"/></svg>';

  const MEDALS = [
    {id:'s3',   ic:'3',   name:'3-day streak',    hint:'Goal met 3 days in a row'},
    {id:'s7',   ic:'7',   name:'Week streak',     hint:'7 days in a row'},
    {id:'s30',  ic:'30',  name:'Month streak',    hint:'30 days in a row'},
    {id:'s100', ic:'100', name:'100-day streak',  hint:'100 days in a row'},
    {id:'c50',  ic:'50',  name:'50 cards learned',  hint:'Remembered 3 times in a row in Hoje'},
    {id:'c100', ic:'100', name:'100 cards learned', hint:'Remembered 3 times in a row in Hoje'},
    {id:'c300', ic:'300', name:'300 cards learned', hint:'Remembered 3 times in a row in Hoje'},
    {id:'verbs',ic:'V',   name:'All verbs known', hint:'Every verb marked Got it in Study'},
    {id:'p12',  ic:'1–2', name:'Lição 1–2 practised', hint:'Every card of the lesson seen in Practice'},
    {id:'p3',   ic:'3',   name:'Lição 3 practised',   hint:'Every card of the lesson seen in Practice'},
    {id:'p4',   ic:'4',   name:'Lição 4 practised',   hint:'Every card of the lesson seen in Practice'},
  ];
  function checkMedals(){
    const g = game(), got = [];
    const give = id => { if(!g.medals[id]){ g.medals[id] = today(); got.push(MEDALS.find(m=>m.id===id)); } };
    const sc = streakNow();
    [[3,'s3'],[7,'s7'],[30,'s30'],[100,'s100']].forEach(([n,id])=>{ if(sc>=n) give(id); });
    const all = collect();
    const learned = all.filter(c=>state.cards[c.id] && state.cards[c.id].box>=3).length;
    [[50,'c50'],[100,'c100'],[300,'c300']].forEach(([n,id])=>{ if(learned>=n) give(id); });
    try{ if(VERBS.length && VERBS.every(v=>known[v.w]===1)) give('verbs'); }catch(e){}
    [['l12','p12'],['l3','p3'],['l4','p4']].forEach(([lid,id])=>{
      const L = LESSONS.find(l=>l.id===lid);
      const cards = all.filter(c=>L.kinds.includes(c.kind));
      if(cards.length && cards.every(c=>g.pseen[c.id])) give(id);
    });
    if(got.length) save();
    return got;
  }

  // Count one answer from any mode; celebrate when the daily goal is reached.
  function tick(){
    const g = game(), t = today();
    g.days[t] = (g.days[t]||0) + 1;
    let hit = false;
    if(g.days[t] === g.goal){
      const st = g.streak;
      if(st.last !== t){ st.count = st.last===addDays(-1) ? st.count+1 : 1; st.last = t; }
      hit = true;
    }
    save();
    const medals = checkMedals();
    if(hit || medals.length) celebrate(hit, medals);
    renderGoal();
  }

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
  .goalbar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 12px;padding:10px 12px;border:1px solid var(--line);
    border-radius:14px;background:var(--card);cursor:pointer;font:inherit;color:var(--ink);width:100%;text-align:left}
  .goalbar:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .gb-streak{display:flex;align-items:center;gap:6px;font-weight:700;font-size:15px;white-space:nowrap}
  .gb-streak svg{width:20px;height:20px}
  .flame{fill:var(--line)} .flame.on{fill:var(--warn)}
  .gb-ring{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--muted);white-space:nowrap}
  .ring{width:28px;height:28px;transform:rotate(-90deg)}
  .ring .bg{fill:none;stroke:var(--line);stroke-width:4} .ring .fg{fill:none;stroke:var(--accent);stroke-width:4;stroke-linecap:round;transition:stroke-dashoffset .3s}
  .gb-week{display:flex;gap:6px;margin-left:auto}
  @media (max-width:520px){ .gb-week{margin-left:0;width:100%;justify-content:space-between} }
  .wd{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;color:var(--muted)}
  .wd i{width:14px;height:14px;border-radius:50%;border:2px solid var(--line);display:block}
  .wd.met i{background:var(--accent);border-color:var(--accent)}
  .wd.today i{border-color:var(--ink)}
  .wd.today.met i{border-color:var(--accent)}
  .cele{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);padding:16px;overflow:hidden}
  .cele.open{display:flex}
  .cele-box{position:relative;z-index:1;background:var(--card);border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);
    padding:28px 22px;max-width:360px;width:100%;text-align:center;display:flex;flex-direction:column;gap:10px}
  .cele-box h2{margin:0;font-size:26px}
  .cele-box p{margin:0;color:var(--muted);font-size:15px;line-height:1.45}
  .cele-box .big{font-size:40px;font-weight:750;color:var(--warn);display:flex;align-items:center;justify-content:center;gap:6px}
  .cele-box .big svg{width:36px;height:36px}
  .cele-box button{font:inherit;font-size:16px;font-weight:600;padding:14px;border-radius:14px;border:0;cursor:pointer;background:var(--accent);color:var(--card);margin-top:6px}
  .medal-new{display:flex;align-items:center;gap:10px;text-align:left;background:var(--bg);border-radius:12px;padding:10px 12px;font-size:14px}
  .confetti{position:absolute;top:-12px;width:8px;height:14px;border-radius:2px;animation:fall 1.8s ease-in forwards}
  @keyframes fall{to{transform:translateY(105vh) rotate(540deg);opacity:.9}}
  @media (prefers-reduced-motion:reduce){.confetti{display:none}}
  .medals{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px;width:100%;margin-top:6px}
  .medal{border:1px solid var(--line);border-radius:14px;padding:12px 10px;text-align:center;font-size:13px;color:var(--muted);background:var(--card)}
  .medal .m-ic{width:36px;height:36px;border-radius:50%;margin:0 auto 6px;display:flex;align-items:center;justify-content:center;
    font-weight:750;font-size:13px;background:var(--line);color:var(--muted)}
  .medal.got{color:var(--ink);border-color:var(--accent)}
  .medal.got .m-ic{background:var(--accent);color:var(--card)}
  .medal small{display:block;margin-top:3px;color:var(--muted);font-size:11px}
  .qz-body.scroll{justify-content:flex-start;overflow-y:auto}
  .pg-week{display:flex;gap:10px;justify-content:center;margin:4px 0}
  .pg-week .wd{font-size:12px} .pg-week .wd i{width:22px;height:22px}
  .menu-btn{font:inherit;font-size:14px;font-weight:600;display:inline-flex;align-items:center;gap:8px;padding:8px 12px;
    border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer;white-space:nowrap}
  .menu-btn .ic{font-size:16px;line-height:1}
  .menu-btn:focus-visible,.menu-item:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .menu-back{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.35);display:none}
  .menu-panel{position:fixed;top:0;left:0;bottom:0;z-index:41;width:min(320px,86vw);background:var(--card);
    border-right:1px solid var(--line);box-shadow:var(--shadow);padding:max(16px,env(safe-area-inset-top)) 12px 16px;
    overflow-y:auto;transform:translateX(-100%);transition:transform .2s ease;visibility:hidden}
  body.menu-open .menu-back{display:block}
  body.menu-open .menu-panel{transform:none;visibility:visible}
  .menu-head{display:flex;align-items:center;justify-content:space-between;padding:0 6px 10px;font-size:13px;font-weight:700;
    text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}
  .menu-item{display:block;width:100%;text-align:left;font:inherit;background:none;border:0;border-radius:12px;
    padding:12px;margin-bottom:4px;color:var(--ink);cursor:pointer}
  .menu-item:hover{background:var(--bg)}
  .menu-item[aria-current="true"]{background:var(--bg);box-shadow:inset 3px 0 0 var(--accent)}
  .menu-item b{display:block;font-size:16px;font-weight:650}
  .menu-item span{display:block;font-size:13px;color:var(--muted);margin-top:3px;line-height:1.35}
  .prac-btn[hidden]{display:none}
  .qz-tr{display:none;flex-direction:column;gap:6px;border-top:1px dashed var(--line);padding-top:12px;margin-top:4px}
  .qz.revealed .qz-tr{display:flex}
  .qz-back-btn{flex:0 0 auto!important;min-width:96px;background:var(--card)!important;color:var(--ink)!important;border:1px solid var(--line)!important}
  .qz-back-btn:disabled{opacity:.4;cursor:default}
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

  /* ---- Lessons (burger menu): narrows sections; default "All lessons" = everything ---- */
  const LESSONS = [
    {id:'all', label:'All lessons', kinds:null},
    {id:'l12', label:'Lição 1–2',  kinds:['noun','pair']},
    {id:'l3',  label:'Lição 3',    kinds:['verb','phrase','ask','sent']},
    {id:'l4',  label:'Lição 4',    kinds:['l4']},
  ];
  let lesson = 'all';
  try{ const l = localStorage.getItem('pt-lesson'); if(LESSONS.some(x=>x.id===l)) lesson = l; }catch(e){}
  const lessonOf = () => LESSONS.find(l=>l.id===lesson) || LESSONS[0];
  const inLesson = kind => !lessonOf().kinds || lessonOf().kinds.includes(kind);

  /* ---- Section tabs ---- */
  const TABS = [
    {kind:'all',    label:'All'},
    {kind:'noun',   label:'Substantivos', grid:'grid',         head:'head-sub'},
    {kind:'verb',   label:'Verbos',       grid:'grid-verbs',   head:'head-verbs'},
    {kind:'phrase', label:'Frases',       grid:'grid-frases',  head:'head-frases'},
    {kind:'pair',   label:'Pares',        grid:'grid-pares',   head:'head-pares'},
    {kind:'ask',    label:'Posso / podes',grid:'grid-pedidos', head:'head-pedidos'},
    {kind:'sent',   label:'Orações',      grid:'grid-oracoes', head:'head-oracoes'},
    {kind:'l4',     label:'Lição 4',      grid:'grid-licao4',  head:'head-licao4'},
  ].filter(t=>t.kind==='all' || document.getElementById(t.grid));
  let tab = 'all';
  try{ const t = localStorage.getItem('pt-tab'); if(TABS.some(x=>x.kind===t)) tab = t; }catch(e){}

  const bar = document.createElement('div');
  bar.className = 'tabs';
  bar.setAttribute('role','toolbar');
  bar.setAttribute('aria-label','Sections');
  const counts = {}; collect().forEach(c=>counts[c.kind]=(counts[c.kind]||0)+1);
  bar.innerHTML = `<button class="prac-btn" type="button">▶ Practice</button><button class="prac-btn study-btn" type="button" hidden>▶ Study</button><span class="sep"></span><div class="tabs-scroll">` +
    TABS.map(t=>`<button class="tab" type="button" data-kind="${t.kind}">${t.label}${t.kind==='all'?'':`<span class="c">${counts[t.kind]||0}</span>`}</button>`).join('') + `</div>`;
  const hdr = document.querySelector('header');
  hdr.parentNode.insertBefore(bar, hdr.nextSibling);

  function setTab(kind){
    if(kind!=='all' && !inLesson(kind)) kind = 'all';
    tab = kind;
    try{ localStorage.setItem('pt-tab', kind); }catch(e){}
    bar.querySelectorAll('.tab').forEach(b=>b.setAttribute('aria-pressed', b.dataset.kind===kind));
    bar.querySelector('.study-btn').hidden = kind!=='verb';
    TABS.forEach(t=>{
      if(t.kind==='all') return;
      const tb = bar.querySelector(`.tab[data-kind="${t.kind}"]`);
      if(tb) tb.hidden = !inLesson(t.kind);
      const off = !inLesson(t.kind) || (kind!=='all' && kind!==t.kind);
      [t.grid,t.head].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.toggle('tab-off', off); });
    });
  }
  bar.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
    setTab(b.dataset.kind);
    const top = bar.getBoundingClientRect().top + scrollY;
    if(scrollY > top) scrollTo({top});
  }));
  setTab(tab);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'menu-btn'; menuBtn.type = 'button';
  menuBtn.setAttribute('aria-haspopup','dialog');
  hdr.prepend(menuBtn);
  const menuBack = document.createElement('div'); menuBack.className = 'menu-back';
  const menu = document.createElement('nav'); menu.className = 'menu-panel'; menu.setAttribute('aria-label','Lessons');
  document.body.append(menuBack, menu);

  function renderMenu(){
    menuBtn.innerHTML = `<span class="ic" aria-hidden="true">☰</span>${lessonOf().label}`;
    const secs = l => TABS.filter(t=>t.kind!=='all' && (!l.kinds || l.kinds.includes(t.kind)));
    menu.innerHTML = `<div class="menu-head">Lessons<button class="qz-x" type="button" aria-label="Close menu">×</button></div>` +
      LESSONS.map(l=>{
        const ss = secs(l);
        const n = ss.reduce((a,t)=>a+(counts[t.kind]||0),0);
        const desc = l.id==='all' ? `Everything · ${n} cards` : `${l.id==='l4' ? 'Phrases' : ss.map(t=>t.label).join(', ')} · ${n} cards`;
        return `<button class="menu-item" type="button" data-l="${l.id}" aria-current="${l.id===lesson}"><b>${l.label}</b><span>${desc}</span></button>`;
      }).join('') +
      `<div class="menu-head" style="margin-top:10px">Motivation</div><button class="menu-item" type="button" data-prog><b>Progress &amp; medals</b><span>Streak, daily goal, medals</span></button>`;
    menu.querySelector('.qz-x').addEventListener('click', closeMenu);
    menu.querySelector('[data-prog]').addEventListener('click', ()=>{ closeMenu(); showProgress(); });
    menu.querySelectorAll('.menu-item[data-l]').forEach(b=>b.addEventListener('click',()=>{ setLesson(b.dataset.l); closeMenu(); }));
  }
  function setLesson(id){
    lesson = id;
    try{ localStorage.setItem('pt-lesson', id); }catch(e){}
    setTab(tab);
    renderMenu();
    scrollTo({top:0});
  }
  function openMenu(){ document.body.classList.add('menu-open'); menuBtn.setAttribute('aria-expanded','true');
    (menu.querySelector('[aria-current="true"]')||menu.querySelector('.menu-item')).focus({preventScroll:true}); }
  function closeMenu(){ document.body.classList.remove('menu-open'); menuBtn.setAttribute('aria-expanded','false'); menuBtn.focus({preventScroll:true}); }
  menuBtn.addEventListener('click', openMenu);
  menuBack.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && document.body.classList.contains('menu-open')) closeMenu(); });
  renderMenu();

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

  function open(){ qz.classList.add('open'); document.body.classList.add('qz-lock'); $body.classList.remove('scroll'); }

  function practice(){
    mode = 'practice';
    const all = collect().filter(c=> tab==='all' ? inLesson(c.kind) : c.kind===tab);
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
      game().pseen[c.id] = 1;
      tick();
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
    tick();
    pos++;
    pos < queue.length ? showCard() : showDone(false);
  }

  function showDone(empty){
    $bar.style.width = '100%'; $count.textContent = '';
    const all = collect();
    const learned = all.filter(c=>state.cards[c.id] && state.cards[c.id].box>=3).length;
    const seen = all.filter(c=>state.cards[c.id]).length;
    const tomorrow = all.filter(c=>state.cards[c.id] && state.cards[c.id].due<=addDays(1)).length;
    const streak = streakNow();
    $body.innerHTML = `<div class="qz-done">
      <h2>${empty ? 'Nothing due today' : 'Done for today'}</h2>
      ${empty ? '' : `<p>Got it: ${stats.yes} · Forgot: ${stats.no}</p>`}
      <p>Today: ${answeredToday()} / ${game().goal} · Streak: ${streak} day${streak===1?'':'s'}<br>Learned: ${learned} of ${all.length} · Started: ${seen}<br>Tomorrow: ${tomorrow} to review</p>
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

  /* ---- Study: verb, then its phrases ---- */
  const FORMS = {poder:['pode','podes','posso','podem','podemos'], achar:['acho'], ir:['vou'],
    saltar:['salta'], ficar:['fica'], chamar:['chamo-me'], estar:['está']};
  let steps = [], sIdx = 0, verbCount = 0;

  function buildSteps(){
    const g = n => { try{ return eval(n); }catch(e){ return []; } };
    const phrases = [...g('FRASES'), ...g('PEDIDOS'), ...g('ORACOES'), ...g('LICAO4')].map(d=>{
      const low = d.pt.toLowerCase().replace(/[?!.,;:]/g,' ');
      const words = new Set(low.split(/\s+/).flatMap(w=>[w, ...w.split('-')]).filter(Boolean));
      return {d, low:` ${low.replace(/\s+/g,' ').trim()} `, words};
    });
    const out = [];
    let vi = 0;
    g('VERBS').forEach(v=>{
      const forms = v.w.includes(' ') ? null : [v.w, ...(FORMS[v.w]||[])];
      const hits = phrases.filter(p=> forms ? forms.some(f=>p.words.has(f)) : p.low.includes(` ${v.w} `));
      vi++;
      out.push({type:'verb', v, vi, n:hits.length});
      hits.forEach((p,i)=>out.push({type:'phrase', v, vi, d:p.d, i:i+1, n:hits.length}));
    });
    verbCount = vi;
    return out;
  }

  /* Verb marks (Got it / Forgot) — separate from the Hoje schedule. */
  const KNOWN_KEY = 'pt-verbs-known';
  let known = {};
  try{ known = JSON.parse(localStorage.getItem(KNOWN_KEY)) || {}; }catch(e){}
  const saveKnown = () => { try{ localStorage.setItem(KNOWN_KEY, JSON.stringify(known)); }catch(e){} };
  let studyList = 'all';

  // Keep only verbs whose mark passes `keep`, renumbering verbs 1..N.
  function selectSteps(all, keep){
    const out = []; let vi = 0, cur = null;
    all.forEach(st=>{
      if(st.type==='verb'){ cur = keep(st.v.w); if(cur) vi++; }
      if(cur) out.push({...st, vi});
    });
    verbCount = vi;
    return out;
  }
  const needsReview = w => known[w] !== 1;

  function studySaved(){ try{ return JSON.parse(localStorage.getItem('pt-study')); }catch(e){ return null; } }
  function studySave(){ try{ localStorage.setItem('pt-study', JSON.stringify({w:steps[sIdx].v.w, i:steps[sIdx].i||0, list:studyList})); }catch(e){} }

  function runList(list, startW, startI){
    studyList = list;
    steps = selectSteps(buildSteps(), list==='review' ? needsReview : ()=>true);
    sIdx = 0;
    if(startW){ const at = steps.findIndex(x=>x.v.w===startW && (x.i||0)===startI); if(at>=0) sIdx = at; }
    steps.length ? showStep() : studyFinish();
  }

  function study(){
    mode = 'study';
    open();
    const all = buildSteps();
    const verbs = all.filter(x=>x.type==='verb');
    const total = verbs.length;
    const nKnown = verbs.filter(x=>known[x.v.w]===1).length;
    const nReview = total - nKnown;
    const sv = studySaved();
    const svOk = sv && all.some(x=>x.v.w===sv.w) && !(sv.list==='review' && !needsReview(sv.w));
    $bar.style.width = `${total?Math.round(nKnown/total*100):0}%`; $count.textContent = '';
    $body.innerHTML = `<div class="qz-done"><h2>Verbs step by step</h2>
      <p>Known: ${nKnown} of ${total} · To review: ${nReview}</p>
      <p>Each verb is followed by its phrases.</p>
      <div class="qz-row">
        <button class="qz-sec" type="button" data-all>All verbs (${total})</button>
        ${svOk?`<button class="qz-sec" type="button" data-cont>Continue: ${sv.w}</button>`:''}
      </div></div>`;
    $act.innerHTML = nReview
      ? `<button class="qz-yes" type="button">Review: ${nReview} verb${nReview===1?'':'s'}</button>`
      : `<button class="qz-yes" type="button">All verbs known · go through all</button>`;
    $act.firstChild.addEventListener('click', ()=>runList(nReview?'review':'all'));
    $act.firstChild.focus({preventScroll:true});
    $body.querySelector('[data-all]').addEventListener('click', ()=>runList('all'));
    const c = $body.querySelector('[data-cont]');
    if(c) c.addEventListener('click', ()=>runList(sv.list||'all', sv.w, sv.i||0));
  }

  function showStep(){
    const st = steps[sIdx];
    if(!st) return;
    studySave();
    qz.classList.remove('revealed');
    $bar.style.width = `${Math.round(st.vi/verbCount*100)}%`;
    const lbl = studyList==='review' ? 'Review' : 'Verb';
    $count.textContent = st.type==='verb' ? `${lbl} ${st.vi} / ${verbCount}` : `${lbl} ${st.vi} / ${verbCount} · ${st.i} / ${st.n}`;
    const spk = `<button class="qz-spk" type="button">🔊 Listen</button>`;
    const isVerb = st.type==='verb';
    let sayText;
    if(isVerb){
      const v = st.v;
      sayText = v.w;
      const m = known[v.w];
      const lastTime = m===1 ? 'Last time: got it' : m===0 ? 'Last time: forgot' : 'New';
      $body.innerHTML = `<div class="qz-card"><div class="qz-dir">Verb · ${st.n} phrase${st.n===1?'':'s'} · ${lastTime}</div>
        <div class="qz-pt">${v.w}${v.prep?` <span class="qz-en">(${v.prep})</span>`:''}</div>
        <div class="qz-ipa">${v.ipa||''}</div>${spk}
        <div class="qz-tr"><div class="qz-ru">${v.ru||''}</div>${v.en?`<div class="qz-en">${v.en}</div>`:''}</div></div>`;
    } else {
      const d = st.d;
      sayText = d.pt;
      $body.innerHTML = `<div class="qz-card"><div class="qz-dir">${st.v.w}</div>
        <div class="qz-pt">${d.pt}</div><div class="qz-ipa">${d.ipa||''}</div>${spk}
        <div class="qz-tr"><div class="qz-ru">${d.ru||''}</div></div></div>`;
    }
    $body.querySelector('.qz-spk').addEventListener('click', ()=>say(sayText));
    $body.querySelector('.qz-card').addEventListener('click', e=>{
      if(e.target.closest('.qz-spk')) return;
      if(!qz.classList.contains('revealed')) reveal2(); else if(!isVerb) studyNext();
    });
    const last = sIdx === steps.length-1;
    const back = `<button class="qz-back-btn" type="button" ${sIdx===0?'disabled':''}>← Back</button>`;
    $act.innerHTML = back + `<button class="qz-show before" type="button">Show translation</button>` +
      (isVerb
        ? `<button class="qz-no after" type="button">Forgot</button><button class="qz-yes after" type="button">Got it</button>`
        : `<button class="qz-yes after" type="button">${last?'Finish':'Next →'}</button>`);
    $act.querySelector('.qz-back-btn').addEventListener('click', studyBack);
    $act.querySelector('.qz-show').addEventListener('click', reveal2);
    if(isVerb){
      $act.querySelector('.qz-no').addEventListener('click', ()=>studyMark(false));
      $act.querySelector('.qz-yes').addEventListener('click', ()=>studyMark(true));
    } else $act.querySelector('.qz-yes').addEventListener('click', studyNext);
    $act.querySelector('.qz-show').focus({preventScroll:true});
    if(autoSpeak()) say(sayText);
  }

  function reveal2(){
    if(qz.classList.contains('revealed')) return;
    qz.classList.add('revealed');
    $act.querySelector('.qz-yes').focus({preventScroll:true});
  }
  function studyMark(ok){
    known[steps[sIdx].v.w] = ok ? 1 : 0;
    saveKnown();
    tick();
    studyNext();
  }
  function studyNext(){
    if(sIdx < steps.length-1){ sIdx++; showStep(); } else studyFinish();
  }
  function studyFinish(){
    try{ localStorage.removeItem('pt-study'); }catch(e){}
    const verbs = buildSteps().filter(x=>x.type==='verb');
    const nKnown = verbs.filter(x=>known[x.v.w]===1).length;
    $bar.style.width = '100%'; $count.textContent = '';
    $body.innerHTML = `<div class="qz-done"><h2>${studyList==='review'?'Review done':'All verbs done'}</h2>
      <p>Known: ${nKnown} of ${verbs.length} · To review: ${verbs.length-nKnown}</p></div>`;
    $act.innerHTML = `<button class="qz-show" type="button">Close</button>`;
    $act.firstChild.addEventListener('click', close);
  }
  function studyBack(){ if(sIdx>0){ sIdx--; showStep(); } }

  const tabLabel = () => tab==='all' ? lessonOf().label : (TABS.find(t=>t.kind===tab)||TABS[0]).label;

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

  /* ---- Goal bar, celebration, progress screen ---- */
  const goalbar = document.createElement('button');
  goalbar.className = 'goalbar'; goalbar.type = 'button';
  goalbar.setAttribute('aria-label','Daily goal, streak and medals');
  bar.parentNode.insertBefore(goalbar, bar);

  function weekDays(){
    const d = new Date(); const dow = (d.getDay()+6)%7; // Monday = 0
    return Array.from({length:7},(_,i)=>{ const x = new Date(); x.setDate(d.getDate()-dow+i); return iso(x); });
  }
  function weekHtml(cls){
    const g = game(), t = today();
    return `<div class="${cls}">` + weekDays().map((k,i)=>`<div class="wd${(g.days[k]||0)>=g.goal?' met':''}${k===t?' today':''}"><i></i>${'MTWTFSS'[i]}</div>`).join('') + `</div>`;
  }
  function ringHtml(size){
    const g = game(), r = 12, c = 2*Math.PI*r, f = Math.min(1, answeredToday()/g.goal);
    return `<svg class="ring" viewBox="0 0 28 28" style="width:${size}px;height:${size}px"><circle class="bg" cx="14" cy="14" r="${r}"/><circle class="fg" cx="14" cy="14" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c*(1-f)}"/></svg>`;
  }
  function renderGoal(){
    const g = game(), n = answeredToday(), sc = streakNow();
    goalbar.innerHTML = `<span class="gb-streak">${FLAME.replace('class="flame"', `class="flame${n>=g.goal?' on':''}"`)}${sc} day${sc===1?'':'s'}</span>
      <span class="gb-ring">${ringHtml(28)}${Math.min(n,g.goal)} / ${g.goal} today</span>${weekHtml('gb-week')}`;
  }

  const cele = document.createElement('div');
  cele.className = 'cele'; cele.setAttribute('role','dialog'); cele.setAttribute('aria-label','Celebration');
  document.body.appendChild(cele);
  function celebrate(hit, medals){
    const sc = streakNow();
    const confetti = hit ? Array.from({length:40},()=>{
      const colors = ['var(--accent)','var(--warn)','var(--m)','var(--f)'];
      return `<span class="confetti" style="left:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*4)]};animation-delay:${(Math.random()*.6).toFixed(2)}s"></span>`;
    }).join('') : '';
    cele.innerHTML = confetti + `<div class="cele-box">
      ${hit ? `<h2>Meta cumprida!</h2><p>Daily goal reached: ${game().goal} answers.</p>
        <div class="big">${FLAME.replace('class="flame"','class="flame on"')}${sc}</div><p>day${sc===1?'':'s'} in a row</p>` : `<h2>New medal!</h2>`}
      ${medals.map(m=>`<div class="medal-new"><span class="m-ic" style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:var(--card);display:flex;align-items:center;justify-content:center;font-weight:750;font-size:12px;flex-shrink:0">${m.ic}</span><span><b>${m.name}</b><br>${m.hint}</span></div>`).join('')}
      <button type="button">Continue</button></div>`;
    cele.classList.add('open');
    const b = cele.querySelector('button');
    b.addEventListener('click', ()=>cele.classList.remove('open'));
    b.focus({preventScroll:true});
  }

  function showProgress(){
    mode = 'progress';
    open();
    const g = game(), n = answeredToday(), sc = streakNow();
    const best = g.streak.count;
    const daysMet = Object.values(g.days).filter(v=>v>=g.goal).length;
    $bar.style.width = `${Math.min(100, Math.round(n/g.goal*100))}%`; $count.textContent = '';
    $body.classList.add('scroll');
    $body.innerHTML = `<div class="qz-done">
      <h2>Progress</h2>
      <div class="cele-box" style="box-shadow:none;max-width:none;padding:18px">
        <div class="big">${FLAME.replace('class="flame"', `class="flame${n>=g.goal?' on':''}"`)}${sc}</div>
        <p>day${sc===1?'':'s'} in a row · ${daysMet} day${daysMet===1?'':'s'} with the goal met</p>
        <p>Today: ${Math.min(n,g.goal)} / ${g.goal} answers${n>g.goal?` (+${n-g.goal} extra)`:''}</p>
        ${weekHtml('pg-week')}
      </div>
      <div class="qz-set"><label>Daily goal
        <select data-goal>${[10,20,30,50].map(v=>`<option ${v===g.goal?'selected':''}>${v}</option>`).join('')}</select></label></div>
      <h2 style="font-size:18px;margin-top:8px">Medals · ${Object.keys(g.medals).length} of ${MEDALS.length}</h2>
      <div class="medals">${MEDALS.map(m=>{ const d = g.medals[m.id];
        return `<div class="medal${d?' got':''}"><div class="m-ic">${m.ic}</div>${m.name}<small>${d?`Got ${d}`:m.hint}</small></div>`; }).join('')}</div>
    </div>`;
    $act.innerHTML = `<button class="qz-show" type="button">Close</button>`;
    $act.firstChild.addEventListener('click', close);
    $body.querySelector('[data-goal]').addEventListener('change', e=>{ g.goal = +e.target.value; save(); renderGoal(); });
  }
  goalbar.addEventListener('click', showProgress);

  /* ---- Export / import ---- */
  function exportProgress(){
    const blob = new Blob([JSON.stringify({...state, verbsKnown: known}, null, 1)], {type:'application/json'});
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
        const {verbsKnown, ...rest} = s;
        state = {perDay:5, streak:{last:'',count:0}, ...rest}; save();
        if(verbsKnown && typeof verbsKnown==='object'){ known = verbsKnown; saveKnown(); }
        renderGoal();
        showDone(true);
      }catch(e){ alert('This file does not look like a progress export.'); }
    });
    inp.click();
  }

  /* ---- Wiring ---- */
  btn.addEventListener('click', ()=>start());
  bar.querySelector('.prac-btn').addEventListener('click', practice);
  bar.querySelector('.study-btn').addEventListener('click', study);
  qz.querySelector('.qz-x').addEventListener('click', close);
  document.addEventListener('keydown', e=>{
    if(cele.classList.contains('open')){ if(e.key==='Escape') cele.classList.remove('open'); return; }
    if(!qz.classList.contains('open') || e.target.tagName==='SELECT') return;
    if(e.key==='Escape') return close();
    if(mode==='progress') return;
    if(mode==='study'){
      if(!steps[sIdx] || !$act.querySelector('.qz-back-btn')) return;
      const rv = qz.classList.contains('revealed'), isVerb = steps[sIdx].type==='verb';
      if(e.key==='ArrowLeft') return studyBack();
      if(!rv && (e.key===' ' || e.key==='Enter')){ e.preventDefault(); return reveal2(); }
      if(rv && isVerb && e.key==='1') return studyMark(false);
      if(rv && isVerb && e.key==='2') return studyMark(true);
      if(rv && !isVerb && (e.key===' ' || e.key==='Enter' || e.key==='ArrowRight')){ e.preventDefault(); studyNext(); }
      return;
    }
    if(!queue[pos] || pos>=queue.length) return;
    const revealed = qz.classList.contains('revealed');
    if(!revealed && (e.key===' ' || e.key==='Enter')){ e.preventDefault(); reveal(); }
    else if(revealed && (e.key==='1' || e.key==='ArrowLeft')) answer(false);
    else if(revealed && (e.key==='2' || e.key==='ArrowRight')) answer(true);
  });
  refreshBtn();
  renderGoal();
})();
