(() => {
  'use strict';
  // Brukes bare på hovedsiden, ikke inne i /klokker/.
  const $ = id => document.getElementById(id);
  const panel = $('opsixToolsPanel');
  const backdrop = $('opsixToolsBackdrop');
  const open = $('opsixToolsOpen');
  const close = $('opsixToolsClose');
  const popout = $('opsixToolsPopout');
  if (!panel || !backdrop || !open || !close || !popout) return;
  function show() {panel.classList.add('is-open');panel.setAttribute('aria-hidden','false');backdrop.hidden=false;close.focus();}
  function hide() {panel.classList.remove('is-open');panel.setAttribute('aria-hidden','true');backdrop.hidden=true;open.focus();}
  open.addEventListener('click',show);
  close.addEventListener('click',hide);
  backdrop.addEventListener('click',hide);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.classList.contains('is-open'))hide();});
  popout.addEventListener('click',()=>window.open('/klokker/','_blank','width=430,height=760,resizable=yes,scrollbars=yes'));
})();