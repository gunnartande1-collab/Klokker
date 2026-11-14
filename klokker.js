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
const pauseNotes = [[0,523],[.20,659],[.40,784]];
const countTones = new Set();
function alarm() {
 const context = getAudio();
 if (!context || context.state !== 'running') return;
 for (const repeat of [0, 1.25]) {
   for (const delay of [0, .26, .52]) {
     trackTone(countTones, tone(context.currentTime + .02 + repeat + delay, 840, .15, .18, 'triangle'));
   }
 }
}
const state={metro:{running:false,mode:'voksen',bpm:110,anchor:0,step:0},count:{running:false,remaining:0,initial:0,end:0,finished:false,paused:false},stop:{running:false,elapsed:0,start:0},breaths:[],options:{countSound:true,countVisual:true,pauseSound:false},pauses:[],heli:{start:null,lastAlarm:null,acknowledged:false}};
const modes={voksen:110,nyfodt:120};
const tabs=[...document.querySelectorAll('[data-tab]')];
function tab(id){for(const b of tabs){let sel=b.dataset.tab===id;b.classList.toggle('active',sel);b.setAttribute('aria-selected',String(sel))}document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!==id)}
tabs.forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
$('openWindow').addEventListener('click',()=>window.open(location.href,'_blank','width=460,height=820,resizable=yes,scrollbars=yes'));
// Fargevalg lagrer bare visningsvalg, ingen pasientdata.
let saved='natt';try{saved=localStorage.getItem('opsix-clocks-theme')||'natt'}catch{}
if(!['dag','dempet','natt'].includes(saved))saved='natt';$('theme').value=saved;document.body.dataset.theme=saved;
$('theme').addEventListener('change',e=>{const v=e.target.value;document.body.dataset.theme=v;try{localStorage.setItem('opsix-clocks-theme',v)}catch{}});
const textSize = $('textSize');
try {
 const preference = localStorage.getItem('opsix-clocks-text');
 if (['normal','large','extra'].includes(preference)) textSize.value = preference;
} catch {}
document.body.dataset.textSize = textSize.value;
textSize.addEventListener('change', () => {
 document.body.dataset.textSize = textSize.value;
 try { localStorage.setItem('opsix-clocks-text', textSize.value); } catch {}
});
function setMode(mode){const m=state.metro;m.mode=mode;m.bpm=modes[mode];$('metronomeHint').hidden=mode!=='nyfodt';document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));$('bpmAdjust').hidden=mode==='nyfodt';$('bpmLabel').disabled=mode==='nyfodt';$('bpmLabel').title=mode==='nyfodt'?'Fast 3:1-rytme':'Klikk for å endre takt';$('bpmDirect').hidden=true;$('bpmLabel').hidden=false;updateBpmView();restartMetroCycle();$('ecgFourth').toggleAttribute('hidden',mode==='nyfodt');$('ecgVent').toggleAttribute('hidden',mode!=='nyfodt')}
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

