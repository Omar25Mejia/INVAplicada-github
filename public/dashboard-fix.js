// Fix: wait for async dashboard loading and show API errors instead of leaving "Cargando..." forever.
(function(){
  const currentLoadPage=window.loadPage;
  window.loadPage=async function(page){
    if(page!=='dashboard') return currentLoadPage(page);
    state.page='dashboard';
    document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    $('#pageTitle').textContent='Dashboard';
    content.innerHTML='<div class="card empty">Cargando dashboard...</div>';
    try{
      await window.dashboard();
    }catch(error){
      console.error('Dashboard error:',error);
      content.innerHTML=`<div class="card" style="padding:32px;text-align:center"><h3>No se pudo cargar el Dashboard</h3><p style="color:var(--muted);margin:10px 0 20px">${esc(error?.message||'Error de conexión con el servidor')}</p><button class="primary" onclick="loadPage('dashboard')">Reintentar</button></div>`;
    }
  };
})();
