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
  {btn:2,id:'view-info'}
];

function hdr(){return{Authorization:'token '+CFG.tokenB+CFG.tokenA,'Accept':'application/vnd.github+json'};}

function goTab(i){
  TABS.forEach(t=>{
    document.getElementById(t.id).style.display=t.btn===i?'block':'none';
    document.querySelectorAll('.tabbar button')[t.btn].classList.toggle('on',t.btn===i);
  });
  if(i===1)renderPlayers();
  if(i===0)updateHero();
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
  return DB;
}

function emptyDB(){
  return {game:{title:'Спорт покер',open:true,date:'',place:'',info:'Спортивная игра по турнирным правилам. Время и место уточняются в клубе.',contact:''},players:[]};
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
  }).catch(()=>{});
});