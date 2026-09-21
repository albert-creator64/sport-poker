const CFG={
  owner:'albert-creator64',
  repo:'sport-poker',
  path:'data/db.json',
  tokenB:'ghp_',
  tokenA:'lQcJqVSfk7kbpdDArjZxsNrIa2mrvA24IVFP',
  pin:'1234'
};
const api=`https://api.github.com/repos/${CFG.owner}/${CFG.repo}/contents/${CFG.path}`;

let DB=null,DBsha=null,saving=false,unlocked=false;

const TABS=[
  {btn:0,id:'view-sign'},
  {btn:1,id:'view-players'},
  {btn:2,id:'view-rating'},
  {btn:3,id:'view-info'}
];

function hdr(){return{Authorization:'token '+CFG.tokenB+CFG.tokenA,'Accept':'application/vnd.github+json'};}

function goTab(i){
  TABS.forEach(t=>{
    document.getElementById(t.id).style.display=t.btn===i?'block':'none';
    document.querySelectorAll('.tabbar button')[t.btn].classList.toggle('on',t.btn===i);
  });
  if(i===1)renderPlayers();
  if(i===0)updateHero();
  if(i===2){renderRating();renderTournaments();}
  requestAnimationFrame(()=>window.scrollTo(0,0));
}

async function loadDB(){
  const r=await fetch(api,{headers:hdr()});
  if(r.ok){
    const j=await r.json();
    DBsha=j.sha;
    try{DB=JSON.parse(decodeURIComponent(escape(atob(j.content))));}catch(e){DB=null;}
  }else if(r.status===404){
    DB=emptyDB();
  }else{
    throw new Error('load failed '+r.status);
  }
  if(!DB)DB=emptyDB();
  if(!DB.game)DB.game={};
  if(!Array.isArray(DB.players))DB.players=[];
  if(!Array.isArray(DB.tournaments))DB.tournaments=[];
  return DB;
}

function emptyDB(){
  return {game:{title:'Спорт покер',open:true,date:'',place:'',info:'Спортивная игра по турнирным правилам. Время и место уточняются в клубе.',contact:''},players:[],tournaments:[]};
}

async function saveDB(){
  if(saving)return;
  saving=true;
  const body={
    message:'update db '+new Date().toISOString(),
    content:btoa(unescape(encodeURIComponent(JSON.stringify(DB,null,2))))
  };
  if(DBsha)body.sha=DBsha;
  const r=await fetch(api,{method:'PUT',headers:hdr(),body:JSON.stringify(body)});
  saving=false;
  if(!r.ok)throw new Error('save failed '+r.status);
  const j=await r.json();
  DBsha=j.content.sha;
}

function msg(t,text){const el=document.getElementById('formMsg');el.className=t;el.textContent=text;}

function normalizePhone(v){
  let d=v.replace(/\D/g,'');
  if(d.length===11&&d[0]==='8')d='7'+d.slice(1);
  if(d.length===10)d='7'+d;
  return d;
}

function prettyPhone(raw){
  let d=raw.replace(/\D/g,'');
  if(d.length===10)d='7'+d;
  if(d.length===11&&d[0]==='8')d='7'+d.slice(1);
  if(d.length!==11||d[0]!=='7')return raw;
  return '+7 ('+d.slice(1,4)+') '+d.slice(4,7)+'-'+d.slice(7,9)+'-'+d.slice(9);
}

async function register(){
  const name=document.getElementById('inName').value.trim();
  const phoneRaw=document.getElementById('inPhone').value.trim();
  const phone=normalizePhone(phoneRaw);
  msg('','');
  if(name.length<2)return msg('err','Укажите имя (минимум 2 символа)');
  if(!/^7\d{10}$/.test(phone))return msg('err','Укажите корректный номер телефона');
  const btn=document.querySelector('#signForm .btn-primary');
  btn.disabled=true;
  try{
    await loadDB();
    if(!DB.game.open)return msg('err','Запись закрыта');
    const dup=DB.players.find(p=>p.phone===phone);
    if(dup)return msg('err','Этот номер уже записан ('+dup.name+')');
    DB.players.push({
      id:Date.now().toString(36),
      name:name,
      phone:phone,
      rebuy:0,
      stack:0,
      t:new Date().toISOString()
    });
    await saveDB();
    document.getElementById('signForm').style.display='none';
    document.getElementById('signDone').style.display='block';
    updateHero();
  }catch(e){
    msg('err','Ошибка сети. Попробуйте ещё раз.');
  }finally{
    btn.disabled=false;
  }
}

function resetForm(){
  document.getElementById('inName').value='';
  document.getElementById('inPhone').value='';
  document.getElementById('formMsg').textContent='';
  document.getElementById('formMsg').className='';
  document.getElementById('signForm').style.display='block';
  document.getElementById('signDone').style.display='none';
}

