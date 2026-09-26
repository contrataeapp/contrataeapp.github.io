(function(){
  if (window.__contrataePublicSearchInit) return;
  window.__contrataePublicSearchInit = true;

  const cache = new Map();
  let controller = null;

  function escapeHtml(value){
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function resultMarkup(item){
    const media = item.avatar
      ? `<img class="public-search-result-avatar" src="${escapeHtml(item.avatar)}" alt="">`
      : `<span class="public-search-result-icon"><i class="fas ${escapeHtml(item.icon || 'fa-briefcase')}"></i></span>`;
    return `<a class="public-search-result" href="${escapeHtml(item.url || '#')}">${media}<span class="public-search-result-copy"><strong>${escapeHtml(item.label || '')}</strong><small>${escapeHtml(item.subtitle || '')}</small></span><i class="fas fa-chevron-right" style="margin-left:auto;color:#7f8996;font-size:12px"></i></a>`;
  }

  async function fetchResults(term){
    const q = String(term || '').trim();
    if (q.length < 2) return [];
    const key = q.toLowerCase();
    if (cache.has(key)) return cache.get(key);
    if (controller) controller.abort();
    controller = new AbortController();
    try {
      const response = await fetch(`/api/public/search-suggestions?q=${encodeURIComponent(q)}`, { signal: controller.signal, headers:{Accept:'application/json'} });
      if (!response.ok) throw new Error('Busca indisponível');
      const payload = await response.json();
      const results = Array.isArray(payload.results) ? payload.results : [];
      cache.set(key, results);
      return results;
    } catch (err) {
      if (err?.name === 'AbortError') return [];
      return [];
    }
  }

  function ensureFloatingBox(input){
    let box = input.parentElement?.querySelector(':scope > .public-search-floating-results');
    if (box) return box;
    const parent = input.parentElement;
    if (!parent) return null;
    const position = getComputedStyle(parent).position;
    if (position === 'static') parent.style.position = 'relative';
    box = document.createElement('div');
    box.className = 'public-search-floating-results';
    box.setAttribute('aria-live','polite');
    parent.appendChild(box);
    return box;
  }

  function installFloatingStyles(){
    if (document.getElementById('contratae-public-search-style')) return;
    const style = document.createElement('style');
    style.id = 'contratae-public-search-style';
    style.textContent = `
      .public-search-floating-results{display:none;position:absolute;left:0;right:0;top:calc(100% + 8px);z-index:1900;padding:7px;background:#17191e;border:1px solid #343943;border-radius:14px;box-shadow:0 20px 50px rgba(0,0,0,.45);max-height:360px;overflow:auto}
      .public-search-floating-results.open{display:grid;gap:6px}
      .public-search-result{display:flex;align-items:center;gap:10px;min-height:52px;padding:9px 11px;border:1px solid #30353d;background:#202329;border-radius:11px;color:#fff;text-decoration:none;text-align:left}
      .public-search-result:hover,.public-search-result:focus{border-color:#ffb020;outline:none;background:#262a31}
      .public-search-result-icon,.public-search-result-avatar{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:0 0 36px;background:rgba(255,176,32,.12);color:#ffb020;object-fit:cover}
      .public-search-result-copy{min-width:0}.public-search-result-copy strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.public-search-result-copy small{display:block;color:#aeb7c4;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px}
      body.light-mode .public-search-floating-results{background:#fff;border-color:#d8dee7;box-shadow:0 18px 42px rgba(0,0,0,.15)}
      body.light-mode .public-search-result{background:#fff;color:#222a35;border-color:#e0e4ea}body.light-mode .public-search-result:hover,body.light-mode .public-search-result:focus{background:#fff7e8;border-color:#e59a22}
      @media(max-width:900px){.public-search-floating-results{position:fixed;left:12px;right:12px;top:76px;max-height:62vh}}
    `;
    document.head.appendChild(style);
  }

  function setupSearchInput(input, options={}){
    if (!input || input.dataset.publicSearchBound === '1') return;
    input.dataset.publicSearchBound = '1';
    let timer = null;
    const explicitResults = options.results || null;
    const box = explicitResults || ensureFloatingBox(input);
    let lastResults = [];

    async function update(){
      const term = input.value.trim();
      if (term.length < 2){
        lastResults = [];
        if (box){ box.innerHTML=''; box.classList.remove('open'); }
        return;
      }
      if (box){ box.innerHTML='<div style="padding:10px;color:#9fa9b6;font-size:12px"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>'; box.classList.add('open'); }
      const results = await fetchResults(term);
      lastResults = results;
      if (!box) return;
      if (results.length){
        box.innerHTML = results.map(resultMarkup).join('');
      } else {
        box.innerHTML = `<div style="padding:12px;color:#aab3bf;font-size:12px">Nenhum resultado imediato. Pressione Enter para ver todas as categorias relacionadas a “${escapeHtml(term)}”.</div>`;
      }
      box.classList.add('open');
    }

    input.addEventListener('input',()=>{
      clearTimeout(timer);
      timer = setTimeout(update, 170);
    });
    input.addEventListener('focus',()=>{ if(input.value.trim().length>=2) update(); });
    input.addEventListener('keydown',ev=>{
      if (ev.key === 'Escape'){ box?.classList.remove('open'); return; }
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const first = lastResults[0];
      if (first?.url){
        window.ContrataeNavigationFeedback?.start(input,'Abrindo resultado...');
        location.href = first.url;
      } else if (input.value.trim()) {
        location.href = `/outros?busca=${encodeURIComponent(input.value.trim())}`;
      }
    });
    document.addEventListener('click',ev=>{
      if (!box || box.contains(ev.target) || input.contains(ev.target)) return;
      box.classList.remove('open');
    });
    return { submit: async()=>{
      const term=input.value.trim(); if(!term) return;
      if (!lastResults.length) lastResults=await fetchResults(term);
      if (lastResults[0]?.url) location.href=lastResults[0].url;
      else location.href=`/outros?busca=${encodeURIComponent(term)}`;
    }};
  }

  function init(){
    installFloatingStyles();

    document.querySelectorAll('.search-input-pill').forEach(input=>{
      const api=setupSearchInput(input);
      const button=input.parentElement?.querySelector('.search-btn-round');
      button?.addEventListener('click',()=>api?.submit());
    });

    document.querySelectorAll('.search-input').forEach(input=>{
      const api=setupSearchInput(input);
      const button=input.parentElement?.querySelector('.search-btn');
      button?.addEventListener('click',()=>api?.submit());
    });

    document.querySelectorAll('[data-public-search-overlay]').forEach(overlay=>{
      const input=overlay.querySelector('[data-public-search-input]');
      const results=overlay.querySelector('[data-public-search-results]');
      setupSearchInput(input,{results});
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
