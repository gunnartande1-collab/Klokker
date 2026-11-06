(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const modeButtons = [...document.querySelectorAll('[data-mode]')];
  const fmt2 = n => String(Math.max(0, Math.floor(n))).padStart(2,'0');
  const fmtCountdown = ms => { const s=Math.ceil(Math.max(0,ms)/1000);return `${fmt2(Math.floor(s/60))}:${fmt2(s%60)}`; };
  const fmtStop = ms => { const s=Math.floor(Math.max(0,ms)/1000);return `${fmt2(Math.floor(s/3600))}:${fmt2(Math.floor(s/60)%60)}:${fmt2(s%60)}`; };
  const clamp = (n,min,max)=> Math.max(min,Math.min(max,Number.isFinite(n)?n:min));
  let audio=null;
  const getAudio=()=>{ try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); if(audio.state==='suspended')audio.resume().catch(()=>{});return audio; }catch{return null;} };
  function beep(time, freq=880, duration=.065, gain=.15){
    const a=getAudio(); if(!a)return;
    try{const osc=a.createOscillator(),v=a.createGain();osc.type='sine';osc.frequency.value=freq;v.gain.setValueAtTime(.0001,time);v.gain.exponentialRampToValueAtTime(gain,time+.006);v.gain.exponentialRampToValueAtTime(.0001,time+duration);osc.connect(v).connect(a.destination);osc.start(time);osc.stop(time+duration+.01);}catch{}
  }
  const state={
    metro:{running:false,mode:'voksen',bpm:110,next:0,step:0},
    count:{running:false,remaining:180000,endsAt:0,initial:180000,finished:false},
    stop:{running:false,elapsed:0,startedAt:0},
    breaths:[]
  };
  const modes={voksen:{bpm:110,desc:'Voksen: 100–120 kompresjoner/min. Standard 110 BPM.'},barn:{bpm:110,desc:'Barn: 100–120 kompresjoner/min. Følg aktuell HLR-prosedyre.'},spedbarn:{bpm:110,desc:'Spedbarn (utenfor fødsel): 100–120 kompresjoner/min. Følg aktuell HLR-prosedyre.'},nyfodt:{bpm:120,desc:'Nyfødtresuscitering ved fødsel: 3 kompresjoner + 1 ventilasjon, gjentatt 30 ganger/min (90 kompresjoner og 30 ventilasjoner). Ulik tone markerer ventilasjon.'}};
  function showTab(id){tabs.forEach(b=>{const selected=b.dataset.tab===id;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});document.querySelectorAll('.pane').forEach(p=>{const selected=p.id===id;p.hidden=!selected;p.classList.toggle('active',selected);});}
  tabs.forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  $('openWindow').addEventListener('click',()=>{const url=new URL(location.href);window.open(url.href,'_blank','width=430,height=760,resizable=yes,scrollbars=yes');});
  function setMode(mode){state.metro.mode=mode;state.metro.bpm=modes[mode].bpm;state.metro.step=0;modeButtons.forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));$('bpmAdjust').hidden=mode==='nyfodt';$('bpmLabel').innerHTML=mode==='nyfodt'?'3:1 <span>HLR</span>':`${state.metro.bpm} <span>BPM</span>`;$('metronomeHint').textContent=modes[mode].desc;if(state.metro.running)state.metro.next=getAudio()?.currentTime||0;}
  modeButtons.forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
  function updateBpm(v){if(state.metro.mode==='nyfodt')return;state.metro.bpm=clamp(parseInt(v,10),100,120);$('bpmInput').value=state.metro.bpm;$('bpmLabel').innerHTML=`${state.metro.bpm} <span>BPM</span>`;if(state.metro.running)state.metro.next=getAudio()?.currentTime||0;}
  $('bpmDown').addEventListener('click',()=>updateBpm(state.metro.bpm-5));$('bpmUp').addEventListener('click',()=>updateBpm(state.metro.bpm+5));$('bpmInput').addEventListener('change',e=>updateBpm(e.target.value));
  $('metroStart').addEventListener('click',()=>{const a=getAudio();if(!a)return alert('Nettleseren støtter ikke lydfunksjonen.');state.metro.running=true;state.metro.next=a.currentTime+.05;state.metro.step=0;render();});
  $('metroPause').addEventListener('click',()=>{state.metro.running=false;render();});
  $('metroReset').addEventListener('click',()=>{state.metro.running=false;setMode('voksen');render();});
  // Web Audio look-ahead: planlegger lydtikk i lydklokken, ikke med setInterval som taktkilde.
  function scheduleMetro(){const m=state.metro,a=audio;if(!m.running||!a||a.state!=='running')return;const interval=m.mode==='nyfodt'?.5:60/m.bpm;let n=0;while(m.next<a.currentTime+.12 && n++<8){const isVent=m.mode==='nyfodt'&&m.step%4===3;beep(Math.max(m.next,a.currentTime+.005),isVent?510:890,isVent?.16:.065,isVent?.22:.13);m.next+=interval;m.step++;}if(m.next<a.currentTime-.25)m.next=a.currentTime+.02;}
  function countRemaining(){return state.count.running?Math.max(0,state.count.endsAt-Date.now()):state.count.remaining;}
  function updateCountInputs(){const m=clamp(parseInt($('countMinutes').value,10)||0,0,999),s=clamp(parseInt($('countSeconds').value,10)||0,0,59);$('countMinutes').value=m;$('countSeconds').value=s;state.count.initial=(m*60+s)*1000;if(!state.count.running){state.count.remaining=state.count.initial;state.count.finished=false;}render();}
  $('countMinutes').addEventListener('change',updateCountInputs);$('countSeconds').addEventListener('change',updateCountInputs);
  $('countStart').addEventListener('click',()=>{const c=state.count;if(c.running)return;if(c.remaining<=0){updateCountInputs();if(c.remaining<=0)return;}getAudio();c.endsAt=Date.now()+c.remaining;c.running=true;c.finished=false;render();});
  $('countPause').addEventListener('click',()=>{const c=state.count;if(c.running){c.remaining=countRemaining();c.running=false;}render();});
  $('countReset').addEventListener('click',()=>{const c=state.count;c.running=false;c.remaining=c.initial;c.finished=false;render();});
  $('stopStart').addEventListener('click',()=>{const s=state.stop;if(s.running)return;s.startedAt=Date.now();s.running=true;render();});
  $('stopPause').addEventListener('click',()=>{const s=state.stop;if(s.running){s.elapsed+=Date.now()-s.startedAt;s.running=false;}render();});
  $('stopReset').addEventListener('click',()=>{state.stop.running=false;state.stop.elapsed=0;state.stop.startedAt=0;render();});
  $('breathTap').addEventListener('click',()=>{state.breaths.push(Date.now());render();});
  $('breathReset').addEventListener('click',()=>{state.breaths=[];render();});
  function render(){
    const now=Date.now(),c=state.count,s=state.stop,met=state.metro;
    if(c.running&&countRemaining()<=0){c.remaining=0;c.running=false;c.finished=true;const a=getAudio();if(a&&a.state==='running'){[0,.28,.56].forEach(t=>beep(a.currentTime+.03+t,760,.17,.22));}}
    $('countDisplay').textContent=fmtCountdown(countRemaining());$('countState').textContent=c.finished?'Ferdig':c.running?'Nedtelling pågår':'Klar / pauset';
    const stopMs=s.elapsed+(s.running?now-s.startedAt:0);$('stopDisplay').textContent=fmtStop(stopMs);$('stopState').textContent=s.running?'Stoppeklokke pågår':stopMs?'Pauset':'Klar';
    $('countMinutes').disabled=c.running;$('countSeconds').disabled=c.running;
    $('metroStart').disabled=met.running;$('metroPause').disabled=!met.running;$('countStart').disabled=c.running;$('countPause').disabled=!c.running;$('stopStart').disabled=s.running;$('stopPause').disabled=!s.running;
    $('countBadge').hidden=!(c.running||c.finished);$('countBadge').textContent=c.finished?'FERDIG':fmtCountdown(countRemaining());
    $('stopBadge').hidden=!s.running;$('stopBadge').textContent=fmtStop(stopMs);
    const breaths=state.breaths;$('breathCount').textContent=breaths.length;
    // Intervallbasert estimat: første to pust og minst 10 s observasjon før foreløpig RF.
    if(breaths.length>=2 && now-breaths[0]>=10000){const intervals=(breaths[breaths.length-1]-breaths[0])/(breaths.length-1);$('breathRate').textContent=intervals>0?Math.round(60000/intervals):'–';$('breathHint').textContent='Foreløpig intervallbasert estimat. Tell helst i 60 sekunder; vurder også pustemønster og pustekvalitet.';}
    else {$('breathRate').textContent='–';$('breathHint').textContent=breaths.length?'Fortsett å registrere pust. Estimat vises etter minst 2 pust og 10 sekunders observasjon.':'Tell helst i 60 sekunder for å vurdere respirasjonsfrekvens. Observer også pustemønster og pustekvalitet.';}
    const active=[met.running?'Metronom':'',c.running?'Nedtelling':'',s.running?'Stoppeklokke':''].filter(Boolean);$('activityText').textContent=active.length?`Aktiv: ${active.join(', ')}`:'Ingen aktive klokker';document.querySelector('.live-dot').classList.toggle('on',!!active.length);
  }
  // De visuelle tallene beregnes fra reell tid selv om nettleseren forsinker oppdateringene.
  setInterval(()=>{scheduleMetro();render();},50);
  window.addEventListener('beforeunload',e=>{if(state.metro.running||state.count.running||state.stop.running){e.preventDefault();e.returnValue='';}});
  setMode('voksen');render();
})();