function updateHero(){
  document.getElementById('gameTitle').textContent=DB&&DB.game&&DB.game.title?DB.game.title:'Спорт покер';
  document.getElementById('ftStatus').textContent=DB&&DB.game&&DB.game.open?'открыта':'закрыта';
  document.getElementById('ftCount').textContent=DB&&DB.players?DB.players.length:0;
  const info=DB&&DB.game&&DB.game.info?DB.game.info:'Спортивная игра по турнирным правилам. Время и место уточняются в клубе.';
  document.getElementById('gameInfo').textContent=info;
  if(DB&&DB.game){
    document.getElementById('infoRules').textContent=DB.game.info||'';
    document.getElementById('infoContact').textContent=DB.game.contact||'Уточните у организатора клуба';
  }
}

function playerName(id){
  const p=(DB.players||[]).find(x=>x.id===id);
  return p?p.name:'—';
}

async function renderPlayers(){
  const list=document.getElementById('playersList');
  const count=document.getElementById('plCount');
  try{
    await loadDB();
  }catch(e){}
  count.textContent=DB.players.length;
  updateHero();
  if(DB.players.length===0){
    list.innerHTML='<div class="empty"><div class="empty-ic">♠️</div><div class="empty-t">Пока никто не записан</div><div class="empty-s">Поделитесь ссылкой — игроки запишутся через форму</div></div>';
    return;
  }
  list.innerHTML=DB.players.slice().sort((a,b)=>(a.t||'').localeCompare(b.t||'')||(a.id||'').localeCompare(b.id||'')).map((p,i)=>{
    const del=unlocked?`<button class="p-del" onclick="removePlayer('${p.id}')">✕</button>`:'';
    return `<div class="p-row">
      <div class="p-rank">${i+1}</div>
      <div class="p-main">
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-phone">${prettyPhone(p.phone)}</div>
        <div class="p-time">запись: ${fmtT(p.t)}</div>
      </div>${del}
    </div>`;
  }).join('');
}

function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function fmtT(iso){
  if(!iso)return '—';
  const d=new Date(iso);
  if(isNaN(d))return '—';
  return d.toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
}

function unlockManage(){
  const pin=document.getElementById('inPin').value.trim();
  if(pin!==CFG.pin){document.getElementById('inPin').value='';return alert('Неверный пин-код');}
  unlocked=true;
  document.getElementById('manageBox').style.display='block';
  document.getElementById('inPin').value='';
  rebuildSelects();
}

function rebuildSelects(){
  ['inP1','inP2','inP3'].forEach(id=>{
    const s=document.getElementById(id);
    const cur=s.value;
    s.innerHTML='<option value="">— выберите —</option>'+(DB.players||[]).map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if(cur)s.value=cur;
  });
}

async function addTournament(){
  const name=document.getElementById('inTName').value.trim();
  const p1=document.getElementById('inP1').value;
  const p2=document.getElementById('inP2').value;
  const p3=document.getElementById('inP3').value;
  if(!name)return alert('Укажите название турнира');
  if(!p1)return alert('Выберите 1-е место');
  const places=[];
  if(p1)places.push({playerId:p1,place:1});
  if(p2)places.push({playerId:p2,place:2});
  if(p3)places.push({playerId:p3,place:3});
  const seen=[];
  for(const pl of places){
    if(seen.includes(pl.playerId))return alert('Один игрок не может занимать два места');
    seen.push(pl.playerId);
  }
  const participants=(DB.players||[]).length;
  if(participants<1)return alert('Сначала добавьте участников');
  try{
    await loadDB();
    // места могли измениться после перезагрузки
    if(!DB.game)DB.game={};
    if(!DB.players)DB.players=[];
    if(!DB.tournaments)DB.tournaments=[];
    const part2=DB.players.length;
    DB.tournaments.push({
      id:Date.now().toString(36),
      name:name,
      date:new Date().toISOString().slice(0,10),
      participants:part2,
      places:places
    });
    await saveDB();
    document.getElementById('inTName').value='';
    document.getElementById('inP1').value='';
    document.getElementById('inP2').value='';
    document.getElementById('inP3').value='';
    renderTournaments();
    renderRating();
    if(document.getElementById('view-rating').style.display==='block'){renderRating();renderTournaments();}
  }catch(e){
    alert('Ошибка. Попробуйте ещё раз.');
  }
}

async function deleteTournament(id){
  if(!unlocked)return;
  if(!confirm('Удалить турнир и его результат из рейтинга?'))return;
  try{
    await loadDB();
    DB.tournaments=DB.tournaments.filter(t=>t.id!==id);
    await saveDB();
    renderTournaments();
    renderRating();
  }catch(e){alert('Ошибка. Попробуйте ещё раз.');}
}

