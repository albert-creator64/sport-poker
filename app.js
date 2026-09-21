CFG.page='index';
const TABS=[
  {btn:0,id:'view-fixture'},
  {btn:1,id:'view-rating'},
  {btn:2,id:'view-profile'}
];
let mePhone=localStorage.getItem('sp_me')||'';

function goTab(i){
  TABS.forEach(t=>{
    document.getElementById(t.id).style.display=t.btn===i?'block':'none';
    document.querySelectorAll('.tabbar button')[t.btn].classList.toggle('on',t.btn===i);
  });
  if(i===0)renderFixture();
  if(i===1)renderRatingAll();
  if(i===2)renderProfile();
  requestAnimationFrame(()=>window.scrollTo(0,0));
}

function visibleTournaments(){
  return (DB.tournaments||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
}

function openTournament(t,now){
  const today=now.slice(0,10);
  if(t.completed)return false;
  if(t.openOwn===false)return false;
  return String(t.open!==false);
}

function tRegCount(t){return (t.queue||[]).length;}
function tStatus(t,now){
  const today=now.slice(0,10);
  if(t.completed)return {cls:'done',label:'Завершён'};
  const open=t.open!==false;
  if(!open)return {cls:'closed',label:'Запись закрыта'};
  return {cls:'open',label:'Запись открыта'};
}

function renderFixture(){
  const now=new Date().toISOString();
  const list=visibleTournaments();
  const container=document.getElementById('fixtureList');
  document.getElementById('clubName').textContent=DB.game.title||'Sport Poker';
  document.getElementById('clubInfo').textContent=DB.game.info||'';
  document.getElementById('clubContact').textContent=DB.game.contact||'Уточните у организатора';

  const upcoming=list.filter(t=>!t.completed);
  if(upcoming.length===0){
    document.getElementById('featKick').textContent='БЛИЖАЙШИЙ ТУРНИР';
    document.getElementById('featName').textContent='Пока нет игр';
    document.getElementById('featStats').innerHTML='<div class="ft-stat"><div class="ft-v acc">скоро</div><div class="ft-l">афиша план</div></div>';
  }else{
    const ft=upcoming[0];
    document.getElementById('featKick').textContent='БЛИЖАЙШИЙ ТУРНИР';
    document.getElementById('featName').textContent=ft.name||'Турнир';
    document.getElementById('featStats').innerHTML=
      `<div class="ft-stat"><div class="ft-v">${fmtDT(ft.date+(ft.time?'T'+ft.time:''))}</div><div class="ft-l">дата</div></div>
       <div class="ft-stat"><div class="ft-v acc">${tRegCount(ft)}</div><div class="ft-l">записано</div></div>
       <div class="ft-stat"><div class="ft-v">${ft.startStack?fmtMoney(ft.startStack):'—'}</div><div class="ft-l">стартовый</div></div>`;
  }

  if(list.length===0){
    container.innerHTML='<div class="empty"><div class="empty-ic">♠️</div><div class="empty-t">Турниров пока нет</div><div class="empty-s">Админ добавит расписание в панели управления</div></div>';
    return;
  }

  container.innerHTML=list.map(t=>{
    const st=tStatus(t,now);
    const reg=mePhone&&findPlayerByPhone(mePhone);
    const meReg=reg&&(t.queue||[]).includes(reg.id);
    const meWait=reg&&(t.wait||[]).includes(reg.id);
    const limit=t.limit&&t.limit>0?t.limit:null;
    const inLimit=limit!==null&&limit>0;
    const full=inLimit&&tRegCount(t)>=limit;

    let btnHtml='';
    const canOpen=t.open!==false&&!t.completed;
    if(t.completed){btnHtml='<span class="chip done-ch">Завершён</span>';}
    else if(meReg){btnHtml=`<button class="btn btn-ghost" onclick="unreg('${t.id}')">Отменить запись</button>`;}
    else if(meWait){btnHtml=`<span class="chip wait-ch">В списке ожидания</span><button class="btn btn-ghost" onclick="unreg('${t.id}')">Отменить</button>`;}
    else if(!canOpen){btnHtml='<span class="chip closed-ch">Запись закрыта</span>';}
    else if(full){btnHtml=`<button class="btn btn-primary" onclick="waitreg('${t.id}')">В лист ожидания</button>`;}
    else {btnHtml=`<button class="btn btn-primary" onclick="reg('${t.id}')">Записаться</button>`;}

    const rebuy=(t.rebuyMax||0)>0?` · ${t.rebuyMax} ре-энтри`:'';
    const cs=(t.cost||0)>0?`${fmtMoney(t.cost)}${rebuy}`:'бесплатно';

    return `<div class="t-tile tcard${meReg?' is-live':''}">
      <div class="tourn-head">
        <span class="tourn-name">${esc(t.name||'Турнир')}</span>
        <span class="chip ${st.cls}-ch">${st.label}</span>
      </div>
      <div class="tourn-meta">
        <span>📅 ${fmtDT(t.date+(t.time?'T'+t.time:''))}</span>
        <span>👥 ${tRegCount(t)}${inLimit?' / '+t.limit:''} записано</span>
        <span>💰 ${cs}</span>
      </div>
      ${t.blinds&&t.blinds.length?`<div class="tourn-blind">Блайнды: ${esc(t.blinds.map(b=>'${b.sb}/${b.bb}'+(b.ante?'+'+b.ante:'')).join(' → '))} · ${t.levelMin} мин</div>`:''}
      ${t.note?`<div class="tourn-note">${esc(t.note)}</div>`:''}
      <div class="tile-cta">${btnHtml}</div>
    </div>`;
  }).join('');
}

async function reg(id,asWait){
  const t=(DB.tournaments||[]).find(x=>x.id===id);
  if(!t||t.completed||t.open===false)return alert('Запись на этот турнир закрыта');
  if(mePhone){
    const p=findPlayerByPhone(mePhone);
    if(p){
      const limit=t.limit&&t.limit>0?t.limit:null;
      if(limit&&tRegCount(t)>=limit&&!asWait){addToQueue(t,p,true);return;}
      addToQueue(t,p,false);
      return;
    }
  }
  openRegModal(id,asWait);
}

async function addToQueue(t,p,asWait){
  if(!t.queue)t.queue=[];if(!t.wait)t.wait=[];
  if(asWait){
    if(t.wait.includes(p.id))return renderFixture();
    t.wait.push(p.id);
    t.queue=(t.queue||[]).filter(x=>x!==p.id);
    await saveDB();
    renderFixture();
    return alert('Вы в списке ожидания. Освободится место — вас запишут.');
  }
  if(t.queue.includes(p.id))return renderFixture();
  t.queue.push(p.id);
  t.wait=(t.wait||[]).filter(x=>x!==p.id);
  await saveDB();
  renderFixture();
  alert('Вы записаны на турнир!');
}

function openRegModal(id,asWait){
  const t=(DB.tournaments||[]).find(x=>x.id===id);
  const div=document.createElement('div');
  div.className='modal';
  div.innerHTML=`<div class="modal-box">
    <div class="modal-close" onclick="closeModal(this)">✕</div>
    <div class="modal-title">${asWait?'Лист ожидания':'Запись на турнир'} · ${esc(t?t.name:'')}</div>
    <div class="f-cell"><label>Ваше имя</label><input type="text" id="rName" placeholder="Иван" maxlength="40"></div>
    <div class="f-cell" style="margin-top:12px"><label>Номер телефона</label><input type="tel" id="rPhone" placeholder="+7 (900) 000-00-00" inputmode="tel"></div>
    <div id="rMsg"></div>
    <div class="tile-cta"><button class="btn btn-primary" onclick="submitReg('${id}',${asWait})">Записаться</button></div>
    <div class="hint-note" style="margin-top:12px">Если вы уже играли у нас — введите тот же телефон, он привяжет к вашему профилю и истории.</div>
  </div>`;
  document.body.appendChild(div);
  setTimeout(()=>{const el=document.getElementById('rName');if(el)el.focus();},50);
}

function existsSelf(){
  return !!(mePhone&&findPlayerByPhone(mePhone));
}

function closeModal(btn){
  const m=btn.closest('.modal');if(m)m.remove();
}

async function submitReg(id,asWait){
  const name=document.getElementById('rName').value.trim();
  const phone=normPhone(document.getElementById('rPhone').value);
  const msgEl=document.getElementById('rMsg');
  msgEl.className='';msgEl.textContent='';
  if(name.length<2){msgEl.className='err';msgEl.textContent='Укажите имя (минимум 2 буквы)';return;}
  if(!/^7\d{10}$/.test(phone)){msgEl.className='err';msgEl.textContent='Укажите корректный телефон: начинается с +7';return;}
  const t=(DB.tournaments||[]).find(x=>x.id===id);
  if(!t||t.completed||t.open===false){msgEl.className='err';msgEl.textContent='Запись закрыта';return;}
  let p=findPlayerByPhone(phone);
  const existed=!!p;
  if(!p){
    p={id:Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:name,phone:phone,t:new Date().toISOString()};
    DB.players.push(p);
  }
  // фиксируем профиль
  mePhone=phone;
  localStorage.setItem('sp_me',phone);
  addToQueue(t,p,asWait).then(()=>{closeModal(document.querySelector('.modal-box .modal-close'));});
}

async function waitreg(id){
  reg(id,true);
}

async function unreg(id){
  if(!mePhone)return;
  const t=(DB.tournaments||[]).find(x=>x.id===id);
  const p=findPlayerByPhone(mePhone);
  if(!t||!p)return;
  t.queue=(t.queue||[]).filter(x=>x!==p.id);
  t.wait=(t.wait||[]).filter(x=>x!==p.id);
  await saveDB();
  renderFixture();
}

function renderRatingAll(){
  renderRatingTable();
  renderTourns();
}

function renderRatingTable(){
  const box=document.getElementById('ratingTable');
  const rows=ratingRows();
  if(rows.length===0){
    box.innerHTML='<div class="empty"><div class="empty-ic">🏆</div><div class="empty-t">Рейтинг пока пуст</div><div class="empty-s">Появится после первых игр</div></div>';
    return;
  }
  box.innerHTML=rows.map((r,i)=>{
    const top=i===0?'top1':i===1?'top2':i===2?'top3':'';
    const mine=r.name&&mePhone&&findPlayerByPhone(mePhone)&&r.name===findPlayerByPhone(mePhone).name?' is-me':'';
    return `<div class="rating-row ${top}${mine}">
      <div class="rat-rank">${i+1}</div>
      <div class="rat-main"><div class="rat-name">${esc(r.name)}</div>
      <div class="rat-sub">игр: ${r.games} · побед: ${r.wins} · топ-3: ${r.top3}${r.best?' · лучшее: '+r.best+' место':''}</div></div>
      <div class="rat-pts">${r.pts}</div>
    </div>`;
  }).join('');
}

function renderTourns(){
  const box=document.getElementById('tournamentList');
  const list=visibleTournaments().slice().reverse();
  if(list.length===0){
    box.innerHTML='<div class="tourn-row"><div class="tourn-empty">Турниров ещё не было</div></div>';
    return;
  }
  const medals=['','🥇','🥈','🥉'];
  box.innerHTML=list.map(t=>{
    const res=t.results||[];
    const rows=res.slice().sort((a,b)=>a.place-b.place).map(r=>{
      const points=r.points!=null?r.points:pts(r.place,t.totalPlayers||(t.queue||[]).length||1);
      return `<div class="tourn-place"><span class="tp-pos">${r.place<=3?medals[r.place]:r.place}</span>
        <span class="tp-name">${esc(playerName(r.playerId))}</span><span class="tp-pts">${points}</span></div>`;
    }).join('');
    return `<div class="tourn-row">
      <div class="tourn-head"><span class="tourn-name">${esc(t.name)}</span>
      <span class="tourn-parts">${t.totalPlayers||tRegCount(t)} уч.</span></div>
      <div class="tourn-date">${fmtDT(t.date+(t.time?'T'+t.time:''))}</div>
      ${rows||'<div class="tourn-empty">Результаты не внесены</div>'}
    </div>`;
  }).join('');
}

function renderProfile(){
  const body=document.getElementById('profileBody');
  if(!mePhone){
    body.innerHTML=`<div class="t-tile">
      <div class="sec-title" style="margin:0 0 12px">Вход по номеру</div>
      <div class="f-cell"><label>Ваш номер телефона</label><input type="tel" id="mePhone" placeholder="+7 (900) 000-00-00"></div>
      <div class="tile-cta"><button class="btn btn-primary" onclick="login()">Войти в профиль</button></div>
      <div class="hint-note">Профиль создаётся автоматически при записи на турнир. Если вы ещё не записаны, сначала зарегистрируйтесь в разделе «Афиша» — для этого достаточно одного имени.</div>
    </div>`;
    return;
  }
  const p=findPlayerByPhone(mePhone);
  if(!p){
    body.innerHTML=`<div class="t-tile"><div class="empty" style="border:none"><div class="empty-ic">🙍</div>
      <div class="empty-t">Профиль не найден</div>
      <div class="empty-s">Сначала запишитесь на турнир в «Афише»</div></div>
      <div class="tile-cta"><button class="btn btn-ghost" onclick="logout()">Сменить номер</button></div></div>`;
    return;
  }
  const rg=ratingRows();
  const me=rg.find(r=>r.name===p.name);
  const games=playerGames(p.id);
  let hist='';
  if(games.length===0){
    hist='<div class="tourn-empty">Вы пока не сыграли ни одного турнира</div>';
  }else{
    hist=games.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(g=>{
      const medals=['','🥇','🥈','🥉'];
      return `<div class="tourn-place"><span class="tp-pos">${g.place<=3?medals[g.place]:g.place}</span>
        <span class="tp-name">${esc(g.name)}</span><span class="tp-pts">${g.pts}</span></div>`;
    }).join('');
  }
  body.innerHTML=`<div class="t-tile prof-card">
      <div class="prof-avatar">${esc(p.name.charAt(0)||'?').toUpperCase()}</div>
      <div class="prof-meta">
        <div class="prof-name">${esc(p.name)}</div>
        <div class="prof-phone">${prettyPhone(p.phone)}</div>
      </div>
    </div>
    <div class="t-tile">
      <div class="param-grid">
        <div class="param-box"><span class="param-val">${me?me.pts:0}</span><span class="param-label">очков</span></div>
        <div class="param-box"><span class="param-val">${rg.findIndex(r=>r.name===p.name)+1||'—'}</span><span class="param-label">место</span></div>
        <div class="param-box"><span class="param-val">${(me&&me.games)||0}</span><span class="param-label">игр</span></div>
        <div class="param-box"><span class="param-val">${(me&&me.wins)||0}</span><span class="param-label">побед</span></div>
      </div>
    </div>
    <div class="sec-title">Мои турниры</div>
    <div class="t-tile">${hist}</div>
    <div class="tile-cta"><button class="btn btn-ghost" onclick="logout()">Выйти</button></div>`;
}

function login(){
  const inp=document.getElementById('mePhone');
  const phone=normPhone(inp.value);
  if(!/^7\d{10}$/.test(phone))return alert('Укажите корректный номер телефона');
  mePhone=phone;
  localStorage.setItem('sp_me',phone);
  renderProfile();
}

function logout(){
  mePhone='';
  localStorage.removeItem('sp_me');
  renderProfile();
}

function fmtDTcompact(iso){
  if(!iso)return '—';
  const d=new Date(iso+'T00:00:00');
  if(isNaN(d))return iso.slice(0,10);
  const dd=String(d.getDate()).padStart(2,'0')+'.'+String(d.getMonth()+1).padStart(2,'0');
  return dd+(iso.slice(11,16)?' '+iso.slice(11,16):'');
}

document.getElementById('view-profile').addEventListener('click',e=>{
  if(e.target.id==='mePhone')setTimeout(()=>{const t=document.getElementById('mePhone');if(t)t.focus();},50);
});

document.addEventListener('DOMContentLoaded',()=>{
  loadDB().then(()=>{
    renderFixture();
    renderRatingTable();
    renderTourns();
    renderProfile();
  }).catch(()=>{});
});