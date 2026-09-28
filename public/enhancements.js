// Mejoras visuales y operativas del POS
(function(){
  const baseLoad=window.loadPage;
  window.loadPage=async function(p){
    if(p==='cash'){state.page=p;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#pageTitle').textContent='Caja';content.innerHTML='<div class="card empty">Cargando caja...</div>';try{await renderCashPro()}catch(e){toast(e.message,true)}return}
    return baseLoad(p);
  };

  window.dashboard=async function(){
    content.innerHTML='<div class="card empty">Cargando dashboard...</div>';
    try{
      const [sales,products,customers]=await Promise.all([api('/api/sales'),api('/api/products'),api('/api/customers')]);
      const now=new Date(); const days=[];
      for(let i=6;i>=0;i--){const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-i);days.push(d)}
      const chart=days.map(d=>{const key=d.toLocaleDateString('en-CA');const total=sales.filter(s=>{const x=new Date(s.created_at);return x.toLocaleDateString('en-CA')===key&&s.status==='completed'}).reduce((a,s)=>a+Number(s.total||0),0);return {date:d,label:d.toLocaleDateString('es-SV',{weekday:'short'}).replace('.',''),total}});
      const todayKey=now.toLocaleDateString('en-CA');
      const todaySales=sales.filter(s=>new Date(s.created_at).toLocaleDateString('en-CA')===todayKey&&s.status==='completed');
      const todayTotal=todaySales.reduce((a,s)=>a+Number(s.total||0),0);
      const stockValue=products.reduce((a,p)=>a+Number(p.stock||0)*Number(p.cost||0),0);
      const low=products.filter(p=>Number(p.stock)<=Number(p.min_stock)).length;
      const max=Math.max(...chart.map(x=>x.total),1);
      content.innerHTML=`<div class="grid stats"><div class="card stat"><div class="label">VENTAS DE HOY</div><div class="value">${money(todayTotal)}</div><div class="hint">${todaySales.length} tickets</div></div><div class="card stat"><div class="label">VALOR DE INVENTARIO</div><div class="value">${money(stockValue)}</div><div class="hint">Costo estimado</div></div><div class="card stat"><div class="label">STOCK BAJO</div><div class="value">${low}</div><div class="hint">Productos para reponer</div></div><div class="card stat"><div class="label">PRODUCTOS</div><div class="value">${products.length}</div><div class="hint">${customers.length} clientes registrados</div></div></div><div class="grid two" style="margin-top:18px"><div class="card"><div class="toolbar"><div><h3 style="margin:0">Ventas de los últimos 7 días</h3><small style="color:var(--muted)">Ventas registradas en el sistema</small></div><span class="badge">${money(chart.reduce((a,x)=>a+x.total,0))}</span></div><div class="chart">${chart.map(x=>`<div class="barcol" title="${x.label}: ${money(x.total)}"><i style="height:${Math.max(6,Number(x.total)/max*175)}px"></i><small>${esc(x.label)}</small></div>`).join('')}</div></div><div class="card"><div class="toolbar"><h3>Resumen reciente</h3><span class="badge">${sales.length} ventas</span></div>${sales.slice(0,5).map(s=>`<div class="cart-row"><div><b>${esc(s.invoice_no)}</b><br><small>${esc(s.customer||'Consumidor final')}</small></div><b>${money(s.total)}</b></div>`).join('')||'<div class="empty">Aún no hay ventas registradas.</div>}<div class="actions" style="margin-top:15px"><button class="primary" onclick="loadPage('pos')">Nueva venta</button><button class="icon-btn" onclick="loadPage('products')">Productos</button></div></div></div>`;
    }catch(e){content.innerHTML=`<div class="card"><h3>No se pudo cargar el dashboard</h3><p style="color:var(--muted)">${esc(e.message)}</p><button class="primary" onclick="dashboard()">Reintentar</button></div>`;toast(e.message,true)}
  };

  window.renderCashPro=async function(){
    const cur=await api('/api/cash/current'); const hist=await api('/api/cash/history'); const open=!!cur;
    content.innerHTML=`<div class="cash-hero"><div class="card"><div class="label">ESTADO DE CAJA</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${open?'🟢 ABIERTA':'🔴 CERRADA'}</div><div class="hint">${open?'Caja activa para ventas':'Debe abrirse antes de operar'}</div></div><div class="card"><div class="label">FONDO INICIAL</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${money(open?cur.opening_amount:0)}</div></div><div class="card"><div class="label">EFECTIVO ESPERADO</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${money(open?cur.expected:0)}</div></div></div><div class="grid two"><div class="card"><h3>${open?'Caja del turno':'Caja cerrada'}</h3>${open?`<div class="actions" style="margin-top:18px"><button class="primary quick-action" onclick="closeCash()">🔒 Cerrar caja<br><small>Contar efectivo y finalizar turno</small></button><button class="icon-btn quick-action" onclick="cashMovement()">💵 Entrada / salida<br><small>Registrar movimiento</small></button></div>`:`<button class="primary" onclick="openCash()">🔓 Abrir caja</button>`}</div><div class="card"><h3>Historial de cajas</h3>${rowTable(['Fecha','Estado','Inicial','Esperado','Contado','Diferencia'],hist.map(x=>`<tr><td>${new Date(x.opened_at).toLocaleString('es-SV')}</td><td>${x.status}</td><td>${money(x.opening_amount)}</td><td>${x.expected_amount==null?'—':money(x.expected_amount)}</td><td>${x.closing_amount==null?'—':money(x.closing_amount)}</td><td>${x.difference==null?'—':money(x.difference)}</td></tr>`).join(''))}</div></div>`;
  };
})();
