CFG.page='admin';
let curTour='';
const TABSB=[
  {btn:0,id:'view-cash'},
  {btn:1,id:'view-tourns'},
  {btn:2,id:'view-players'},
  {btn:3,id:'view-anal'}
];

function goTab(i){
  TABSB.forEach(t=>{
    document.getElementById(t.id).style.display=t.btn===i?'block':'none';
    document.querySelectorAll('#adminBody .tabbar button')[t.btn].classList.toggle('on',t.btn===i);
  });
  if(i===0)renderCash();
  if(i===1)renderTournList();
  if(i===2)renderPlayersBase();
  if(i===3)renderAnalytics();
  requestAnimationFrame(()=>window.scrollTo(0,0));
}

function gateLogin(){
  const pin=document.getElementById('gatePin').value.trim();
  if(pin!==CFG.pin){document.getElementById('gatePin').value='';return alert('Неверный пин-код');}
  document.getElementById('loginGate').style.display='none';
  document.getElementById('adminBody').style.display='block';
  renderCash();
  renderTournList();
  renderPlayersBase();
  renderAnalytics();
}

function fmtMoneyR(n){return new Intl.NumberFormat('ru-RU').format(Math.round(n||0))+' ₽';}
function tRegCount(t){return (t.queue||[]).length;}

/* ---------- Касса ---------- */
function renderCash(){
  const ts=(DB.tournaments||[]).slice().filter(t=>!t.completed).sort((a,b)=>(a.date||'').localeCompare(b.date||'')||(a.time||'').localeCompare(b.time||''));
  const box=document.getElementById('cashSelect');
  const panel=document.getElementById('cashPanel');
  document.getElementById('cashSub').textContent=curTour?tourName(curTour):'выберите турнир';

  if(ts.length===0){
    box.innerHTML='<div class="empty"><div class="empty-ic">💰</div><div class="empty-t">Нет активных турниров</div><div class="empty-s">Создайте турнир во вкладке «Турниры»</div></div>';
    panel.innerHTML='';
    return;
  }
  box.innerHTML=ts.map(t=>{
    const sel=t.id===curTour?' is-live':'';
    return `<div class="t-sec ${sel}" onclick="chooseTour('${t.id}')">
      <div class="t-sec-name">${esc(t.name||'Турнир')}</div>
      <div class="t-sec-sub">${fmtDT(t.date+(t.time?'T'+t.time:''))} · записано ${tRegCount(t)}</div>
    </div>`;
  }).join('');

  const t=ts.find(x=>x.id===curTour);
  if(!t){panel.innerHTML='<div class="t-tile"><div class="row-title">Касса</div><div class="info-text">Выберите турнир выше.</div></div>';return;}
  renderCashPanel(t);
}

function tourName(id){
  const t=(DB.tournaments||[]).find(x=>x.id===id);
  return t?t.name||'Турнир':'—';
}

function chooseTour(id){curTour=id;renderCash();}

