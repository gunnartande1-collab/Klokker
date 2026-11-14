(() => {
'use strict';
const $=id=>document.getElementById(id);
const CONFIG={
  feedbackUrl:'mailto:b32838@ous-hf.no?subject=Tilbakemelding%20OPSIX%20klokkeverkt%C3%B8y'
};
const fmt2=n=>String(Math.max(0,Math.floor(n))).padStart(2,'0');
const fmtCount=ms=>{let s=Math.ceil(Math.max(0,ms)/1000);return `${fmt2(Math.floor(s/60))}:${fmt2(s%60)}`};
const fmtStop=ms=>{let s=Math.floor(Math.max(0,ms)/1000);return `${fmt2(s/3600)}:${fmt2(s/60)%60}:${fmt2(s%60)}`};
let audio;
function getAudio(){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume().catch(()=>{});return audio}catch{return null}}
function tone(time,frequency=800,duration=.08,volume=.12,type='sine'){
 const a=getAudio();if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(volume,time+.009);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g).connect(a.destination);o.start(time);o.stop(time+duration+.02);return o}catch{}
}
function melody(){const a=getAudio();if(a&&a.state==='running')[[0,523],[.20,659],[.40,784]].forEach(([d,f])=>tone(a.currentTime+.02+d,f,.23,.1,'sine'))}
function alarm(){const a=getAudio();if(a&&a.state==='running')[[0,840],[.26,840],[.52,840]].forEach(([d,f])=>tone(a.currentTime+.02+d,f,.15,.18,'triangle'))}
const state={metro:{running:false,mode:'voksen',bpm:110,anchor:0,step:0},count:{running:false,remaining:0,initial:0,end:0,finished:false},stop:{running:false,elapsed:0,start:0},breaths:[],options:{countSound:true,countVisual:true,pauseSound:false},pauses:[],heli:{start:null,lastAlarm:null,acknowledged:false}};
const modes={voksen:110,barn:110,spedbarn:110,nyfodt:120};
const tabs=[...document.querySelectorAll('[data-tab]')];
function tab(id){for(const b of tabs){let sel=b.dataset.tab===id;b.classList.toggle('active',sel);b.setAttribute('aria-selected',String(sel))}document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!==id)}
tabs.forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
$('openWindow').addEventListener('click',()=>window.open(location.href,'_blank','width=460,height=820,resizable=yes,scrollbars=yes'));
// Fargevalg lagrer bare visningsvalg, ingen pasientdata.
let saved='natt';try{saved=localStorage.getItem('opsix-clocks-theme')||'natt'}catch{}
if(!['dag','dempet','natt'].includes(saved))saved='natt';$('theme').value=saved;document.body.dataset.theme=saved;
$('theme').addEventListener('change',e=>{const v=e.target.value;document.body.dataset.theme=v;try{localStorage.setItem('opsix-clocks-theme',v)}catch{}});
function setMode(mode){const m=state.metro;m.mode=mode;m.bpm=modes[mode];document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));$('bpmAdjust').hidden=mode==='nyfodt';$('bpmLabel').disabled=mode==='nyfodt';$('bpmLabel').title=mode==='nyfodt'?'Fast 3:1-rytme':'Klikk for å endre takt';$('bpmDirect').hidden=true;$('bpmLabel').hidden=false;updateBpmView();restartMetroCycle();$('ecgFourth').toggleAttribute('hidden',mode==='nyfodt');$('ecgVent').toggleAttribute('hidden',mode!=='nyfodt')}
function updateBpmView(){const m=state.metro;$('bpmLabel').innerHTML=m.mode==='nyfodt'?'3:1 <span>HLR</span>':`${m.bpm} <span>BPM</span>`;$('bpmInput').value=m.bpm;$('bpmDirect').value=m.bpm}
function setBpm(value) {
 const metro = state.metro;
 if (metro.mode === 'nyfodt') return;
 const bpm = Number(value);
 if (Number.isSafeInteger(bpm) && bpm > 0) {
   metro.bpm = bpm;
   restartMetroCycle();
 }
 updateBpmView();
}
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
$('bpmDown').addEventListener('click',()=>setBpm(state.metro.bpm-1));$('bpmUp').addEventListener('click',()=>setBpm(state.metro.bpm+1));$('bpmInput').addEventListener('change',e=>setBpm(e.target.value));
$('bpmLabel').addEventListener('click',()=>{if(state.metro.mode==='nyfodt')return;$('bpmLabel').hidden=true;$('bpmDirect').hidden=false;$('bpmDirect').focus();$('bpmDirect').select()});
function closeBpm(){setBpm($('bpmDirect').value);$('bpmDirect').hidden=true;$('bpmLabel').hidden=false}
$('bpmDirect').addEventListener('keydown',e=>{if(e.key==='Enter')closeBpm();if(e.key==='Escape'){$('bpmDirect').hidden=true;$('bpmLabel').hidden=false}});$('bpmDirect').addEventListener('blur',()=>{if(!$('bpmDirect').hidden)closeBpm()});
const metroTones = new Set();
const metroInterval = () => 60 / state.metro.bpm;
function stopTones(tones) {
 for (const oscillator of tones) {
   // Oscillatoren kan være avsluttet før ended-hendelsen leveres.
   try { oscillator.stop(); } catch {}
 }
 tones.clear();
}
function trackTone(tones, oscillator) {
 if (!oscillator) return;
 tones.add(oscillator);
 oscillator.addEventListener('ended', () => tones.delete(oscillator), {once:true});
}
function restartMetroCycle() {
 const metro = state.metro;
 stopTones(metroTones);
 if (!metro.running) return;
 metro.anchor = audio.currentTime + .04;
 metro.step = 0;
}
$('metroStart').addEventListener('click', () => {
 if (!getAudio()) { alert('Lyd støttes ikke av denne nettleseren.'); return; }
 state.metro.running = true;
 restartMetroCycle();
 render();
});
$('metroPause').addEventListener('click', () => {
 state.metro.running = false;
 stopTones(metroTones);
 render();
});
$('metroReset').addEventListener('click', () => {
 state.metro.running = false;
 setMode('voksen');
 render();
});
function scheduleMetro() {
 const metro = state.metro;
 if (!metro.running || audio.state !== 'running') return;
 const interval = metroInterval();
 const now = audio.currentTime;
 // Hopp over slag nettleseren ikke rakk å planlegge.
 metro.step = Math.max(metro.step, Math.ceil((now - metro.anchor) / interval));
 for (let scheduled = 0; scheduled < 8; scheduled++) {
   const when = metro.anchor + metro.step * interval;
   if (when >= now + .12) break;
   const ventilation = metro.mode === 'nyfodt' && metro.step % 4 === 3;
   const duration = Math.min(ventilation ? .16 : .065, Math.max(.012, interval * .7));
   trackTone(metroTones, tone(when, ventilation ? 500 : 880, duration, ventilation ? .18 : .14));
   metro.step++;
 }
}
function drawBeatCursor() {
 const cursor = $('beatCursor');
 const metro = state.metro;
 cursor.toggleAttribute('hidden', !metro.running);
 if (metro.running) {
   const beats = (audio.currentTime - metro.anchor) / metroInterval();
   const x = ((beats * 60 + 30) % 240 + 240) % 240;
   cursor.setAttribute('x1', x);
   cursor.setAttribute('x2', x);
 }
 requestAnimationFrame(drawBeatCursor);
}

