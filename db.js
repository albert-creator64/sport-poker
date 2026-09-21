const CFG={
  owner:'albert-creator64',
  repo:'sport-poker',
  path:'data/db.json',
  tokenB:'ghp_',
  tokenA:'lQcJqVSfk7kbpdDArjZxsNrIa2mrvA24IVFP',
  pin:'1234',
  page:'index'
};
const API='https://api.github.com/repos/'+CFG.owner+'/'+CFG.repo+'/contents/'+CFG.path;

let DB=null,DBsha=null,saving=false;

function hdr(){return{Authorization:'token '+CFG.tokenB+CFG.tokenA,'Accept':'application/vnd.github+json'};}

function emptyDB(){
  return {
    game:{title:'Sport Poker',open:true,date:'',place:'',info:'Спортивная игра по турнирным правилам. Запишитесь на турнир и приходите играть.',contact:''},
    players:[],
    tournaments:[],
    timer:{levels:[{sb:100,bb:200,ante:0,min:10}],levelIdx:0,running:false,levelStartTs:0,durMs:600000,players:0,reentries:0,avgStack:0,title:''}
  };
}

async function loadDB(force){
  if(DB&&!force)return DB;
  const r=await fetch(API,{headers:hdr()});
  if(r.ok){
    const j=await r.json();
    DBsha=j.sha;
    try{DB=JSON.parse(decodeURIComponent(escape(atob(j.content))));}catch(e){DB=null;}
  }else if(r.status===404){
    DB=emptyDB();
  }else{
    throw new Error('load '+r.status);
  }
  if(!DB)DB=emptyDB();
  DB.game=DB.game||{};
  if(!Array.isArray(DB.players))DB.players=[];
  if(!Array.isArray(DB.tournaments))DB.tournaments=[];
  const t0=emptyDB().timer;
  if(!DB.timer||typeof DB.timer!=='object'){DB.timer=t0;}
  else{
    if(!Array.isArray(DB.timer.levels)||DB.timer.levels.length===0)DB.timer.levels=t0.levels;
    if(typeof DB.timer.levelIdx!=='number')DB.timer.levelIdx=0;
    if(typeof DB.timer.running!=='boolean')DB.timer.running=false;
    if(typeof DB.timer.levelStartTs!=='number')DB.timer.levelStartTs=0;
    if(typeof DB.timer.durMs!=='number')DB.timer.durMs=600000;
    if(typeof DB.timer.players!=='number')DB.timer.players=0;
    if(typeof DB.timer.reentries!=='number')DB.timer.reentries=0;
    if(typeof DB.timer.avgStack!=='number')DB.timer.avgStack=0;
  }
  return DB;
}

async function saveDB(){
  if(saving)return Promise.reject(new Error('busy'));
  saving=true;
  const body={message:'update '+CFG.page+' '+new Date().toISOString(),
    content:btoa(unescape(encodeURIComponent(JSON.stringify(DB,null,2))))};
  if(DBsha)body.sha=DBsha;
  try{
    const r=await fetch(API,{method:'PUT',headers:hdr(),body:JSON.stringify(body)});
    if(!r.ok)throw new Error('save '+r.status);
    const j=await r.json();
    if(j&&j.content)DBsha=j.content.sha;
  }finally{
    saving=false;
  }
}

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function normPhone(v){
  let d=String(v||'').replace(/\D/g,'');
  if(d.length===11&&d[0]==='8')d='7'+d.slice(1);
  if(d.length===10)d='7'+d;
  return d;
}

function prettyPhone(raw){
  let d=String(raw||'').replace(/\D/g,'');
  if(d.length===10)d='7'+d;
  if(d.length===11&&d[0]==='8')d='7'+d.slice(1);
  if(d.length!==11||d[0]!=='7')return raw||'';
  return '+7 ('+d.slice(1,4)+') '+d.slice(4,7)+'-'+d.slice(7,9)+'-'+d.slice(9);
}

function fmtD(iso){
  if(!iso)return '—';
  const d=new Date(iso);
  if(isNaN(d))return '—';
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
}
function fmtDT(iso){
  if(!iso)return '—';
  const d=new Date(iso);
  if(isNaN(d))return '—';
  const dd=new Date(iso+'T00:00:00');
  const lbl=isNaN(dd)?iso.slice(8,10)+'.'+iso.slice(5,7):dd.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
  return lbl+(iso.slice(11,16)?' '+iso.slice(11,16):'');
}

function playerName(id){
  const p=(DB.players||[]).find(x=>x.id===id);
  return p?p.name:'—';
}
function findPlayerByPhone(phone){
  return (DB.players||[]).find(p=>p.phone===phone);
}

function pts(place,participants){
  return Math.round((participants-place+1)/Math.max(1,participants)*100);
}

function ratingRows(){
  const rows={};
  (DB.players||[]).forEach(p=>{rows[p.id]={name:p.name,pts:0,games:0,wins:0,top3:0,best:null};});
  (DB.tournaments||[]).forEach(t=>{
    const parts=t.totalPlayers||(t.queue||[]).length||1;
    (t.results||[]).forEach(pl=>{
      const r=rows[pl.playerId];
      if(!r)return;
      const p=pts(pl.place,parts);
      r.pts+=p;r.games++;r.wins+=pl.place===1?1:0;r.top3+=pl.place<=3?1:0;
      if(r.best==null||pl.place<r.best)r.best=pl.place;
    });
  });
  return Object.values(rows).filter(r=>r.games>0).sort((a,b)=>b.pts-a.pts||b.wins-a.wins||a.name.localeCompare(b.name));
}

function fmtDur(sec){
  sec=Math.max(0,Math.round(sec));
  const m=Math.floor(sec/60),s=sec%60;
  return String(m)+':'+String(s).padStart(2,'0');
}
function fmtMoney(n){
  return new Intl.NumberFormat('ru-RU').format(Math.round(n||0))+' ₽';
}