function renderCashPanel(t){
  const panel=document.getElementById('cashPanel');
  const q=t.queue||[];
  const w=t.wait||[];
  const ev=t.events||[];
  const cost=t.cost||0;
  const paidEv=ev.filter(e=>e.paid).length;
  const unpaidEv=ev.length-paidEv;
  const revenue=paidEv*cost;
  const debt=unpaidEv*cost;
  const entered=new Set(ev.filter(e=>e.type==='entry').map(e=>e.playerId)).size;

  const rows=q.map(pid=>{
    const p=ev.filter(e=>e.playerId===pid);
    const entries=p.filter(e=>e.type==='entry').length;
    const rebuys=p.filter(e=>e.type==='rebuy').length;
    const addons=p.filter(e=>e.type==='addon').length;
    const paid=p.filter(e=>e.paid).length;
    const total=p.length;
    const myDebt=(total-paid)*cost;
    const myPaid=paid*cost;
    const status=total>0&&paid===total?'pay-ch':total===0?'none-ch':'npay-ch';
    const statusTxt=total===0?'нет входов':paid===total?'оплачено':myDebt+' ₽ долг';
    return `<div class="c-row">
      <div class="c-name">${esc(playerName(pid))}</div>
      <div class="c-ctrl">
        <span class="btn-mini" onclick="addEv('${t.id}','${pid}','entry')">+ вход</span>
        <span class="btn-mini" onclick="addEv('${t.id}','${pid}','rebuy')">+ ре-энтри</span>
        <span class="btn-mini" onclick="addEv('${t.id}','${pid}','addon')">+ аддон</span>
        <span class="btn-mini rev" onclick="undoEv('${t.id}','${pid}')">↩ убрать</span>
      </div>
      <div class="c-line">
        <span class="chip ${status}" onclick="togglePaid('${t.id}','${pid}')">${statusTxt}</span>
        <span class="c-stats">вход×${entries} · ре×${rebuys} · аддон×${addons} · ${fmtMoneyR(myPaid)}</span>
      </div>
    </div>`;
  }).join('');

  const wlist=w.length?`<div class="c-wait">Лист ожидания: ${w.map(id=>esc(playerName(id))).join(', ')}</div>`:'';

  panel.innerHTML=`
    <div class="t-tile">
      <div class="tourn-head"><span class="tourn-name">${esc(t.name||'Турнир')}</span>
        <span class="chip ${t.open===false?'closed-ch':'open-ch'}">запись ${t.open===false?'закрыта':'открыта'}</span></div>
      <div class="c-summary">
        <div class="c-sum-box"><div class="c-sum-v">${entered}</div><div class="c-sum-l">в игре</div></div>
        <div class="c-sum-box"><div class="c-sum-v ok">${fmtMoneyR(revenue)}</div><div class="c-sum-l">касса</div></div>
        <div class="c-sum-box"><div class="c-sum-v ${debt?'bad':''}">${fmtMoneyR(debt)}</div><div class="c-sum-l">долги</div></div>
      </div>
      <div class="c-actions">
        <button class="btn btn-ghost" onclick="toggleOpen('${t.id}')">${t.open===false?'Открыть запись':'Закрыть запись'}</button>
        <button class="btn btn-danger" onclick="finishTourn('${t.id}')">Завершить турнир</button>
      </div>
      ${wlist}
    </div>
    <div class="sec-title">Входы игроков <span class="hint">тап «+» отмечает действие, тап по статусу — оплату</span></div>
    <div class="t-tile">${rows||'<div class="tourn-empty">Никто не записан</div>'}</div>`;
}

async function addEv(tid,pid,type){
  const t=(DB.tournaments||[]).find(x=>x.id===tid);
  if(!t)return;
  if(!t.events)t.events=[];
  t.events.push({playerId:pid,type:type,paid:false,ts:new Date().toISOString()});
  await saveDB();
  renderCash();
}

async function undoEv(tid,pid){
  const t=(DB.tournaments||[]).find(x=>x.id===tid);
  if(!t)return;
  const evs=t.events||[];
  for(let i=evs.length-1;i>=0;i--){
    if(evs[i].playerId===pid){evs.splice(i,1);break;}
  }
  await saveDB();
  renderCash();
}

async function togglePaid(tid,pid){
  const t=(DB.tournaments||[]).find(x=>x.id===tid);
  if(!t)return;
  const mine=(t.events||[]).filter(e=>e.playerId===pid);
  if(mine.length===0)return alert('Сначала отметьте вход игроку');
  const allPaid=mine.every(e=>e.paid);
  mine.forEach(e=>e.paid=!allPaid);
  await saveDB();
  renderCash();
}

async function toggleOpen(tid){
  const t=(DB.tournaments||[]).find(x=>x.id===tid);
  if(!t)return;
  t.open=!(t.open===false);
  await saveDB();
  renderCash();
  renderTournList();
}

async function finishTourn(tid){
  const t=(DB.tournaments||[]).find(x=>x.id===tid);
  if(!t)return;
  if(!confirm('Завершить турнир «'+t.name+'»? Запись закроется, касса сохранится.'))return;
  t.completed=true;
  t.totalPlayers=tRegCount(t)||t.totalPlayers||0;
  await saveDB();
  curTour='';
  renderCash();
  renderTournList();
}

/* ---------- Турниры ---------- */
function defaultDate(){
  const d=new Date();
  return d.toISOString().slice(0,10);
}