const countInput = $('countDisplay');
const baseTitle = document.title;
const countTab = document.querySelector('[data-tab="nedtelling"]');
function remaining() {
 const countdown = state.count;
 return countdown.running ? Math.max(0, countdown.end - Date.now()) : countdown.remaining;
}
function formatCountdown(ms) {
 const seconds = Math.ceil(ms / 1000);
 return [fmt2(seconds / 3600), fmt2(seconds / 60 % 60), fmt2(seconds % 60)].join(':');
}
function parseCountdown(value) {
 const text = value.trim();
 if (!text) return 0;
 const match = /^(\d{1,2}):(\d{1,2}):(\d{1,2})$/.exec(text)
   || /^(\d{2})(\d{2})(\d{2})$/.exec(text);
 if (!match) return null;
 const [hours, minutes, seconds] = match.slice(1).map(Number);
 if (minutes > 59 || seconds > 59) return null;
 return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
function readCountdown() {
 const duration = parseCountdown(countInput.value);
 $('countError').hidden = duration !== null;
 countInput.setAttribute('aria-invalid', String(duration === null));
 if (duration === null) return false;
 const countdown = state.count;
 countdown.initial = countdown.remaining = duration;
 countdown.finished = false;
 countInput.value = formatCountdown(duration);
 return true;
}
countInput.addEventListener('focus', () => {
 if (!countInput.readOnly) countInput.select();
});
countInput.addEventListener('change', () => {
 if (!countInput.readOnly) readCountdown();
 render();
});
countInput.addEventListener('keydown', event => {
 if (event.key === 'Enter' && !countInput.readOnly) $('countStart').click();
});
$('countStart').addEventListener('click', () => {
 const countdown = state.count;
 if (countdown.running) return;
 if (parseCountdown(countInput.value) === null) { readCountdown(); return; }
 if ((countInput.value !== formatCountdown(countdown.remaining) || countInput.getAttribute('aria-invalid') === 'true') && !readCountdown()) return;
 if (countdown.finished) countdown.remaining = countdown.initial;
 if (!countdown.remaining) return;
 getAudio();
 countdown.end = Date.now() + countdown.remaining;
 countdown.running = true;
 countdown.finished = false;
 render();
});
function finishCountdown() {
 const countdown = state.count;
 countdown.running = false;
 countdown.remaining = 0;
 countdown.finished = true;
 if (state.options.countSound) alarm();
}
$('countPause').addEventListener('click', () => {
 const countdown = state.count;
 if (!countdown.running) return;
 countdown.remaining = remaining();
 if (!countdown.remaining) finishCountdown();
 else countdown.running = false;
 render();
});
$('countReset').addEventListener('click', () => {
 Object.assign(state.count, {running:false, remaining:0, initial:0, finished:false});
 countInput.value = '00:00:00';
 readCountdown();
 render();
});
for(const holder of document.querySelectorAll('[data-setting]'))holder.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const opt=holder.dataset.setting;state.options[opt]=b.dataset.value==='yes';holder.querySelectorAll('button').forEach(other=>{const sel=other===b;other.classList.toggle('selected',sel);other.setAttribute('aria-pressed',String(sel))})}));
$('stopStart').addEventListener('click',()=>{let s=state.stop;if(s.running)return;s.start=Date.now();s.running=true;render()});$('stopPause').addEventListener('click',()=>{let s=state.stop;if(s.running){s.elapsed+=Date.now()-s.start;s.running=false}render()});$('stopReset').addEventListener('click',()=>{Object.assign(state.stop,{running:false,elapsed:0,start:0});render()});
$('breathTap').addEventListener('click',()=>{state.breaths.push(Date.now());render()});$('breathUndo').addEventListener('click',()=>{state.breaths.pop();render()});$('breathReset').addEventListener('click',()=>{state.breaths=[];render()});
const pauseFields = [['Matpause', $('mealTime')], ['Skjermpause', $('screenTime')]];
function parsePauseTime(value) {
 const match = /^(\d{1,2}):?(\d{2})$/.exec(value.trim());
 if (!match) return null;
 const hours = Number(match[1]);
 const minutes = Number(match[2]);
 return hours < 24 && minutes < 60 ? [hours, minutes] : null;
}
$('pauseSave').addEventListener('click', () => {
 const now = Date.now();
 const pauses = [];
 for (const [type, field] of pauseFields) {
   if (!field.value.trim()) continue;
   const time = parsePauseTime(field.value);
   if (!time) {
     field.setCustomValidity('Skriv et klokkeslett mellom 00:00 og 23:59.');
     field.reportValidity();
     return;
   }
   const [hours, minutes] = time;
   field.value = fmt2(hours) + ':' + fmt2(minutes);
   const date = new Date(now);
   date.setHours(hours, minutes, 0, 0);
   if (date.getTime() + 60000 <= now) date.setDate(date.getDate() + 1);
   const timeMs = date.getTime();
   const existing = state.pauses.find(pause => pause.field === field && pause.time === timeMs);
   pauses.push({type, field, time:timeMs, label:field.value, notified:existing?.notified ?? false});
 }
 state.pauses = pauses;
 if (state.options.pauseSound) getAudio();
 render();
});
for (const [, field] of pauseFields) field.addEventListener('input', () => field.setCustomValidity(''));
$('pauseReset').addEventListener('click', () => {
 state.pauses = [];
 for (const [, field] of pauseFields) {
   field.value = '';
   field.setCustomValidity('');
 }
 render();
});
function renderPauses(now) {
 const due = state.pauses.filter(pause => now >= pause.time);
 const fresh = due.filter(pause => !pause.notified);
 for (const pause of fresh) pause.notified = true;
 if (fresh.length && state.options.pauseSound) melody();
 for (const [, field] of pauseFields) {
   field.closest('.pause-time-row').classList.toggle('due', due.some(pause => pause.field === field));
 }
 document.querySelector('[data-tab="pause"]').classList.toggle('pause-due', !!due.length);
 $('pauseBadge').hidden = !due.length;
 $('pauseBadge').textContent = due.length ? 'NÅ' : '';
 const next = state.pauses.filter(pause => pause.time > now).sort((a,b) => a.time-b.time)[0];
 const message = due.length ? due.map(pause => pause.type).join(' + ') + ' nå'
   : next ? 'Neste: ' + next.type + ' kl. ' + next.label : '';
 if ($('pauseState').textContent !== message) $('pauseState').textContent = message;
}

