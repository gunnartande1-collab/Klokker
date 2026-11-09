(() => {
'use strict';
const $=id=>document.getElementById(id);
const CONFIG={
  // SETT INN faktisk URL til din EKSISTERENDE helikoptervarsling, ikke lag en duplikat.
  helicopterUrl:'',
  feedbackUrl:'mailto:b32838@ous-hf.no?subject=Tilbakemelding%20OPSIX%20klokkeverkt%C3%B8y'
};
const fmt2=n=>String(Math.max(0,Math.floor(n))).padStart(2,'0');
const fmtCount=ms=>{let s=Math.ceil(Math.max(0,ms)/1000);return `${fmt2(Math.floor(s/60))}:${fmt2(s%60)}`};
const fmtStop=ms=>{let s=Math.floor(Math.max(0,ms)/1000);return `${fmt2(s/3600)}:${fmt2(s/60)%60}:${fmt2(s%60)}`};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
let audio;
function getAudio(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});return audio}catch{return null}}
function tone(time,frequency=800,duration=.08,volume=.12,type='sine'){
 const a=getAudio();if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(volume,time+.009);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g).connect(a.destination);o.start(time);o.stop(time+duration+.02)}catch{}
}
function melody(){const a=getAudio();if(a&&a.state==='running')[[0,523],[.20,659],[.40,784]].forEach(([d,f])=>tone(a.currentTime+.02+d,f,.23,.1,'sine'))}
function alarm(){const a=getAudio();if(a&&a.state==='running')[[0,840],[.26,840],[.52,840]].forEach(([d,f])=>tone(a.currentTime+.02+d,f,.15,.18,'triangle'))}
const state={metro:{running:false,mode:'voksen',bpm:110,next:0,step:0},count:{running:false,remaining:180000,initial:180000,end:0,finished:false},stop:{running:false,elapsed:0,start:0},breaths:[],options:{countSound:true,countVisual:true,pauseSound:false},pauses:[],pauseNotified:new Set()};
const modes={voksen:110,barn:110,spedbarn:110,nyfodt:120};
const tabs=[...document.querySelectorAll('[data-tab]')];
function tab(id){for(const b of tabs){let sel=b.dataset.tab===id;b.classList.toggle('active',sel);b.setAttribute('aria-selected',String(sel))}document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!==id)}
tabs.forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
$('openWindow').addEventListener('click',()=>window.open(location.href,'_blank','width=460,height=820,resizable=yes,scrollbars=yes'));
// Fargevalg lagrer bare visningsvalg, ingen pasientdata.
let saved='natt';try{saved=localStorage.getItem('opsix-clocks-theme')||'natt'}catch{}
if(!['dag','dempet','natt'].includes(saved))saved='natt';$('theme').value=saved;document.body.dataset.theme=saved;
$('theme').addEventListener('change',e=>{const v=e.target.value;document.body.dataset.theme=v;try{localStorage.setItem('opsix-clocks-theme',v)}catch{}});
function setMode(mode){const m=state.metro;m.mode=mode;m.bpm=modes[mode];m.step=0;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));$('bpmAdjust').hidden=mode==='nyfodt';$('bpmLabel').disabled=mode==='nyfodt';$('bpmLabel').title=mode==='nyfodt'?'Fast 3:1-rytme':'Klikk for å endre takt';$('bpmDirect').hidden=true;$('bpmLabel').hidden=false;updateBpmView();if(m.running&&audio)m.next=audio.currentTime+.03}
function updateBpmView(){const m=state.metro;$('bpmLabel').innerHTML=m.mode==='nyfodt'?'3:1 <span>HLR</span>':`${m.bpm} <span>BPM</span>`;$('bpmInput').value=m.bpm;$('bpmDirect').value=m.bpm}
function setBpm(v){const m=state.metro;if(m.mode==='nyfodt')return;m.bpm=clamp(parseInt(v,10),100,120);updateBpmView();if(m.running&&audio)m.next=audio.currentTime+.03}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('bpmDown').addEventListener('click',()=>setBpm(state.metro.bpm-1));$('bpmUp').addEventListener('click',()=>setBpm(state.metro.bpm+1));$('bpmInput').addEventListener('change',e=>setBpm(e.target.value));
$('bpmLabel').addEventListener('click',()=>{if(state.metro.mode==='nyfodt')return;$('bpmLabel').hidden=true;$('bpmDirect').hidden=false;$('bpmDirect').focus();$('bpmDirect').select()});
function closeBpm(){setBpm($('bpmDirect').value);$('bpmDirect').hidden=true;$('bpmLabel').hidden=false}
$('bpmDirect').addEventListener('keydown',e=>{if(e.key==='Enter')closeBpm();if(e.key==='Escape'){$('bpmDirect').hidden=true;$('bpmLabel').hidden=false}});$('bpmDirect').addEventListener('blur',()=>{if(!$('bpmDirect').hidden)closeBpm()});
$('metroStart').addEventListener('click',()=>{let a=getAudio();if(!a){alert('Lyd støttes ikke av denne nettleseren.');return}state.metro.running=true;state.metro.next=a.currentTime+.05;state.metro.step=0;render()});
$('metroPause').addEventListener('click',()=>{state.metro.running=false;render()});$('metroReset').addEventListener('click',()=>{state.metro.running=false;setMode('voksen');render()});
let visualTimers=[];
function flashAt(delay){const id=setTimeout(()=>{if(!state.metro.running)return;const el=$('beatDisplay');el.classList.remove('beat');void el.offsetWidth;el.classList.add('beat');setTimeout(()=>el.classList.remove('beat'),200)},Math.max(0,delay));visualTimers.push(id)}
function scheduleMetro(){const m=state.metro,a=audio;if(!m.running||!a||a.state!=='running')return;let interval=m.mode==='nyfodt'?.5:60/m.bpm;let n=0;while(m.next<a.currentTime+.10&&n++<5){let vent=m.mode==='nyfodt'&&m.step%4===3;let when=Math.max(m.next,a.currentTime+.005);tone(when,vent?500:880,vent?.16:.065,vent?.18:.14);if(!vent)flashAt((when-a.currentTime)*1000);m.next+=interval;m.step++}if(m.next<a.currentTime-.25)m.next=a.currentTime+.02;visualTimers=visualTimers.filter(id=>id!==undefined).slice(-12)}
function remaining(){return state.count.running?Math.max(0,state.count.end-Date.now()):state.count.remaining}
function readCountdown(){const mm=clamp(parseInt($('countMinutes').value,10)||0,0,999),ss=clamp(parseInt($('countSeconds').value,10)||0,0,59);$('countMinutes').value=mm;$('countSeconds').value=ss;state.count.initial=(mm*60+ss)*1000;if(!state.count.running){state.count.remaining=state.count.initial;state.count.finished=false}render()}
$('countMinutes').addEventListener('change',readCountdown);$('countSeconds').addEventListener('change',readCountdown);
$('countStart').addEventListener('click',()=>{const c=state.count;if(c.running)return;if(c.remaining<=0){readCountdown();if(c.remaining<=0)return}getAudio();c.end=Date.now()+c.remaining;c.running=true;c.finished=false;render()});
$('countPause').addEventListener('click',()=>{const c=state.count;if(c.running){c.remaining=remaining();c.running=false}render()});
$('countReset').addEventListener('click',()=>{const c=state.count;c.running=false;c.remaining=c.initial;c.finished=false;render()});
for(const holder of document.querySelectorAll('[data-setting]'))holder.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const opt=holder.dataset.setting;state.options[opt]=b.dataset.value==='yes';holder.querySelectorAll('button').forEach(other=>{const sel=other===b;other.classList.toggle('selected',sel);other.setAttribute('aria-pressed',String(sel))})}));
$('stopStart').addEventListener('click',()=>{let s=state.stop;if(s.running)return;s.start=Date.now();s.running=true;render()});$('stopPause').addEventListener('click',()=>{let s=state.stop;if(s.running){s.elapsed+=Date.now()-s.start;s.running=false}render()});$('stopReset').addEventListener('click',()=>{Object.assign(state.stop,{running:false,elapsed:0,start:0});render()});
$('breathTap').addEventListener('click',()=>{state.breaths.push(Date.now());render()});$('breathReset').addEventListener('click',()=>{state.breaths=[];render()});
function todayAt(v){if(!v)return null;const [h,m]=v.split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return null;const d=new Date();d.setHours(h,m,0,0);return d.getTime()}
$('pauseSave').addEventListener('click',()=>{state.pauses=[{type:'Matpause',time:todayAt($('mealTime').value),length:clamp(+$('mealLength').value,1,240)},{type:'Skjermpause',time:todayAt($('screenTime').value),length:clamp(+$('screenLength').value,1,120)}].filter(p=>p.time!==null);state.pauseNotified.clear();getAudio();render()});
$('pauseReset').addEventListener('click',()=>{state.pauses=[];state.pauseNotified.clear();$('mealTime').value='';$('screenTime').value='';render()});
$('heliOpen').addEventListener('click',()=>{if(CONFIG.helicopterUrl)window.open(CONFIG.helicopterUrl,'_blank','noopener');else $('heliConfigHint').textContent='Legg inn adressen til eksisterende helikoptervarsling i CONFIG.helicopterUrl i klokker.js.'});
$('feedbackButton').addEventListener('click',()=>{window.open(CONFIG.feedbackUrl,'_blank','noopener')});
$('versionButton').addEventListener('click',()=>$('versionDialog').showModal());$('closeVersion').addEventListener('click',()=>$('versionDialog').close());
function render(){const now=Date.now(),m=state.metro,c=state.count,s=state.stop;
 if(c.running&&remaining()<=0){c.running=false;c.remaining=0;c.finished=true;if(state.options.countSound)alarm()}
 $('countDisplay').textContent=fmtCount(remaining());$('countState').textContent=c.finished?'FERDIG':c.running?'Nedtelling pågår':c.remaining!==c.initial?'Pauset':'Klar';$('countBox').classList.toggle('observed',c.finished&&state.options.countVisual);$('countBox').classList.toggle('finished',c.finished&&state.options.countVisual);
 $('countMinutes').disabled=c.running;$('countSeconds').disabled=c.running;
 const elapsed=s.elapsed+(s.running?now-s.start:0);$('stopDisplay').textContent=fmtStop(elapsed);$('stopState').textContent=s.running?'Pågår':elapsed?'Pauset':'Klar';
 for(const [start,pause,running] of [['metroStart','metroPause',m.running],['countStart','countPause',c.running],['stopStart','stopPause',s.running]]){$(start).disabled=running;$(pause).disabled=!running}
 $('countBadge').hidden=!(c.running||c.finished);$('countBadge').textContent=c.finished?'FERDIG':fmtCount(remaining());$('stopBadge').hidden=!s.running;$('stopBadge').textContent=fmtStop(elapsed);
 let b=state.breaths,age=b.length?now-b[0]:0;$('breathCount').textContent=b.length;$('breathTime').textContent=`Observasjon ${fmtCount(age)} / 01:00`;
 // Et intervallbasert anslag, ikke antall pust x 60/sekunder siden første pust.
 if(b.length>=2&&age>=10000&&b[b.length-1]>b[0]){$('breathRate').textContent=Math.round(60000*(b.length-1)/(b[b.length-1]-b[0]));$('breathStatus').textContent=age>=60000?'60 sekunder passert':'Foreløpig estimat'}else{$('breathRate').textContent='–';$('breathStatus').textContent=b.length?'Avventer 2 pust og 10 sekunder':'Ikke startet'}$('breathBox').classList.toggle('observed',age>=60000);
 const due=state.pauses.filter(p=>now>=p.time&&now<p.time+p.length*60000);const upcoming=state.pauses.filter(p=>now<p.time).sort((a,b)=>a.time-b.time);const pausetab=document.querySelector('[data-tab="pause"]');pausetab.classList.toggle('pause-due',due.length>0);$('pauseBadge').hidden=!due.length;$('pauseBadge').textContent=due.length?'NÅ':'';$('pauseState').textContent=due.length?`${due.map(p=>p.type).join(' + ')} nå`:upcoming.length?`Neste: ${upcoming[0].type}`:'Ingen kommende pauser';$('pauseDetail').textContent=due.length?`Til ${new Date(Math.min(...due.map(p=>p.time+p.length*60000))).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'})}`:upcoming.length?new Date(upcoming[0].time).toLocaleTimeString('no-NO',{hour:'2-digit',minute:'2-digit'}):state.pauses.length?'Tidspunkt passert':'Angi tidspunkter over';document.querySelector('.pause-display').classList.toggle('due',!!due.length);
 for(const p of due){const key=`${p.type}:${p.time}`;if(!state.pauseNotified.has(key)){state.pauseNotified.add(key);if(state.options.pauseSound)melody()}}
 const active=[m.running?'Metronom':'',c.running?'Nedtelling':'',s.running?'Stoppeklokke':''].filter(Boolean);$('activityText').textContent=active.length?`Aktiv: ${active.join(', ')}`:'Ingen aktive klokker';document.querySelector('.live-dot').classList.toggle('on',active.length>0);
}
setInterval(()=>{scheduleMetro();render()},60);
window.addEventListener('beforeunload',e=>{if(state.metro.running||state.count.running||state.stop.running||state.pauses.some(p=>p.time>Date.now())){e.preventDefault();e.returnValue=''}});
setMode('voksen');render();
})();
