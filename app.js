
const $ = id => document.getElementById(id);

const store = {
  get(k, fallback=null){ try { return JSON.parse(localStorage.getItem(k)) ?? fallback } catch { return fallback } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)) }
};

function toMinutes(t){
  const [h,m] = t.split(':').map(Number);
  return h*60+m;
}
function fmtMin(min){
  min = ((Math.round(min)%1440)+1440)%1440;
  const h = Math.floor(min/60), m=min%60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function circularDiff(target,current){
  let d = target-current;
  while(d>720)d-=1440;
  while(d<-720)d+=1440;
  return d;
}
function hToText(h){
  if (h == null || isNaN(h)) return '—';
  const mins = Math.round(h*60);
  return `${Math.floor(mins/60)}س ${mins%60}د`;
}
function inferDuration(bed,wake){
  let b=toMinutes(bed), w=toMinutes(wake);
  let d=w-b; if(d<=0)d+=1440;
  return d/60;
}
function calcDebt(history, need){
  const last7 = history.slice(-7);
  return Math.max(0, last7.reduce((s,x)=>s+Math.max(0, need-x.actualSleep),0));
}
function addEvent(time,title,desc){
  const el=document.createElement('div');
  el.className='event';
  el.innerHTML=`<time>${time}</time><div><div class="title">${title}</div><div class="desc">${desc}</div></div>`;
  $('timeline').appendChild(el);
}
function recompute(){
  const history=store.get('sleepHistory',[]);
  const goal=store.get('sleepGoal',{bedtime:'23:00',wake:'07:00',maxShift:45});
  const latest=history.at(-1);
  $('timeline').innerHTML='';

  if(!latest){
    $('sleepDuration').textContent='—';
    $('sleepDebt').textContent='—';
    $('targetBedtime').textContent='—';
    $('shiftBadge').textContent='داده لازم است';
    return;
  }

  const need=latest.sleepNeed || 8.25;
  const debt=calcDebt(history,need);
  $('sleepDuration').textContent=hToText(latest.actualSleep);
  $('sleepDebt').textContent=hToText(debt);

  const currentBed=toMinutes(latest.bedtime);
  const goalBed=toMinutes(goal.bedtime);
  const diff=circularDiff(goalBed,currentBed);
  const step=Math.sign(diff)*Math.min(Math.abs(diff),Number(goal.maxShift||45));
  const target=currentBed+step;

  $('targetBedtime').textContent=fmtMin(target);
  $('shiftBadge').textContent=`جابجایی امروز ${Math.abs(step)} دقیقه ${step<0?'زودتر':'دیرتر'}`;

  const wake=toMinutes(latest.waketime);
  const morningLight=wake+15;
  const peak1=wake+120;
  const peak2=wake+300;
  const dip=wake+390;
  const caffeineCut=Math.min(target-8*60,wake+6*60);
  const winddown=target-60;

  addEvent(fmtMin(morningLight),'نور صبح','۲۰ تا ۳۰ دقیقه نور طبیعی بیرون');
  addEvent(fmtMin(peak1),'شروع بازه تمرکز','کار فکری، تصمیم‌گیری و برنامه‌ریزی');
  addEvent(fmtMin(peak2),'پایان بازه تمرکز','بعد از این زمان کارهای سبک‌تر را جلو بینداز');
  addEvent(fmtMin(dip),'افت انرژی','استراحت، پیاده‌روی یا کارهای روتین');
  addEvent(fmtMin(caffeineCut),'آخرین کافئین','بعد از این ساعت کافئین را قطع کن');
  addEvent(fmtMin(winddown),'Wind-down','نور محیط را کم و کارهای تحریک‌کننده را متوقف کن');
  addEvent(fmtMin(target),'خواب هدف','امشب این ساعت را هدف بگیر');
}

function load(){
  const goal=store.get('sleepGoal',{bedtime:'23:00',wake:'07:00',maxShift:45});
  $('goalBedtime').value=goal.bedtime;
  $('goalWake').value=goal.wake;
  $('maxShift').value=goal.maxShift;

  const latest=store.get('sleepHistory',[]).at(-1);
  if(latest){
    $('bedtime').value=latest.bedtime;
    $('waketime').value=latest.waketime;
    $('sleepNeed').value=latest.sleepNeed || 8.25;
  }
  recompute();
}

$('saveSleepBtn').addEventListener('click',()=>{
  const bedtime=$('bedtime').value;
  const waketime=$('waketime').value;
  const inferred=inferDuration(bedtime,waketime);
  const actual=parseFloat($('actualSleep').value || inferred.toFixed(2));
  const need=parseFloat($('sleepNeed').value || '8.25');
  const history=store.get('sleepHistory',[]);
  history.push({date:new Date().toISOString(),bedtime,waketime,actualSleep:actual,sleepNeed:need});
  store.set('sleepHistory',history);
  recompute();
});

$('saveGoalBtn').addEventListener('click',()=>{
  store.set('sleepGoal',{bedtime:$('goalBedtime').value,wake:$('goalWake').value,maxShift:Number($('maxShift').value)});
  recompute();
});

$('copyLastBtn').addEventListener('click',()=>{
  const latest=store.get('sleepHistory',[]).at(-1);
  if(!latest)return;
  $('bedtime').value=latest.bedtime;
  $('waketime').value=latest.waketime;
  $('actualSleep').value=latest.actualSleep;
  $('sleepNeed').value=latest.sleepNeed;
});

let deferredPrompt;
window.addEventListener('beforeinstallprompt',(e)=>{
  e.preventDefault(); deferredPrompt=e; $('installBtn').classList.remove('hidden');
});
$('installBtn').addEventListener('click',async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null; $('installBtn').classList.add('hidden');
});

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));
}
load();