async function addTourn(){
  const name=document.getElementById('nName').value.trim();
  if(!name)return alert('Укажите название');
  const n={
    id:Date.now().toString(36),
    name:name,
    date:document.getElementById('nDate').value||defaultDate(),
    time:document.getElementById('nTime').value||'19:40',
    cost:parseFloat(document.getElementById('nCost').value)||0,
    limit:parseInt(document.getElementById('nLimit').value)||0,
    startStack:parseInt(document.getElementById('nStart').value)||0,
    levelMin:parseInt(document.getElementById('nMin').value)||10,
    blinds:parseBlinds(document.getElementById('nBlinds').value),
    note:document.getElementById('nNote').value.trim(),
    open:true,queue:[],wait:[],events:[],results:[],completed:false,totalPlayers:0
  };
  DB.tournaments.push(n);
  await saveDB();
  ['nName','nCost','nLimit','nStart','nMin','nBlinds','nNote'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.value='';
  });
  renderTournList();
  alert('Турнир создан');
}

function parseBlinds(str){
  if(!str)return [];
  return String(str||'').split('→').map(s=>s.trim()).filter(Boolean).map(pair=>{
    const m=pair.match(/^(\d+)\/(\d+)(?:\s+(\d+))?$/);
    if(!m)return null;
    return {sb:+m[1],bb:+m[2],ante:m[3]?+m[3]:0};
  }).filter(Boolean);
}

function renderTournList(){
  const box=document.getElementById('tournList');
  const list=(DB.tournaments||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||''));
  if(list.length===0){
    box.innerHTML='<div class="t-tile"><div class="tourn-empty">Турниры ещё не созданы</div></div>';
    return;
  }
  box.innerHTML=list.map(t=>{
    const st=t.completed?'Завершён':t.open===false?'Запись закрыта':'Запись открыта';
    const bl=(t.blinds&&t.blinds.length)?esc(t.blinds.map(b=>b.sb+'/'+b.bb+(b.ante?'+'+b.ante:'')).join(' → '))+' · '+t.levelMin+' мин':'—';
    const res=t.results||[];
    const resHtml=res.length?res.slice().sort((a,b)=>a.place-b.place).map(r=>{
      const pr=r.points!=null?r.points:pts(r.place,t.totalPlayers||tRegCount(t)||1);
      const medals=['','🥇','🥈','🥉'];
      return `<div class="tourn-place"><span class="tp-pos">${r.place<=3?medals[r.place]:r.place}</span>
        <span class="tp-name">${esc(playerName(r.playerId))}</span><span class="tp-pts">${pr}</span></div>`;
    }).join(''):'<div class="tourn-empty">Результаты не внесены</div>';
    return `<div class="t-tile">
      <div class="tourn-head"><span class="tourn-name">${esc(t.name)}</span>
        <span class="chip ${t.completed?'done-ch':t.open===false?'closed-ch':'open-ch'}">${st}</span></div>
      <div class="tourn-meta"><span>📅 ${fmtDT(t.date+(t.time?'T'+t.time:''))}</span>
        <span>👥 ${tRegCount(t)}${(t.limit||0)>0?'/'+t.limit:''} записано</span>
        <span>💰 ${t.cost?fmtMoneyR(t.cost):'бесплатно'}</span></div>
      <div class="tourn-meta">🃏 ${bl}</div>
      ${t.note?`<div class="tourn-note">${esc(t.note)}</div>`:''}
      <div class="c-actions">
        <button class="btn btn-ghost" onclick="copyTourn('${t.id}')">Дублировать</button>
        ${t.completed?'':`<button class="btn btn-primary" onclick="setResFull('${t.id}')">Внести результаты</button>`}
        <button class="btn btn-ghost" onclick="removeTourn('${t.id}')">Удалить</button>
      </div>
      <div class="sec-title" style="margin-top:12px">Результаты</div>
      ${resHtml}
    </div>`;
  }).join('');
}

async function copyTourn(id){
  const t=(DB.tournaments||[]).find(x=>x.id===id);
  if(!t)return;
  const doCopy=()=>{
    const c=JSON.parse(JSON.stringify(t));
    c.id=Date.now().toString(36)+'x';
    c.name=(c.name||'Турнир')+' (копия)';
    c.open=true;c.queue=[];c.wait=[];c.events=[];c.results=[];c.completed=false;c.totalPlayers=0;
    const d=new Date();
    c.date=d.toISOString().slice(0,10);
    DB.tournaments.push(c);
    return c;
  };
  // загрузить свежую базу, чтобы не затереть параллельные изменения
  await loadDB(true);
  const freshT=(DB.tournaments||[]).find(x=>x.id===id);
  if(!freshT)return alert('Турнир не найден');
  const t2=JSON.parse(JSON.stringify(freshT));
  t2.id=Date.now().toString(36)+'x';
  t2.name=(t2.name||'Турнир')+' (копия)';
  t2.open=true;t2.queue=[];t2.wait=[];t2.events=[];t2.results=[];t2.completed=false;t2.totalPlayers=0;
  t2.date=new Date().toISOString().slice(0,10);
  DB.tournaments.push(t2);
  await saveDB();
  renderTournList();
}

