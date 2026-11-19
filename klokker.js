(() => {
'use strict';
const tool = document.getElementById('clockTool');
const $ = id => tool.querySelector('#' + id) ?? document.getElementById(id);
const CONFIG={
  feedbackUrl:'mailto:b32838@ous-hf.no?subject=Tilbakemelding%20OPSIX%20klokkeverkt%C3%B8y'
};
const fmt2=n=>String(Math.max(0,Math.floor(n))).padStart(2,'0');
const fmtCount=ms=>{let s=Math.ceil(Math.max(0,ms)/1000);return `${fmt2(Math.floor(s/60))}:${fmt2(s%60)}`};
const fmtStop=ms=>{let s=Math.floor(Math.max(0,ms)/1000);return `${fmt2(s/3600)}:${fmt2(Math.floor(s/60)%60)}:${fmt2(s%60)}`};
let audio;
function getAudio(resume = true){try{audio ||= new (window.AudioContext||window.webkitAudioContext)();if(resume && audio.state==='suspended')audio.resume().catch(()=>{});return audio}catch{return null}}
function tone(time,frequency=800,duration=.08,volume=.12,type='sine'){
 const a=getAudio();if(!a)return;try{const o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.value=frequency;g.gain.setValueAtTime(.0001,time);g.gain.exponentialRampToValueAtTime(volume,time+.009);g.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(g).connect(a.destination);o.start(time);o.stop(time+duration+.02);return o}catch{}
}
const alertRepeat = 8000;
const countTones = new Set();
const pauseTones = new Set();
const countdownSignal = [[0,840,.17,.23],[.26,840,.17,.23]];
const pauseSignal = [[0,740,.25,.34],[.33,988,.30,.36],[.72,740,.25,.34]];
function playSignal(notes, tones) {
 const context = getAudio(false);
 if (!context || context.state !== 'running') return false;
 stopTones(tones);
 const start = context.currentTime + .02;
 for (const [delay, frequency, duration, gain] of notes) {
   trackTone(tones, tone(start + delay, frequency, duration, gain, 'triangle'));
 }
 return true;
}
const state={metro:{running:false,mode:'voksen',bpm:110,anchor:0,step:0},count:{running:false,remaining:0,initial:0,end:0,finished:false,paused:false},stop:{running:false,elapsed:0,start:0},breaths:[],options:{countSound:true,pauseSound:true},pauses:[],heli:{start:null,lastAlarm:null,acknowledged:false}};
const modes={voksen:110,nyfodt:120};
const tabs = [...tool.querySelectorAll('[data-tab]')];
const panes = $('clockPanes');
const toolPanels = [...panes.querySelectorAll('.pane')];
const toggleFloatingPane = $('toggleFloatingPane');
let floatingWindow = null;
const defaultStripHeight = 80;
const maximumPanelHeight = 230;
let collapsedFloatingHeight = defaultStripHeight;

const floatingTime = $('floatingTime');
const floatingDate = $('floatingDate');
const osloTime = new Intl.DateTimeFormat('nb-NO', {
 timeZone:'Europe/Oslo', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
});
const osloDate = new Intl.DateTimeFormat('nb-NO', {
 timeZone:'Europe/Oslo', day:'numeric', month:'long', year:'numeric'
});
let displayedSecond;
function renderFloatingClock(now) {
 if (!floatingWindow || Math.floor(now / 1000) === displayedSecond) return;
 displayedSecond = Math.floor(now / 1000);
 floatingTime.textContent = osloTime.format(now).replace(/\./g, ':');
 floatingDate.textContent = osloDate.format(now);
}
let lastTool = tabs.find(button => button.classList.contains('active')).dataset.tab;
let activeTool = lastTool;

function tab(id) {
 activeTool = id;
 if (id) lastTool = id;
 for (const button of tabs) {
   const selected = button.dataset.tab === id;
   button.classList.toggle('active', selected);
   button.setAttribute('aria-selected', String(selected));
 }
 for (const pane of toolPanels) {
   pane.hidden = pane.id !== id;
   pane.inert = pane.hidden;
 }
 if (floatingWindow) {
   panes.hidden = !id;
   tool.classList.toggle('floating-expanded', !!id);
   toggleFloatingPane.textContent = id ? 'Kollaps' : 'Utvid';
   toggleFloatingPane.setAttribute('aria-expanded', String(!!id));
   toggleFloatingPane.setAttribute('aria-label', id ? 'Skjul verktøypanelet' : 'Vis sist brukte verktøy');
 }
}

function panelOpensAbove(popup) {
 const {screenY, outerHeight, screen} = popup;
 const {availTop, availHeight} = screen;
 if (![screenY, availTop, availHeight].every(Number.isFinite) || availHeight <= 0) return false;
 const railCenter = screenY + (outerHeight || popup.innerHeight) / 2;
 return railCenter > availTop + availHeight / 2;
}

function toggleTool(id) {
 const wasOpen = !!activeTool;
 if (floatingWindow && !wasOpen && id) {
   collapsedFloatingHeight = floatingWindow.innerHeight;
   tool.classList.toggle('floating-panel-above', panelOpensAbove(floatingWindow));
 }
 tab(id);
 if (!floatingWindow || (!id && !wasOpen)) return;
 const availableHeight = floatingWindow.screen.availHeight;
 const limit = Math.min(maximumPanelHeight, Math.floor((availableHeight || 900) / 3));
 const panelHeight = id ? Math.min($(id).offsetHeight + 2, limit) : 0;
 const difference = collapsedFloatingHeight + panelHeight - floatingWindow.innerHeight;
 try {
   if (difference) floatingWindow.resizeBy(0, difference);
 } catch {
   // The browser can limit resizing. The window can still be resized manually.
 }
}
for (const button of tabs) {
 button.addEventListener('click', () => {
   const id = button.dataset.tab;
   if (id === 'pause' && pendingPauseAlarms.size > 0) {
     acknowledgePause();
     toggleTool(id);
     return;
   }
   toggleTool(floatingWindow && activeTool === id ? null : id);
 });
}
toggleFloatingPane.addEventListener('click', () => toggleTool(activeTool ? null : lastTool));

const floatingNotice = $('floatingNotice');
const floatingError = $('floatingError');
const floatingLaunch = $('openFloating');
const clockStylesheet = document.querySelector('link[rel="stylesheet"]').href;
const toolHome = tool.parentNode;
const toolNext = tool.nextSibling;

floatingLaunch.addEventListener('click', async () => {
 floatingError.hidden = true;
 if (!window.documentPictureInPicture || window.top !== window) {
   floatingError.textContent = window.top !== window
     ? 'Åpne Klokkeverktøy i en egen fane for å bruke det flytende vinduet.'
     : 'Nettleseren støtter ikke flytende verktøy. Du kan fortsette å bruke denne fanen.';
   floatingError.hidden = false;
   return;
 }
 if (floatingWindow) return;
 floatingLaunch.disabled = true;
 if (state.options.countSound || state.options.pauseSound) getAudio();
 try {
   const popup = await window.documentPictureInPicture.requestWindow({
     width: Math.min(720, Math.round(window.screen.availWidth * .9)),
     height: defaultStripHeight
   });
   floatingWindow = popup;
   const popupDocument = popup.document;
   popupDocument.documentElement.lang = document.documentElement.lang;
   popupDocument.title = 'OPSIX Klokkeverktøy';

   const stylesheet = popupDocument.createElement('link');
   stylesheet.rel = 'stylesheet';
   stylesheet.href = clockStylesheet;
   const stylesheetReady = new Promise((resolve, reject) => {
     stylesheet.addEventListener('load', () => resolve(true), {once:true});
     stylesheet.addEventListener('error', () => reject(new Error('Kunne ikke laste vindusstilen.')), {once:true});
     popup.addEventListener('pagehide', () => resolve(false), {once:true});
   });
   popup.addEventListener('pagehide', () => {
     if (floatingWindow !== popup) return;
     floatingWindow = null;
     if (tool.ownerDocument !== popupDocument) return;
     tool.classList.remove('floating-expanded', 'floating-panel-above');
     toolHome.insertBefore(tool, toolNext);
     panes.hidden = false;
     toggleFloatingPane.hidden = true;
     $('floatingClock').hidden = true;
     floatingNotice.hidden = true;
     tab(lastTool);
     runClockUpdates(window);
     floatingLaunch.focus();
   }, {once:true});
   popupDocument.head.append(stylesheet);
   if (!(await stylesheetReady) || popup.closed || floatingWindow !== popup) return;

   popupDocument.body.classList.add('floating-clocks');
   syncFloatingAppearance();
   tab(null);
   toggleFloatingPane.hidden = false;
   $('floatingClock').hidden = false;
   renderFloatingClock(Date.now());
   popupDocument.body.append(tool);
   floatingNotice.hidden = false;
   runClockUpdates(popup);
   tabs[0].focus();
 } catch {
   floatingWindow?.close();
   floatingError.textContent = 'Kunne ikke åpne flytende verktøy. Du kan fortsette å bruke denne fanen.';
   floatingError.hidden = false;
 } finally {
   floatingLaunch.disabled = false;
 }
});
$('returnFloating').addEventListener('click', () => floatingWindow?.close());

function syncFloatingAppearance() {
 if (!floatingWindow) return;
 floatingWindow.document.body.dataset.theme = document.body.dataset.theme;
 floatingWindow.document.body.dataset.textSize = document.body.dataset.textSize;
}
$('openWindow').addEventListener('click',()=>window.open(location.href,'_blank','width=460,height=820,resizable=yes,scrollbars=yes'));
const settings = $('clockSettings');
const settingsToggle = $('settingsToggle');
function showSettings(open) {
 settings.hidden = !open;
 settingsToggle.setAttribute('aria-expanded', String(open));
}
settingsToggle.addEventListener('click', () => showSettings(settings.hidden));
settings.addEventListener('keydown', event => {
 if (event.key !== 'Escape') return;
 event.stopPropagation();
 showSettings(false);
 settingsToggle.focus();
});

const theme = $('theme');
const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
 document.body.dataset.theme = theme.value === 'system'
   ? (darkMode.matches ? 'natt' : 'dag')
   : theme.value;
 syncFloatingAppearance();
}
applyTheme();
theme.addEventListener('change', applyTheme);
darkMode.addEventListener('change', applyTheme);
const textSize = $('textSize');
try {
 const preference = localStorage.getItem('opsix-clocks-text');
 if (['normal','large','extra'].includes(preference)) textSize.value = preference;
} catch {}
document.body.dataset.textSize = textSize.value;
textSize.addEventListener('change', () => {
 document.body.dataset.textSize = textSize.value;
 syncFloatingAppearance();
 try { localStorage.setItem('opsix-clocks-text', textSize.value); } catch {}
});
function setMode(mode){const m=state.metro;m.mode=mode;m.bpm=modes[mode];$('metronomeHint').hidden=mode!=='nyfodt';tool.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));$('bpmAdjust').hidden=mode==='nyfodt';$('bpmLabel').disabled=mode==='nyfodt';$('bpmLabel').title=mode==='nyfodt'?'Fast 3:1-rytme':'Klikk for å endre takt';$('bpmDirect').hidden=true;$('bpmLabel').hidden=false;updateBpmView();restartMetroCycle();$('ecgFourth').toggleAttribute('hidden',mode==='nyfodt');$('ecgVent').toggleAttribute('hidden',mode!=='nyfodt')}
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
tool.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
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
 if (state.metro.running) {
   state.metro.running = false;
   stopTones(metroTones);
   render();
   return;
 }
 if (!getAudio()) { alert('Lyd støttes ikke av denne nettleseren.'); return; }
 state.metro.running = true;
 restartMetroCycle();
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
   trackTone(metroTones, tone(when, ventilation ? 500 : 880, duration, ventilation ? .468 : .442));
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
 clockFrame = clockWindow.requestAnimationFrame(drawBeatCursor);
}