function timeParts(id) {
 const group = $(id);
 const inputs = [...group.querySelectorAll('input')];
 const clearError = () => inputs.forEach(input => input.removeAttribute('aria-invalid'));
 inputs.forEach((input, index) => {
   input.addEventListener('focus', () => input.select());
   input.addEventListener('click', () => input.select());
   input.addEventListener('input', () => {
     input.value = input.value.replace(/\D/g, '').slice(0, 2);
     clearError();
     if (input.value.length === 2 && Number(input.value) <= Number(input.dataset.max)) {
       inputs[index + 1]?.focus();
     }
   });
   input.addEventListener('blur', () => {
     if (input.value) input.value = input.value.padStart(2, '0');
   });
   input.addEventListener('paste', event => {
     const value = event.clipboardData?.getData('text').trim();
     if (!value || !new RegExp('^\\d{2}(?::?\\d{2}){' + (inputs.length - 1) + '}$').test(value)) return;
     event.preventDefault();
     write(value.replace(/:/g, '').match(/\d{2}/g).join(':'));
     group.dispatchEvent(new Event('input', {bubbles:true}));
   });
 });
 function write(value) {
   const parts = value.split(':');
   inputs.forEach((input, index) => {
     if (input.value !== (parts[index] || '')) input.value = parts[index] || '';
   });
   clearError();
 }
 return {
   group,
   write,
   value: () => inputs.map(input => input.value).join(':'),
   read({requireAll = false} = {}) {
     const invalid = inputs.find(input =>
       (requireAll && !input.value) || (input.value && (!/^\d{1,2}$/.test(input.value) || Number(input.value) > Number(input.dataset.max)))
     );
     if (invalid) {
       invalid.setAttribute('aria-invalid','true');
       invalid.focus();
       return null;
     }
     return inputs.map(input => Number(input.value));
   },
   readOnly: value => inputs.forEach(input => { input.readOnly = value; })
 };
}
const durationMs = ([hours, minutes, seconds]) => (hours * 3600 + minutes * 60 + seconds) * 1000;
const countInput = timeParts('countDisplay');
const baseTitle = document.title;
const countTab = document.querySelector('[data-tab="nedtelling"]');
const countBox = $('countBox');
function remaining() {
 const countdown = state.count;
 return countdown.running ? Math.max(0, countdown.end - Date.now()) : countdown.remaining;
}
function formatCountdown(ms) {
 const seconds = Math.ceil(ms / 1000);
 return [fmt2(seconds / 3600), fmt2(seconds / 60 % 60), fmt2(seconds % 60)].join(':');
}
function clearCountAlert() {
 state.count.finished = false;
 countBox.classList.remove('count-flash');
 countTab.classList.remove('count-flash');
 stopTones(countTones);
}
countInput.group.addEventListener('input', () => {
 if (state.count.running) return;
 clearCountAlert();
 state.count.edited = true;
 $('countError').hidden = true;
 render();
});
countInput.group.addEventListener('keydown', event => {
 if (event.key === 'Enter') $('countStart').click();
});
$('countStart').addEventListener('click', () => {
 const countdown = state.count;
 if (countdown.running) return;
 if (countdown.edited) {
   const parts = countInput.read();
   $('countError').hidden = !!parts;
   if (!parts) return;
   countdown.initial = countdown.remaining = durationMs(parts);
   countdown.edited = false;
 } else if (countdown.finished) {
   countdown.remaining = countdown.initial;
 }
 if (!countdown.remaining) return;
 clearCountAlert();
 if (state.options.countSound) getAudio();
 countdown.end = Date.now() + countdown.remaining;
 countdown.running = true;
 countdown.paused = false;
 render();
});
function finishCountdown() {
 const countdown = state.count;
 countdown.running = false;
 countdown.remaining = 0;
 countdown.finished = true;
 if (state.options.countSound) alarm();
 if (state.options.countVisual) {
   const target = $('nedtelling').hidden ? countTab : countBox;
   target.classList.add('count-flash');
 }
}
$('countPause').addEventListener('click', () => {
 const countdown = state.count;
 if (!countdown.running) return;
 countdown.remaining = remaining();
 if (!countdown.remaining) finishCountdown();
 else {
   countdown.running = false;
   countdown.paused = true;
 }
 render();
});
$('countReset').addEventListener('click', () => {
 clearCountAlert();
 Object.assign(state.count, {running:false, remaining:0, initial:0, edited:false, paused:false});
 $('countError').hidden = true;
 render();
});
for(const holder of document.querySelectorAll('[data-setting]'))holder.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const opt=holder.dataset.setting;state.options[opt]=b.dataset.value==='yes';if(opt==='pauseSound'){if(state.options.pauseSound)getAudio();schedulePauseAudio()}if(opt==='countVisual'&&!state.options.countVisual){countBox.classList.remove('count-flash');countTab.classList.remove('count-flash')}render();holder.querySelectorAll('button').forEach(other=>{const sel=other===b;other.classList.toggle('selected',sel);other.setAttribute('aria-pressed',String(sel))})}));
$('stopStart').addEventListener('click',()=>{let s=state.stop;if(s.running)return;s.start=Date.now();s.running=true;render()});$('stopPause').addEventListener('click',()=>{let s=state.stop;if(s.running){s.elapsed+=Date.now()-s.start;s.running=false}render()});$('stopReset').addEventListener('click',()=>{Object.assign(state.stop,{running:false,elapsed:0,start:0});render()});
$('breathTap').addEventListener('click',()=>{state.breaths.push(Date.now());render()});$('breathUndo').addEventListener('click',()=>{state.breaths.pop();render()});$('breathReset').addEventListener('click',()=>{state.breaths=[];render()});
const pauseFields = [['Matpause', timeParts('mealTime')], ['Skjermpause', timeParts('screenTime')]];
for (const [, field] of pauseFields) field.group.addEventListener('input', () => { $('pauseError').hidden = true; });
const pauseTones = new Set();
function schedulePauseAudio() {
 stopTones(pauseTones);
 if (!state.options.pauseSound || !audio) return;
 const now = Date.now();
 for (const pause of state.pauses) {
   if (pause.notified) continue;
   const start = audio.currentTime + Math.max(.03, (pause.time - now) / 1000);
   for (const [delay, frequency] of pauseNotes) {
     trackTone(pauseTones, tone(start + delay, frequency, .23, .18));
   }
 }
}
$('pauseSave').addEventListener('click', () => {
 const now = Date.now();
 const pauses = [];
 for (const [type, field] of pauseFields) {
   if (field.value() === ':') continue;
   const time = field.read({requireAll:true});
   if (!time) {
     $('pauseError').hidden = false;
     return;
   }
   const [hours, minutes] = time;
   const label = fmt2(hours) + ':' + fmt2(minutes);
   field.write(label);
   const date = new Date(now);
   date.setHours(hours, minutes, 0, 0);
   if (date.getTime() + 60000 <= now) date.setDate(date.getDate() + 1);
   const timeMs = date.getTime();
   const existing = state.pauses.find(pause => pause.field === field && pause.time === timeMs);
   pauses.push({type, field, time:timeMs, label, notified:existing?.notified ?? false});
 }
 $('pauseError').hidden = true;
 state.pauses = pauses;
 if (state.options.pauseSound) getAudio();
 schedulePauseAudio();
 render();
});
$('pauseReset').addEventListener('click', () => {
 $('pauseError').hidden = true;
 state.pauses = [];
 stopTones(pauseTones);
 for (const [, field] of pauseFields) field.write('');
 render();
});
function renderPauses(now) {
 const due = state.pauses.filter(pause => now >= pause.time);
 for (const pause of due) pause.notified = true;
 for (const [, field] of pauseFields) {
   field.group.closest('.pause-time-row').classList.toggle('due', due.some(pause => pause.field === field));
 }
 document.querySelector('[data-tab="pause"]').classList.toggle('pause-due', !!due.length);
 $('pauseBadge').hidden = !due.length;
 $('pauseBadge').textContent = due.length ? 'NÅ' : '';
 const next = state.pauses.filter(pause => pause.time > now).sort((a,b) => a.time-b.time)[0];
 const message = due.length ? due.map(pause => pause.type).join(' + ') + ' nå'
   : next ? 'Neste: ' + next.type + ' kl. ' + next.label : '';
 if ($('pauseState').textContent !== message) $('pauseState').textContent = message;
}

