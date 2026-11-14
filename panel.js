(() => {
  'use strict';
  const panel = document.getElementById('opsixToolsPanel');
  const backdrop = document.getElementById('opsixToolsBackdrop');
  const open = document.getElementById('opsixToolsOpen');
  const close = document.getElementById('opsixToolsClose');
  const popout = document.getElementById('opsixToolsPopout');
  if (!panel || !backdrop || !open || !close || !popout) return;

  const frame = document.getElementById('opsixToolsFrame') || panel.querySelector('iframe');

  function hasActiveClock() {
    return frame?.contentDocument?.documentElement.hasAttribute('data-opsix-active-clock') === true;
  }

  function show() {
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    backdrop.hidden = false;
    close.focus();
  }

  function hide() {
    if (hasActiveClock() && !window.confirm(
      'En klokke eller et varsel er aktivt. Vil du skjule sidepanelet? Klokkene fortsetter i bakgrunnen.'
    )) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    open.focus();
  }

  open.addEventListener('click', show);
  close.addEventListener('click', hide);
  backdrop.addEventListener('click', hide);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) hide();
  });
  popout.addEventListener('click', () => {
    window.open('/klokker/', '_blank', 'width=430,height=760,resizable=yes,scrollbars=yes');
  });

  window.addEventListener('beforeunload', event => {
    if (!hasActiveClock()) return;
    event.preventDefault();
    event.returnValue = '1';
  });
})();