function timeParts(id) {
 const group = $(id);
 const inputs = [...group.querySelectorAll('input')];
 const stepButtons = group.querySelectorAll('[data-step]');
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
     if (input.readOnly) return;
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
   read({requireAll = false, silent = false} = {}) {
     const invalid = inputs.find(input =>
       (requireAll && !input.value) || (input.value && (!/^\d{1,2}$/.test(input.value) || Number(input.value) > Number(input.dataset.max)))
     );
     if (invalid) {
       if (!silent) {
         invalid.setAttribute('aria-invalid','true');
         invalid.focus();
       }
       return null;
     }
     return inputs.map(input => Number(input.value));
   },
   readOnly(value) {
     for (const input of inputs) input.readOnly = value;
     for (const button of stepButtons) button.disabled = value;
   }
 };
}
const durationMs = ([hours, minutes, seconds]) => (hours * 3600 + minutes * 60 + seconds) * 1000;
const countInput = timeParts('countDisplay');
const baseTitle = document.title;
const countTab = document.querySelector('[data-tab="nedtelling"]');
const countBox = $('countBox');
const countSoundButtons = tool.querySelectorAll('[data-setting="countSound"] button');
for (const group of document.querySelectorAll('.adjustable-time')) {
 group.addEventListener('click', event => {
   const button = event.target.closest('[data-step]');
   if (!button || button.disabled) return;
   const input = button.closest('.time-segment').querySelector('input');
   if (input.readOnly) return;
   const limit = Number(input.dataset.max);
   const next = Math.max(0, Math.min(limit, Number(input.value) + Number(button.dataset.step)));
   input.value = fmt2(next);
   group.dispatchEvent(new Event('input', {bubbles:true}));
 });
}
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
 state.count.lastAlarm = null;
 countBox.classList.remove('count-flash');
 stopTones(countTones);
}
countInput.group.addEventListener('input', () => {
 if (state.count.running || state.count.finished) return;
 clearCountAlert();
 state.count.edited = true;
 $('countError').hidden = true;
 render();
});
countInput.group.addEventListener('keydown', event => {
 if (event.key === 'Enter' && event.target.matches('input') && !state.count.running) $('countStart').click();
});
$('countStart').addEventListener('click', () => {
 const countdown = state.count;
 if (countdown.running) {
   pauseCountdown(countdown);
   return;
 }
 if (countdown.finished) return;
 if (countdown.edited) {
   const parts = countInput.read();
   $('countError').hidden = !!parts;
   if (!parts) return;
   countdown.initial = countdown.remaining = durationMs(parts);
   countdown.edited = false;
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
 countdown.lastAlarm = null;
 if (!$('nedtelling').hidden) countBox.classList.add('count-flash');
}
function pauseCountdown(countdown) {
 countdown.remaining = remaining();
 if (!countdown.remaining) finishCountdown();
 else {
   countdown.running = false;
   countdown.paused = true;
 }
 render();
}
$('countReset').addEventListener('click', () => {
 clearCountAlert();
 Object.assign(state.count, {running:false, remaining:0, initial:0, edited:false, paused:false});
 $('countError').hidden = true;
 render();
});
for(const holder of document.querySelectorAll('[data-setting]'))holder.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{const opt=holder.dataset.setting;state.options[opt]=b.dataset.value==='yes';if(opt==='pauseSound'){if(state.options.pauseSound) unlockPauseAudio();else stopTones(pauseTones)}render();holder.querySelectorAll('button').forEach(other=>{const sel=other===b;other.classList.toggle('selected',sel);other.setAttribute('aria-pressed',String(sel))})}));
$('stopStart').addEventListener('click', () => {
 const stopwatch = state.stop;
 const now = Date.now();
 if (stopwatch.running) {
   stopwatch.elapsed += now - stopwatch.start;
 } else {
   stopwatch.start = now;
 }
 stopwatch.running = !stopwatch.running;
 render();
});
$('stopReset').addEventListener('click', () => {
 Object.assign(state.stop, {running:false, elapsed:0, start:0});
 render();
});
$('breathTap').addEventListener('click',()=>{state.breaths.push(Date.now());render()});$('breathUndo').addEventListener('click',()=>{state.breaths.pop();render()});$('breathReset').addEventListener('click',()=>{state.breaths=[];render()});
const pauseFields = [['Matpause', timeParts('mealTime')], ['Skjermpause', timeParts('screenTime')]];
const pauseSoundButtons = tool.querySelectorAll('[data-setting="pauseSound"] button');
const pendingPauseAlarms = new Set();
const pauseSignalLimit = 3;
let pauseAlarmStarted = null;
let pauseSoundSlot = -1;