const defaultLandingDuration = 180000;
const defaultLandingWarning = 90000;
const landingDuration = timeParts('heliDuration');
const landingWarning = timeParts('heliWarning');
for (const entry of [landingDuration, landingWarning]) {
 entry.group.addEventListener('input', () => { $('heliError').hidden = true; });
 entry.group.addEventListener('keydown', event => { if (event.key === 'Enter') $('heliStart').click(); });
}
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
function setLandingError(message) {
 $('heliError').textContent = message;
 $('heliError').hidden = !message;
}
$('heliStart').addEventListener('click', () => {
 if (state.heli.start !== null) return;
 const durationParts = landingDuration.read();
 const warningParts = durationParts && landingWarning.read();
 if (!durationParts || !warningParts) {
   setLandingError('Minutter og sekunder må være mellom 00 og 59.');
   return;
 }
 const duration = durationMs(durationParts);
 const warning = durationMs(warningParts);
 if (!duration || warning >= duration) {
   setLandingError('Varsling må komme før landing. Angi tid fra start i begge feltene.');
   return;
 }
 getAudio();
 setLandingError('');
 Object.assign(state.heli, {start:performance.now(), duration, warning});
 landingWarning.write(formatCountdown(warning));
 render();
});
$('heliReset').addEventListener('click', () => {
 stopLandingSound();
 Object.assign(state.heli, {start:null, lastAlarm:null, acknowledged:false});
 landingDuration.write(formatCountdown(defaultLandingDuration));
 landingWarning.write(formatCountdown(defaultLandingWarning));
 setLandingError('');
 render();
});
$('heliAck').addEventListener('click', () => {
 state.heli.acknowledged = true;
 stopLandingSound();
 render();
});
function renderLanding() {
 const heli = state.heli;
 const active = heli.start !== null;
 const now = performance.now();
 const elapsed = active ? now - heli.start : 0;
 const ms = (active ? heli.duration : defaultLandingDuration) - elapsed;
 const alert = active && elapsed >= heli.warning && !heli.acknowledged;
 if (alert && (heli.lastAlarm === null || now - heli.lastAlarm >= landingRepeat)) {
   heli.lastAlarm = now;
   playLandingSound();
 }
 const time = ms <= -1000 ? '−' + formatCountdown(Math.floor(-ms / 1000) * 1000) : formatCountdown(Math.max(0, ms));
 $('heliTime').textContent = time;
 $('heliTime').hidden = !active;
 landingDuration.group.hidden = active;
 landingWarning.readOnly(active);
 $('heliProgress').max = (active ? heli.duration : defaultLandingDuration) / 1000;
 $('heliProgress').value = Math.min($('heliProgress').max, elapsed / 1000);
 $('heliStartMark').textContent = active ? formatCountdown(heli.duration) + ' Start' : 'Start';
 $('heliWarningMark').textContent = active ? formatCountdown(heli.duration - heli.warning) + ' igjen ved varsel' : 'Varsling';
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
function confirmBeforeLeaving(event) {
 event.preventDefault();
 event.returnValue = '1';
}

window.addEventListener('beforeunload', confirmBeforeLeaving);

function updateActiveClockIndicator(now) {
 const {metro, count, stop, heli, pauses} = state;
 const pausedCountdown = count.paused && count.remaining > 0;
 const hasPendingPause = pauses.some(pause => pause.time > now);
 const hasActiveClock = heli.start !== null || metro.running || count.running ||
   pausedCountdown || stop.running || stop.elapsed > 0 || hasPendingPause;
 document.documentElement.toggleAttribute('data-opsix-active-clock', hasActiveClock);
}

function render(){const now=Date.now(),m=state.metro,c=state.count,s=state.stop;
 if (c.running && remaining() <= 0) finishCountdown();
 const displayedTime = formatCountdown(remaining());
 if (!c.edited && countInput.value() !== displayedTime) countInput.write(displayedTime);
 countInput.readOnly(c.running);
 $('countState').textContent = c.finished ? 'FERDIG' : c.running ? 'Nedtelling pågår' : c.remaining !== c.initial ? 'Pauset' : 'Klar';
 const countAlert = c.finished && state.options.countVisual;
 $('countBox').classList.toggle('finished', countAlert);
 countTab.classList.toggle('count-finished', countAlert);
 const elapsed=s.elapsed+(s.running?now-s.start:0);$('stopDisplay').textContent=fmtStop(elapsed);
 for(const [start,pause,running] of [['metroStart','metroPause',m.running],['countStart','countPause',c.running],['stopStart','stopPause',s.running]]){$(start).disabled=running;$(pause).disabled=!running}
 $('countBadge').hidden=!c.running;$('countBadge').textContent=c.running?displayedTime:'';$('stopBadge').hidden=!s.running;$('stopBadge').textContent=fmtStop(elapsed);
 $('breathUndo').disabled = !state.breaths.length;
 let b=state.breaths,age=b.length?now-b[0]:0;$('breathCount').textContent=b.length;$('breathTime').textContent=`Observasjon ${fmtCount(age)} / 01:00`;
 // Et intervallbasert anslag, ikke antall pust x 60/sekunder siden første pust.
 if(b.length>=2&&age>=10000&&b[b.length-1]>b[0]){$('breathRate').textContent=Math.round(60000*(b.length-1)/(b[b.length-1]-b[0]));$('breathStatus').textContent=age>=60000?'60 sekunder passert':'Foreløpig estimat'}else{$('breathRate').textContent='–';$('breathStatus').textContent=b.length?'Avventer 2 pust og 10 sekunder':'Ikke startet'}$('breathBox').classList.toggle('observed',age>=60000);
 renderPauses(now);
 updateActiveClockIndicator(now);
 const landingTime = renderLanding();
 const title = c.running ? formatCountdown(remaining()) + ' | Nedtelling'
   : c.finished && state.options.countVisual ? 'Ferdig | Nedtelling'
   : landingTime ? landingTime + ' | Landingsvarsel RH' : baseTitle;
 if (document.title !== title) document.title = title;
 const active=[m.running?'Metronom':'',c.running?'Nedtelling':'',s.running?'Stoppeklokke':'',landingTime?'Helikoptervarsling':''].filter(Boolean);$('activityText').textContent=active.length?`Aktiv: ${active.join(', ')}`:'Ingen aktive klokker';document.querySelector('.live-dot').classList.toggle('on',active.length>0);
}
setInterval(()=>{scheduleMetro();render()},60);
document.addEventListener('visibilitychange', render);
window.addEventListener('focus', render);

setMode('voksen');render();
requestAnimationFrame(drawBeatCursor);
})();