async function removeTourn(id){
  if(!confirm('Удалить турнир полностью?'))return;
  await loadDB(true);
  DB.tournaments=DB.tournaments.filter(t=>t.id!==id);
  await saveDB();
  if(curTour===id)curTour='';
  renderTournList();
  renderCash();
}

function setResFull(tid){
  setResWorkflow(tid);
}

async function setResWorkflow(tid){
  const t=(DB.tournaments||[]).find(x=>x.id===tid);
  if(!t)return alert('Турнир не найден');
  const q=(t.queue||[]).filter(pid=>pid);
  if(q.length===0)return alert('Нет записанных игроков');
  const r=await promptRes(t,q);
  if(!r)return;
  const res=[];
  if(r.p1)res.push({playerId:r.p1,place:1});
  if(r.p2)res.push({playerId:r.p2,place:2});
  if(r.p3)res.push({playerId:r.p3,place:3});
  const seen=new Set(res.map(x=>x.playerId));
  if(seen.size!==res.length)return alert('Игрок не может занимать два места');
  await loadDB(true);
  const fresh=(DB.tournaments||[]).find(x=>x.id===tid);
  if(!fresh)return alert('Турнир не найден');
  fresh.results=res;
  fresh.completed=true;
  fresh.totalPlayers=q.length;
  await saveDB();
  renderTournList();
  if(curTour===tid){renderCash();}
  alert('Результаты сохранены. Рейтинг обновлён.');
}

function promptRes(t,q){
  const opts=q.map(pid=>`<option value="${pid}">${esc(playerName(pid))}</option>`).join('');
  const old=t.results||[];
  const sel=place=>{const f=old.find(r=>r.place===place);return f?f.playerId:'';};
  const div=document.createElement('div');
  div.className='modal';
  div.innerHTML=`<div class="modal-box">
    <div class="modal-title">Результаты · ${esc(t.name)}</div>
    <div class="f-cell"><label>1 место</label><select id="m1"><option value="">—</option>${opts}</select></div>
    <div class="f-cell"><label>2 место</label><select id="m2"><option value="">—</option>${opts}</select></div>
    <div class="f-cell"><label>3 место</label><select id="m3"><option value="">—</option>${opts}</select></div>
    <div class="tile-cta"><button class="btn btn-primary" id="mOk">Сохранить</button></div>
    <div class="tile-cta" style="margin-top:8px"><button class="btn btn-ghost" id="mNo">Отмена</button></div>
  </div>`;
  document.body.appendChild(div);
  return new Promise(resolve=>{
    div.querySelector('#m1').value=sel(1);
    div.querySelector('#m2').value=sel(2);
    div.querySelector('#m3').value=sel(3);
    div.querySelector('#mNo').onclick=()=>{div.remove();resolve(null);};
    div.querySelector('#mOk').onclick=()=>{
      const r={p1:div.querySelector('#m1').value,p2:div.querySelector('#m2').value,p3:div.querySelector('#m3').value};
      div.remove();resolve(r);
    };
  });
}

/* ---------- Игроки ---------- */
async function addPlayerMan(){
  const name=document.getElementById('pName').value.trim();
  const phone=normPhone(document.getElementById('pPhone').value);
  if(name.length<2)return alert('Укажите имя');
  if(!/^7\d{10}$/.test(phone))return alert('Корректный телефон');
  if(findPlayerByPhone(phone))return alert('Игрок с таким телефоном уже есть');
  DB.players.push({id:Date.now().toString(36),name:name,phone:phone,t:new Date().toISOString()});
  await saveDB();
  document.getElementById('pName').value='';
  document.getElementById('pPhone').value='';
  renderPlayersBase();
}