async function unlockPauseAudio() {
 if (!state.options.pauseSound) return;
 const context = getAudio(false);
 try {
   if (context && context.state !== 'running') await context.resume();
 } catch {}
 $('pauseSoundError').hidden = context?.state === 'running' || !state.options.pauseSound;
}

function savePause(type, field, parts, now) {
 const [hours, minutes] = parts;
 const date = new Date(now);
 date.setHours(hours, minutes, 0, 0);
 if (date.getTime() + 60000 <= now) date.setDate(date.getDate() + 1);
 const time = date.getTime();
 const previous = state.pauses.find(pause => pause.field === field);
 if (previous?.time === time) return;
 const label = fmt2(hours) + ':' + fmt2(minutes);
 state.pauses = state.pauses.filter(pause => pause.field !== field);
 state.pauses.push({type, field, time, label, triggered:false});
}

for (const [type, field] of pauseFields) {
 field.group.addEventListener('input', () => {
   $('pauseError').hidden = true;
   if (!/^\d{2}:\d{2}$/.test(field.value())) return;
   const parts = field.read({requireAll:true, silent:true});
   if (!parts) return;
   unlockPauseAudio();
   savePause(type, field, parts, Date.now());
   render();
 });
}

$('pauseSave').addEventListener('click', () => {
 const now = Date.now();
 const entries = [];
 for (const [type, field] of pauseFields) {
   const parts = field.value() === ':' ? [] : field.read({requireAll:true});
   if (!parts) {
     $('pauseError').hidden = false;
     return;
   }
   entries.push([type, field, parts]);
 }
 for (const [type, field, parts] of entries) {
   if (parts.length) {
     field.write(parts.map(fmt2).join(':'));
     savePause(type, field, parts, now);
   } else {
     state.pauses = state.pauses.filter(pause => pause.field !== field);
   }
 }
 $('pauseError').hidden = true;
 unlockPauseAudio();
 render();
});
function acknowledgePause() {
 pendingPauseAlarms.clear();
 pauseAlarmStarted = null;
 pauseSoundSlot = -1;
 stopTones(pauseTones);
 render();
}
$('pauseReset').addEventListener('click', () => {
 $('pauseError').hidden = true;
 $('pauseSoundError').hidden = true;
 state.pauses = [];
 for (const [, field] of pauseFields) field.write('');
 acknowledgePause();
});
function renderPauses(now) {
 for (const pause of state.pauses) {
   if (pause.triggered || now < pause.time) continue;
   pause.triggered = true;
   pendingPauseAlarms.add(pause);
   if (pauseAlarmStarted === null || now - pauseAlarmStarted >= alertRepeat * pauseSignalLimit) {
     pauseAlarmStarted = now;
     pauseSoundSlot = -1;
   }
 }
 if (pauseAlarmStarted !== null) {
   const slot = Math.floor((now - pauseAlarmStarted) / alertRepeat);
   if (slot >= pauseSignalLimit) {
     pendingPauseAlarms.clear();
     pauseAlarmStarted = null;
     stopTones(pauseTones);
   } else if (state.options.pauseSound && slot > pauseSoundSlot && playSignal(pauseSignal, pauseTones)) {
     pauseSoundSlot = slot;
   }
 }
 const due = pendingPauseAlarms.size > 0;
 $('pauseBox').classList.toggle('pause-due', due);
 tool.querySelector('[data-tab="pause"]').classList.toggle('pause-due', due);
 for (const button of pauseSoundButtons) button.disabled = due && state.options.pauseSound;
 $('pauseBadge').hidden = !due;
 $('pauseBadge').textContent = due ? 'NÅ' : '';
 const message = due ? [...new Set([...pendingPauseAlarms].map(pause => pause.type))].join(' + ') + ' nå' : '';
 if ($('pauseState').textContent !== message) $('pauseState').textContent = message;
}

