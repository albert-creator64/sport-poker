CFG.page='timer';
let mode=(new URLSearchParams(location.search).get('board'))?'board':'ctrl';
let tick=null;

function goBoard(){
  if(mode==='board')return;
  location.search='?board=1';
}
function goControl(){
  if(mode==='ctrl')return;
  history.replaceState(null,'',location.pathname);
  location.reload();
}

async function ctrlSave(){
  try{await saveDB();}catch(e){}
}

function applyTimerUI(){
  const t=DB.timer||{};
  const lvls=t.levels||[];
  const idx=Math.min(Math.max(t.levelIdx||0,0),Math.max(0,lvls.length-1));
  const lv=lvls[idx];
  const durMs=t.durMs||600000;
  const running=t.running;
  const elapsed=Date.now()-((t.levelStartTs||0));
  const remain=Math.max(0,durMs-elapsed);
  const pct=Math.min(100,elapsed/durMs*100);

  if(mode==='board'){
    document.getElementById('bhTitle').textContent=t.title||'БЛАЙНД-ТАЙМЕР';
    document.getElementById('bbVal').textContent=lv?(fmtMoneyS(lv.bb)):'—';
    document.getElementById('blindsVal').textContent=lv?(fmtMoneyS(lv.sb)+' / '+fmtMoneyS(lv.bb)):'—';
    document.getElementById('anteVal').textContent=lv?(lv.ante?fmtMoneyS(lv.ante):'нет'):'—';
    document.getElementById('lvlVal').textContent=lvls.length?((idx+1)+' / '+lvls.length):'—';
    const fill=document.getElementById('progFill');
    fill.style.width=Math.min(100,pct)+'%';
    fill.style.background=running?'linear-gradient(90deg,var(--accent-soft),var(--accent))':'linear-gradient(90deg,#556, #667)';
    document.getElementById('progText').textContent=running?fmtDur(remain/1000):(remain>0?'пауза · '+fmtDur(remain/1000):'—');
    const next=lvls[idx+1];
    document.getElementById('nextVal').textContent=next?(fmtMoneyS(next.sb)+' / '+fmtMoneyS(next.bb)+(next.ante?' + '+fmtMoneyS(next.ante):'')):'— конец игры —';
    document.getElementById('stPlayers').textContent=t.players??'—';
    document.getElementById('stRe').textContent=t.reentries??'—';
    document.getElementById('stAvg').textContent=t.avgStack?fmtMoneyS(t.avgStack):'—';
  }else{
    document.getElementById('ctrlTime').textContent=running?fmtDur(remain/1000):(remain>0?'пауза · '+fmtDur(remain/1000):'—');
    document.getElementById('ctrlLevel').textContent=lv?(lv.sb+'/'+lv.bb+' АНТЕ '+(lv.ante?lv.ante:'—')+' · УРОВЕНЬ '+(idx+1)+'/'+lvls.length):'—';
    document.getElementById('btnToggle').textContent=running?'Пауза':'Старт';
  }
}

function fmtMoneyS(n){return new Intl.NumberFormat('ru-RU').format(Math.round(n||0));}

async function ctrlToggle(){
  const t=DB.timer;
  if(t.levelStartTs&&t.running){
    // пауза: заморозим оставшееся
    const durMs=t.durMs||600000;
    const remain=Math.max(0,(t.levelStartTs+durMs)-Date.now());
    t.levelStartTs=Date.now();
    t.durMs=remain;
    t.running=false;
  }else{
    // старт / продолжение
    t.running=true;
    if(!t.levelStartTs||t.durMs<=0){t.levelStartTs=Date.now();t.durMs=((t.levels||[])[t.levelIdx||0]||{min:10}).min*60000;}
    else t.levelStartTs=Date.now();
  }
  await ctrlSave();
  applyTimerUI();
}

async function ctrlReset(){
  const t=DB.timer;
  t.running=false;
  t.levelIdx=0;
  t.levelStartTs=0;
  t.durMs=((t.levels||[])[0]||{min:10}).min*60000;
  t.players=t.players||0;t.reentries=t.reentries||0;t.avgStack=t.avgStack||0;
  await ctrlSave();
  applyTimerUI();
  renderSched();
}

async function ctrlPrev(){
  const t=DB.timer;
  if((t.levelIdx||0)<=0)return alert('Это первый уровень');
  t.levelIdx-=1;
  t.levelStartTs=Date.now();
  t.durMs=((t.levels||[])[t.levelIdx]||{min:10}).min*60000;
  t.running=true;
  await ctrlSave();
  applyTimerUI();
}