function renderPlayersBase(){
  const box=document.getElementById('playersBase');
  document.getElementById('plSub').textContent=(DB.players||[]).length+' в базе';
  const list=(DB.players||[]).slice().sort((a,b)=>(a.t||'').localeCompare(b.t||''));
  if(list.length===0){
    box.innerHTML='<div class="t-tile"><div class="tourn-empty">База пока пуста</div></div>';
    return;
  }
  box.innerHTML=list.map(p=>`<div class="t-tile p-item">
    <div class="p-main">
      <div class="p-name" style="font-size:15px">${esc(p.name)}</div>
      <div class="p-phone">${prettyPhone(p.phone)}</div>
    </div>
    <button class="p-del" onclick="removePlayerById('${p.id}')">✕</button>
  </div>`).join('');
}

async function removePlayerById(id){
  if(!confirm('Удалить игрока из базы?'))return;
  DB.players=DB.players.filter(x=>x.id!==id);
  await saveDB();
  renderPlayersBase();
}

/* ---------- Аналитика ---------- */
function renderAnalytics(){
  const box=document.getElementById('analBody');
  const ts=DB.tournaments||[];
  let totalPaid=0,totalDebt=0;
  const uniq=new Set();
  ts.forEach(t=>{
    const ev=t.events||[];
    totalPaid+=ev.filter(e=>e.paid).length*(t.cost||0);
    totalDebt+=ev.filter(e=>!e.paid).length*(t.cost||0);
    ev.forEach(e=>uniq.add(e.playerId));
    (t.queue||[]).forEach(pid=>uniq.add(pid));
  });
  const perT=ts.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.time||'').localeCompare(a.time||'')).map(t=>{
    const ev=t.events||[];
    const rev=ev.filter(e=>e.paid).length*(t.cost||0);
    const debt=ev.filter(e=>!e.paid).length*(t.cost||0);
    const played=new Set(ev.filter(e=>e.type==='entry').map(e=>e.playerId)).size;
    const pct=(t.limit&&t.limit>0)?Math.round(played/t.limit*100):null;
    return {t,reg:tRegCount(t),played,rev,debt,pct};
  });
  box.innerHTML=`
    <div class="t-tile">
      <div class="param-grid">
        <div class="param-box"><span class="param-val">${ts.length}</span><span class="param-label">турниров</span></div>
        <div class="param-box"><span class="param-val">${uniq.size}</span><span class="param-label">игроков</span></div>
        <div class="param-box"><span class="param-val">${fmtMoneyR(totalPaid)}</span><span class="param-label">касса</span></div>
        <div class="param-box"><span class="param-val ${totalDebt?'bad':''}">${fmtMoneyR(totalDebt)}</span><span class="param-label">долги</span></div>
      </div>
    </div>
    <div class="sec-title">По турнирам</div>
    ${perT.map(x=>{
      const fill=x.pct!==null?Math.min(100,x.pct):0;
      return `<div class="t-tile">
        <div class="tourn-head"><span class="tourn-name">${esc(x.t.name)}</span>
          <span class="tourn-parts">${x.reg} зап. · ${x.played} в игре</span></div>
        <div class="step-bar" style="margin:10px 0 6px"><div class="step-bar-fill" style="width:${fill}%"></div></div>
        ${x.pct!==null?`<div class="step-note">Заполняемость лимита: ${x.pct}%</div>`:''}
        <div class="tourn-meta">
          <span class="ok">Касса ${fmtMoneyR(x.rev)}</span>
          <span class="${x.debt?'bad':''}">Долг ${fmtMoneyR(x.debt)}</span>
          <span>${fmtDT(x.t.date+(x.t.time?'T'+x.t.time:''))}</span>
        </div>
      </div>`;
    }).join('')}
    <div class="sec-title">Топ рейтинга</div>
    <div id="anaRating"></div>`;
  const rr=ratingRows().slice(0,5).map((r,i)=>`<div class="rating-row ${i===0?'top1':i===1?'top2':i===2?'top3':''}">
    <div class="rat-rank">${i+1}</div>
    <div class="rat-main"><div class="rat-name">${esc(r.name)}</div>
    <div class="rat-sub">игр: ${r.games} · побед: ${r.wins}</div></div>
    <div class="rat-pts">${r.pts}</div>
  </div>`).join('');
  document.getElementById('anaRating').innerHTML=rr||'<div class="t-tile"><div class="tourn-empty">Нет данных</div></div>';
}

document.addEventListener('DOMContentLoaded',()=>{
  loadDB().then(()=>{
    document.getElementById('nDate').value=defaultDate();
  }).catch(()=>{});
  document.getElementById('gatePin').addEventListener('keydown',e=>{if(e.key==='Enter')gateLogin();});
});