const defaultLandingDuration = 180000;
const defaultLandingWarning = 90000;
const landingDuration = timeParts('heliDuration');
const landingWarning = timeParts('heliWarning');
for (const entry of [landingDuration, landingWarning]) {
 entry.group.addEventListener('input', () => {
   setLandingError('');
   render();
 });
 entry.group.addEventListener('keydown', event => {
   if (event.key === 'Enter' && event.target.matches('input')) $('heliStart').click();
 });
}
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
 const sourceParts = landingDuration.read();
 const warningParts = sourceParts && landingWarning.read();
 if (!sourceParts || !warningParts) {
   setLandingError('Kontroller timer, minutter og sekunder.');
   return;
 }
 const duration = durationMs(sourceParts);
 if (duration <= 0) {
   setLandingError('Angi tid igjen til landing.');
   return;
 }
 const warning = durationMs(warningParts);
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
 const alert = active && ms <= heli.warning && !heli.acknowledged;
 if (alert && (heli.lastAlarm === null || now - heli.lastAlarm >= alertRepeat)) {
   heli.lastAlarm = now;
   playLandingSound();
 }
 const time = ms <= -1000 ? '−' + formatCountdown(Math.floor(-ms / 1000) * 1000) : formatCountdown(Math.max(0, ms));
 $('heliTime').textContent = time;
 $('heliTime').hidden = !active;
 landingDuration.group.hidden = active;
 landingWarning.readOnly(active);
 const durationParts = landingDuration.read({silent:true});
 const timelineDuration = active ? heli.duration : durationParts ? durationMs(durationParts) : defaultLandingDuration;
 const warningParts = landingWarning.read({silent:true});
 const warningLead = active ? heli.warning : warningParts ? durationMs(warningParts) : defaultLandingWarning;
 const warningPosition = timelineDuration > 0
   ? 100 * Math.max(0, timelineDuration - warningLead) / timelineDuration : 0;
 const markerPosition = warningPosition + '%';
 const timeline = $('heliTimeline');
 if (timeline.style.getPropertyValue('--warning-position') !== markerPosition) {
   timeline.style.setProperty('--warning-position', markerPosition);
 }
 $('heliProgress').max = Math.max(1, timelineDuration / 1000);
 $('heliProgress').value = Math.min($('heliProgress').max, elapsed / 1000);
 $('heliBox').classList.toggle('heli-alert', alert);
 $('heliBox').classList.toggle('heli-overtime', ms <= -1000 && !alert);
 $('heliAlarm').hidden = $('heliAck').hidden = !alert;
 $('heliStart').disabled = active;
 $('heliStart').hidden = alert;
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
   pausedCountdown || count.finished || stop.running || stop.elapsed > 0 || hasPendingPause || pendingPauseAlarms.size > 0;
 document.documentElement.toggleAttribute('data-opsix-active-clock', hasActiveClock);
}