const landingDuration = 180000;
const landingWarning = 90000;
const landingRepeat = 8000;
const landingTones = new Set();
const heliTab = document.querySelector('[data-tab="helikopter"]');
async function playLandingSound() {
 const context = getAudio();
 if (!context) return;
 const playback = {};
 landingPlayback = playback;
 if (context.state === 'suspended') {
   try { await context.resume(); } catch { return; }
 }
 if (landingPlayback !== playback || context.state !== 'running') return;
 stopTones(landingTones);
 for (const offset of [0, 1.9]) {
   const start = context.currentTime + offset + .02;
   for (const [delay, frequency, duration, volume] of [
     [0,880,.9,.27], [0,1320,.7,.10], [.55,659.25,1.3,.30], [.55,987.77,1,.09]
   ]) {
     trackTone(landingTones, tone(start + delay, frequency, duration, volume));
   }
 }
}
let landingPlayback;
function stopLandingSound() {
 landingPlayback = null;
 stopTones(landingTones);
}
$('heliStart').addEventListener('click', () => {
 if (state.heli.start !== null) return;
 getAudio();
 state.heli.start = performance.now();
 render();
});
$('heliReset').addEventListener('click', () => {
 stopLandingSound();
 Object.assign(state.heli, {start:null, lastAlarm:null, acknowledged:false});
 render();
});
$('heliAck').addEventListener('click', () => {
 state.heli.acknowledged = true;
 stopLandingSound();
 render();
});
$('heliTest').addEventListener('click', playLandingSound);
function renderLanding() {
 const heli = state.heli;
 const active = heli.start !== null;
 const now = performance.now();
 const elapsed = active ? now - heli.start : 0;
 const ms = landingDuration - elapsed;
 const alert = active && ms <= landingWarning && !heli.acknowledged;
 if (alert && (heli.lastAlarm === null || now - heli.lastAlarm >= landingRepeat)) {
   heli.lastAlarm = now;
   playLandingSound();
 }
 const time = ms <= -1000 ? '−' + fmtCount(Math.floor(-ms / 1000) * 1000) : fmtCount(ms);
 $('heliTime').textContent = time;
 $('heliProgress').value = Math.min(180, elapsed / 1000);
 $('heliBox').classList.toggle('heli-alert', alert);
 $('heliBox').classList.toggle('heli-overtime', ms <= -1000 && !alert);
 $('heliAlarm').hidden = $('heliAck').hidden = !alert;
 $('heliStart').disabled = active;
 heliTab.classList.toggle('heli-alert', alert);
 $('heliBadge').hidden = !active;
 $('heliBadge').textContent = alert ? 'VARSLING' : time;
 return active ? time : '';
}
$('feedbackButton').addEventListener('click',()=>{window.open(CONFIG.feedbackUrl,'_blank','noopener')});
$('versionButton').addEventListener('click',()=>$('versionDialog').showModal());$('closeVersion').addEventListener('click',()=>$('versionDialog').close());
function render(){const now=Date.now(),m=state.metro,c=state.count,s=state.stop;
 if (c.running && remaining() <= 0) finishCountdown();
 const displayedTime = formatCountdown(remaining());
 if (countInput.value !== displayedTime && (c.running || (document.activeElement !== countInput && countInput.getAttribute('aria-invalid') !== 'true'))) {
   countInput.value = displayedTime;
 }
 countInput.readOnly = c.running;
 $('countState').textContent = c.finished ? 'FERDIG' : c.running ? 'Nedtelling pågår' : c.remaining !== c.initial ? 'Pauset' : 'Klar';
 const countAlert = c.finished && state.options.countVisual;
 $('countBox').classList.toggle('finished', countAlert);
 countTab.classList.toggle('count-finished', countAlert);
 const elapsed=s.elapsed+(s.running?now-s.start:0);$('stopDisplay').textContent=fmtStop(elapsed);$('stopState').textContent=s.running?'Pågår':elapsed?'Pauset':'Klar';
 for(const [start,pause,running] of [['metroStart','metroPause',m.running],['countStart','countPause',c.running],['stopStart','stopPause',s.running]]){$(start).disabled=running;$(pause).disabled=!running}
 $('countBadge').hidden=!(c.running||c.finished);$('countBadge').textContent=c.finished?'FERDIG':formatCountdown(remaining());$('stopBadge').hidden=!s.running;$('stopBadge').textContent=fmtStop(elapsed);
 $('breathUndo').disabled = !state.breaths.length;
 let b=state.breaths,age=b.length?now-b[0]:0;$('breathCount').textContent=b.length;$('breathTime').textContent=`Observasjon ${fmtCount(age)} / 01:00`;
 // Et intervallbasert anslag, ikke antall pust x 60/sekunder siden første pust.
 if(b.length>=2&&age>=10000&&b[b.length-1]>b[0]){$('breathRate').textContent=Math.round(60000*(b.length-1)/(b[b.length-1]-b[0]));$('breathStatus').textContent=age>=60000?'60 sekunder passert':'Foreløpig estimat'}else{$('breathRate').textContent='–';$('breathStatus').textContent=b.length?'Avventer 2 pust og 10 sekunder':'Ikke startet'}$('breathBox').classList.toggle('observed',age>=60000);
 renderPauses(now);
 const landingTime = renderLanding();
 const title = c.running ? formatCountdown(remaining()) + ' | Nedtelling'
   : c.finished && state.options.countVisual ? 'Ferdig | Nedtelling'
   : landingTime ? landingTime + ' | Landingsvarsel RH' : baseTitle;
 if (document.title !== title) document.title = title;
 const active=[m.running?'Metronom':'',c.running?'Nedtelling':'',s.running?'Stoppeklokke':'',landingTime?'Helikoptervarsling':''].filter(Boolean);$('activityText').textContent=active.length?`Aktiv: ${active.join(', ')}`:'Ingen aktive klokker';document.querySelector('.live-dot').classList.toggle('on',active.length>0);
}
setInterval(()=>{scheduleMetro();render()},60);
window.addEventListener('beforeunload',e=>{if(state.metro.running||state.count.running||state.stop.running||state.heli.start!==null||state.pauses.some(p=>p.time>Date.now())){e.preventDefault();e.returnValue=''}});
setMode('voksen');render();
requestAnimationFrame(drawBeatCursor);
})();