function pts(place,participants){
  return Math.round((participants-place+1)/Math.max(1,participants)*100);
}

function ratingRows(){
  const rows={};
  (DB.players||[]).forEach(p=>{rows[p.id]={name:p.name,pts:0,games:0,wins:0,top3:0};});
  (DB.tournaments||[]).forEach(t=>{
    const n=t.participants||0;
    (t.places||[]).forEach(pl=>{
      const r=rows[pl.playerId];
      if(!r)return;
      const p=pts(pl.place,n);
      r.pts+=p;r.games++;r.wins+=pl.place===1?1:0;r.top3+=pl.place<=3?1:0;
    });
  });
  return Object.values(rows).filter(r=>r.games>0).sort((a,b)=>b.pts-a.pts||b.wins-a.wins||a.name.localeCompare(b.name));
}

async function renderRating(){
  const box=document.getElementById('ratingTable');
  try{await loadDB();}catch(e){}
  const rows=ratingRows();
  if(rows.length===0){
    box.innerHTML='<div class="empty"><div class="empty-ic">🏆</div><div class="empty-t">Рейтинг пока пуст</div><div class="empty-s">Добавьте результаты турниров в разделе «Инфо»</div></div>';
    return;
  }
  box.innerHTML=rows.map((r,i)=>{
    const top=i===0?'top1':i===1?'top2':i===2?'top3':'';
    return `<div class="rating-row ${top}">
      <div class="rat-rank">${i+1}</div>
      <div class="rat-main">
        <div class="rat-name">${esc(r.name)}</div>
        <div class="rat-sub">игр: ${r.games} · побед: ${r.wins} · топ-3: ${r.top3}</div>
      </div>
      <div class="rat-pts">${r.pts}</div>
    </div>`;
  }).join('');
}

async function renderTournaments(){
  const box=document.getElementById('tournamentList');
  try{await loadDB();}catch(e){}
  const list=(DB.tournaments||[]).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.id||'').localeCompare(a.id||''));
  if(list.length===0){
    box.innerHTML='<div class="tourn-row"><div class="tourn-empty">Турниров пока нет</div></div>';
    return;
  }
  const medals=['','🥇','🥈','🥉'];
  box.innerHTML=list.map(t=>{
    const rows=(t.places||[]).slice().sort((a,b)=>a.place-b.place).map(pl=>{
      const points=pts(pl.place,t.participants||0);
      const del=unlocked?`<button class="tourn-del" onclick="deleteTournament('${t.id}')">✕</button>`:'';
      return `<div class="tourn-place">
        <span class="tp-pos">${pl.place<=3?medals[pl.place]:pl.place}</span>
        <span class="tp-name">${esc(playerName(pl.playerId))}</span>
        <span class="tp-pts">${points}</span>
      </div>`;
    }).join('');
    return `<div class="tourn-row">
      <div class="tourn-head">
        <span class="tourn-name">${esc(t.name)}</span>
        <span class="tourn-parts">${t.participants} уч.</span>
        ${unlocked?`<button class="tourn-del" onclick="deleteTournament('${t.id}')">✕</button>`:''}
      </div>
      ${rows}
    </div>`;
  }).join('');
  if(unlocked)rebuildSelects();
}

async function setOpen(v){
  try{
    await loadDB();
    DB.game.open=v;
    await saveDB();
    updateHero();
  }catch(e){alert('Ошибка. Попробуйте ещё раз.');}
}
function openRegistration(){if(confirm('Открыть запись?'))setOpen(true);}
function closeRegistration(){if(confirm('Закрыть запись? Новые игроки не смогут записаться.'))setOpen(false);}

async function removePlayer(id){
  if(!unlocked)return;
  if(!confirm('Удалить этого игрока?'))return;
  try{
    await loadDB();
    DB.players=DB.players.filter(p=>p.id!==id);
    await saveDB();
    renderPlayers();
    updateHero();
  }catch(e){alert('Ошибка. Попробуйте ещё раз.');}
}

async function clearPlayers(){
  if(!unlocked)return;
  if(!confirm('Удалить ВСЕХ игроков? Это действие нельзя отменить.'))return;
  if(!confirm('Точно удалить всех?'))return;
  try{
    await loadDB();
    DB.players=[];
    await saveDB();
    renderPlayers();
    updateHero();
  }catch(e){alert('Ошибка. Попробуйте ещё раз.');}
}

document.getElementById('inPhone').addEventListener('input',function(){
  const v=this.value.replace(/[^\d\+]/g,'');
  this.value=v;
});

document.addEventListener('DOMContentLoaded',()=>{
  loadDB().then(()=>{
    updateHero();
    renderPlayers();
    renderRating();
    renderTournaments();
    if(DB.players.length>=3)rebuildSelects();
  }).catch(()=>{});
});