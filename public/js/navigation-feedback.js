(function(){
  if(window.__contrataeNavigationFeedback) return; window.__contrataeNavigationFeedback=true;
  const style=document.createElement('style');
  style.textContent='.contratae-nav-progress{position:fixed;z-index:99999;left:0;top:0;height:3px;width:0;background:#ffb020;box-shadow:0 0 14px rgba(255,176,32,.72);opacity:0;transition:width .18s ease,opacity .16s ease}.contratae-nav-progress.active{opacity:1;animation:contrataeProgress 1.4s ease-in-out infinite}@keyframes contrataeProgress{0%{width:8%}55%{width:72%}100%{width:92%}}@media(prefers-reduced-motion:reduce){.contratae-nav-progress.active{animation:none;width:70%}}';
  document.head.appendChild(style);
  const bar=document.createElement('div'); bar.className='contratae-nav-progress'; bar.setAttribute('aria-hidden','true'); document.body.appendChild(bar);
  let timer=null;
  function start(el,label){bar.classList.add('active'); if(timer)clearTimeout(timer); timer=setTimeout(()=>bar.classList.add('active'),80); if(el&&label){el.dataset.originalLoadingHtml=el.innerHTML; el.innerHTML='<i class="fas fa-spinner fa-spin"></i> '+label; el.style.pointerEvents='none'; el.setAttribute('aria-busy','true');}}
  function stop(){bar.classList.remove('active');bar.style.width='0';document.querySelectorAll('[data-original-loading-html]').forEach(el=>{el.innerHTML=el.dataset.originalLoadingHtml;delete el.dataset.originalLoadingHtml;el.style.pointerEvents='';el.removeAttribute('aria-busy')})}
  window.addEventListener('pageshow',stop); window.addEventListener('pagehide',()=>bar.classList.add('active'));
  document.addEventListener('click',function(e){
    const a=e.target.closest('a[href]'); if(!a||a.getAttribute('aria-disabled')==='true'||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==='_blank'||a.hasAttribute('download'))return;
    let url; try{url=new URL(a.href,location.href)}catch(_){return} if(url.origin!==location.origin||url.hash&&url.pathname===location.pathname&&url.search===location.search)return;
    const label=a.dataset.loadingLabel||'Carregando...'; start(a,label);
  },true);
  document.addEventListener('submit',function(e){const form=e.target;if(!(form instanceof HTMLFormElement)||e.defaultPrevented)return;const b=form.querySelector('button[type="submit"],input[type="submit"]');if(b&&b.tagName==='BUTTON')start(b,b.dataset.loadingLabel||'Processando...');else start();},true);
  window.ContrataeNavigationFeedback={start,stop};
})();
