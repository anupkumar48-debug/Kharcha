// In-app confirmation dialog (Promise<boolean>). Avoids window.confirm, which some WebViews block.
export function ask(message, okLabel = 'Yes') {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'overlay';
    wrap.style.zIndex = 80;
    wrap.innerHTML = `<div class="sheet" role="alertdialog" style="max-width:380px"><p style="margin:0 0 16px;font-weight:600"></p>
      <div class="row"><button class="btn" style="flex:1" data-v="0">Cancel</button><button class="btn primary" style="flex:1" data-v="1"></button></div></div>`;
    wrap.querySelector('p').textContent = message;
    wrap.querySelector('[data-v="1"]').textContent = okLabel;
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) done(b.dataset.v === '1'); else if (e.target === wrap) done(false); });
    document.body.appendChild(wrap);
    wrap.querySelector('[data-v="1"]').focus();
  });
}