function updateClockButton(id, label) {
 const button = $(id);
 if (button.textContent !== label) button.textContent = label;
}

function render(){const now=Date.now(),m=state.metro,c=state.count,s=state.stop;
 if (c.running && remaining() <= 0) finishCountdown();
 const displayedTime = formatCountdown(remaining());
 if (!c.edited && countInput.value() !== displayedTime) countInput.write(displayedTime);
 countInput.readOnly(c.running || c.finished);
 if (c.finished && state.options.countSound && (c.lastAlarm === null || now - c.lastAlarm >= alertRepeat)) {
   if (playSignal(countdownSignal, countTones)) c.lastAlarm = now;
 }
 const countMessage = c.running ? 'Nedtelling pågår' : c.paused ? 'Pauset' : '';
 $('countState').textContent = countMessage;
 $('countState').hidden = !countMessage;
 const countAlert = c.finished;
 $('countBox').classList.toggle('finished', countAlert);
 countTab.classList.toggle('count-finished', countAlert);
 const elapsed=s.elapsed+(s.running?now-s.start:0);$('stopDisplay').textContent=fmtStop(elapsed);
 $('countBadge').hidden=!c.running;$('countBadge').textContent=c.running?displayedTime:'';$('stopBadge').hidden=!s.running;$('stopBadge').textContent=fmtStop(elapsed);
 $('breathUndo').disabled = !state.breaths.length;
 let b=state.breaths,age=b.length?now-b[0]:0;$('breathCount').textContent=b.length;$('breathTime').textContent=`Observasjon ${fmtCount(age)} / 01:00`;
 // Et intervallbasert anslag, ikke antall pust x 60/sekunder siden første pust.
 const hasBreathEstimate = b.length >= 2 && age >= 10000 && b[b.length - 1] > b[0];
 $('breathRate').textContent = hasBreathEstimate ? Math.round(60000 * (b.length - 1) / (b[b.length - 1] - b[0])) : '–';
 $('breathBox').classList.toggle('observed', age >= 60000);
 renderPauses(now);
 updateActiveClockIndicator(now);
 updateClockButton('metroStart', m.running ? '■ Stopp' : '▶ Start');
 updateClockButton('countStart', c.running ? 'Ⅱ Pause' : c.paused ? '▶ Fortsett' : '▶ Start');
 updateClockButton('stopStart', s.running ? 'Ⅱ Pause' : s.elapsed > 0 ? '▶ Fortsett' : '▶ Start');
 $('countStart').disabled = c.finished;
 for (const button of countSoundButtons) button.disabled = c.finished && state.options.countSound;
 renderFloatingClock(now);
 const landingTime = renderLanding();
 const title = c.running ? formatCountdown(remaining()) + ' | Nedtelling'
   : c.finished ? 'Ferdig | Nedtelling'
   : landingTime ? landingTime + ' | Landingsvarsel RH' : baseTitle;
 if (document.title !== title) document.title = title;
}
let clockWindow = window;
let clockInterval;
let clockFrame;
function runClockUpdates(target) {
 clockWindow.clearInterval(clockInterval);
 if (clockFrame !== undefined) clockWindow.cancelAnimationFrame(clockFrame);
 clockWindow = target;
 clockInterval = target.setInterval(() => { scheduleMetro(); render(); }, 60);
 clockFrame = target.requestAnimationFrame(drawBeatCursor);
 render();
}
document.addEventListener('visibilitychange', render);
window.addEventListener('focus', render);

setMode('voksen');
runClockUpdates(window);
})();