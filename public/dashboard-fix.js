// Stable dashboard/cash UI: uses endpoints that are confirmed to exist in POS v2.
(function(){
  const currentLoadPage=window.loadPage;
  window.loadPage=async function(page){
    if(page!=='dashboard' && page!=='cash') return currentLoadPage(page);
    state.page=page;
    document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
    $('#pageTitle').textContent=page==='dashboard'?'Dashboard':'Caja';
    content.innerHTML='<div class="card empty">Cargando...</div>';
    try{
      if(page==='dashboard') await stableDashboard();
      else await stableCash();
    }catch(error){
      console.error(page+' error:',error);
      content.innerHTML=`<div class="card" style="padding:32px;text-align:center"><h3>No se pudo cargar ${page==='dashboard'?'el Dashboard':'Caja'}</h3><p style="color:var(--muted);margin:10px 0 20px">${esc(error?.message||'Error de conexión con el servidor')}</p><button class="primary" onclick="loadPage('${page}')">Reintentar</button></div>`;
    }
  };

  async function stableDashboard(){
    const [sales,products,customers]=await Promise.all([
      api('/api/sales'),api('/api/products'),api('/api/customers')
    ]);
    const now=new Date();
    const days=[];
    for(let i=6;i>=0;i--){
      const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
      const next=new Date(d); next.setDate(next.getDate()+1);
      const total=sales.filter(s=>{const x=new Date(s.created_at);return x>=d&&x<next&&s.status==='completed'}).reduce((a,s)=>a+Number(s.total||0),0);
      days.push({date:d,total});
    }
    const today=days[6];
    const todaySales=sales.filter(s=>{const x=new Date(s.created_at);return x>=today.date&&x<new Date(today.date.getTime()+86400000)&&s.status==='completed'});
    const inventoryValue=products.reduce((a,p)=>a+Number(p.stock||0)*Number(p.cost||0),0);
    const low=products.filter(p=>Number(p.stock||0)<=Number(p.min_stock||0));
    const max=Math.max(...days.map(x=>x.total),1);
    content.innerHTML=`
      <div class="grid stats">
        <div class="card stat"><div class="label">VENTAS DE HOY</div><div class="value">${money(todaySales.reduce((a,s)=>a+Number(s.total||0),0))}</div><div class="hint">${todaySales.length} tickets</div></div>
        <div class="card stat"><div class="label">VALOR DE INVENTARIO</div><div class="value">${money(inventoryValue)}</div><div class="hint">Costo estimado</div></div>
        <div class="card stat"><div class="label">STOCK BAJO</div><div class="value">${low.length}</div><div class="hint">Productos para reponer</div></div>
        <div class="card stat"><div class="label">PRODUCTOS</div><div class="value">${products.length}</div><div class="hint">${customers.length} clientes registrados</div></div>
      </div>
      <div class="grid two" style="margin-top:18px">
        <div class="card"><div class="toolbar"><h3>Ventas últimos 7 días</h3><span class="badge">Datos reales</span></div>
          <div class="chart">${days.map(x=>`<div class="barcol" title="${money(x.total)}"><i style="height:${Math.max(4,x.total/max*175)}px"></i><small>${x.date.toLocaleDateString('es-SV',{weekday:'short'}).replace('.','')}</small></div>`).join('')}</div>
          <div style="text-align:center;font-weight:800;margin-top:8px">Total 7 días: ${money(days.reduce((a,x)=>a+x.total,0))}</div>
        </div>
        <div class="card"><h3>Últimas ventas</h3>
          ${sales.slice(0,5).map(s=>`<div class="cart-row"><span><b>${esc(s.invoice_no)}</b><br><small>${new Date(s.created_at).toLocaleString('es-SV')}</small></span><b>${money(s.total)}</b></div>`).join('')||'<div class="empty">Todavía no hay ventas registradas.</div>'}
        </div>
      </div>`;
  }

  async function stableCash(){
    const cur=await api('/api/cash/current');
    const r=cur.register||null;
    content.innerHTML=`<div class="grid two">
      <div class="card"><div class="toolbar"><h3>Caja actual</h3><span class="badge ${r?'ok':'low'}">${r?'ABIERTA':'CERRADA'}</span></div>
      ${r?`<div class="grid stats"><div class="card stat"><div class="label">FONDO INICIAL</div><div class="value">${money(r.opening_amount)}</div></div><div class="card stat"><div class="label">EFECTIVO ESPERADO</div><div class="value">${money(cur.expected)}</div></div></div><button class="primary" onclick="closeCash()">Cerrar caja</button><button class="icon-btn" onclick="cashMovement()">Entrada / salida</button>`:`<p>La caja está cerrada.</p><button class="primary" onclick="openCash()">Abrir caja</button>`}</div>
      <div class="card"><h3>Información</h3><p style="color:var(--muted);line-height:1.6">El historial detallado de cierres se agregará cuando exista el endpoint correspondiente. La apertura, movimientos, ventas en efectivo y cierre ya funcionan con la caja actual.</p></div>
    </div>`;
  }
})();