async function ctrlNext(){
  const t=DB.timer;
  if((t.levelIdx||0)>=((t.levels||[]).length-1))return alert('Это последний уровень');
  t.levelIdx+=1;
  t.levelStartTs=Date.now();
  t.durMs=((t.levels||[])[t.levelIdx]||{min:10}).min*60000;
  t.running=true;
  await ctrlSave();
  applyTimerUI();
}

async function ctrlCount(key,delta){
  const t=DB.timer;
  t[key]=Math.max(0,((t[key]||0)+delta));
  if(key==='avgStack'&&t[key]===0)t[key]=0;
  await ctrlSave();
  applyTimerUI();
}

async function setTitle(){
  const v=prompt('Название игры на табло:',DB.timer.title||'БЛАЙНД-ТАЙМЕР');
  if(v===null)return;
  DB.timer.title=v.trim();
  await ctrlSave();
  applyTimerUI();
  renderSched();
}

/* --- редактор структуры --- */
function renderSched(){
  const box=document.getElementById('schedEditor');
  if(!box)return;
  const lvls=DB.timer.levels||[];
  box.innerHTML=`<div class="sched-head"><span>№</span><span>SB</span><span>BB</span><span>АНТЕ</span><span>МИН</span><span></span></div>`+
    lvls.map((l,i)=>`<div class="sched-row">
      <span class="sched-idx">${i+1}</span>
      <input type="number" id="s_sb_${i}" value="${l.sb||0}" placeholder="100">
      <input type="number" id="s_bb_${i}" value="${l.bb||0}" placeholder="200">
      <input type="number" id="s_an_${i}" value="${l.ante||0}" placeholder="0">
      <input type="number" id="s_mn_${i}" value="${l.min||10}" placeholder="10">
      <button class="mini-del" onclick="delLevel(${i})">✕</button>
    </div>`).join('');
}

function addLevel(){
  const lvls=DB.timer.levels||[];
  const last=lvls[lvls.length-1]||{sb:100,bb:200,ante:0,min:10};
  lvls.push({sb:(last.sb||100)*2,bb:(last.bb||200)*2,ante:(last.ante||0)*2||0,min:last.min||10});
  renderSched();
}

function delLevel(i){
  const lvls=DB.timer.levels||[];
  if(lvls.length<=1)return;
  lvls.splice(i,1);
  if((DB.timer.levelIdx||0)>=lvls.length)DB.timer.levelIdx=lvls.length-1;
  renderSched();
}

async function saveStructure(){
  const lvls=DB.timer.levels||[];
  lvls.forEach((l,i)=>{
    const sb=document.getElementById('s_sb_'+i);
    const bb=document.getElementById('s_bb_'+i);
    const an=document.getElementById('s_an_'+i);
    const mn=document.getElementById('s_mn_'+i);
    if(sb)l.sb=Math.max(0,parseInt(sb.value)||0);
    if(bb)l.bb=Math.max(0,parseInt(bb.value)||0);
    if(an)l.an=0,l.ante=Math.max(0,parseInt(an.value)||0);
    if(mn)l.min=Math.max(1,parseInt(mn.value)||10);
  });
  // проверка согласованности
  const good=lvls.every(l=>l.sb>0&&l.bb>0);
  if(!good)return alert('Все уровни должны иметь SB и BB больше 0');
  DB.timer.levels=lvls;
  DB.timer.levelStartTs=0;
  DB.timer.durMs=((DB.timer.levels||[])[DB.timer.levelIdx||0]||{min:10}).min*60000;
  await ctrlSave();
  applyTimerUI();
  renderSched();
  alert('Структура сохранена');
}

/* --- цикл --- */
function tickLoop(){
  applyTimerUI();
  // автопереход по истечении уровня
  const t=DB.timer;
  if(t&&t.running){
    const durMs=t.durMs||0;
    const remain=(t.levelStartTs+durMs)-Date.now();
    if(remain<=0){
      const lvls=t.levels||[];
      if((t.levelIdx||0)<lvls.length-1){
        t.levelIdx+=1;
        t.levelStartTs=Date.now();
        t.durMs=((lvls||[])[t.levelIdx]||{min:10}).min*60000;
        ctrlSave();
      }else{
        t.running=false;
        ctrlSave();
      }
    }
  }
}

async function pollTimer(){
  try{
    await loadDB(true);
    applyTimerUI();
    if(mode==='ctrl')renderSched();
  }catch(e){}
}

document.addEventListener('DOMContentLoaded',()=>{
  loadDB().then(()=>{
    applyTimerUI();
    if(mode==='ctrl')renderSched();
    tick=setInterval(tickLoop,250);
    setInterval(pollTimer,3000);
  }).catch(()=>{});
});