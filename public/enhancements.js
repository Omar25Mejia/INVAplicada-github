// Mejoras visuales y operativas del POS
(function(){
  const baseLoad=window.loadPage;
  window.loadPage=async function(p){
    if(p==='cash'){state.page=p;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#pageTitle').textContent='Caja';content.innerHTML='<div class="card empty">Cargando caja...</div>';try{await renderCashPro()}catch(e){content.innerHTML=`<div class="card"><h3>No se pudo cargar Caja</h3><p>${esc(e.message)}</p><button class="primary" onclick="loadPage('cash')">Reintentar</button></div>`;toast(e.message,true)}return}
    return baseLoad(p);
  };

  window.dashboard=async function(){
    state.page='dashboard';
    document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='dashboard'));
    $('#pageTitle').textContent='Dashboard';
    content.innerHTML='<div class="card empty">Cargando dashboard...</div>';
    try{
      // Usamos un único endpoint para evitar que una consulta secundaria deje el Dashboard bloqueado.
      const d=await api('/api/dashboard');
      const chart=Array.isArray(d.chart)?d.chart:[];
      const max=Math.max(...chart.map(x=>Number(x.total)||0),1);
      const salesTotal=Number(d.sales?.total||0);
      const tickets=Number(d.sales?.count||0);
      const inventoryValue=Number(d.stock?.value||0);
      const low=Number(d.low?.count||0);
      const products=Number(d.products?.count||0);
      const customers=Number(d.customers?.count||0);
      content.innerHTML=`<div class="grid stats">
        <div class="card stat"><div class="label">VENTAS DE HOY</div><div class="value">${money(salesTotal)}</div><div class="hint">${tickets} tickets</div></div>
        <div class="card stat"><div class="label">VALOR DE INVENTARIO</div><div class="value">${money(inventoryValue)}</div><div class="hint">Costo estimado</div></div>
        <div class="card stat"><div class="label">STOCK BAJO</div><div class="value">${low}</div><div class="hint">Productos para reponer</div></div>
        <div class="card stat"><div class="label">PRODUCTOS</div><div class="value">${products}</div><div class="hint">${customers} clientes registrados</div></div>
      </div>
      <div class="grid two" style="margin-top:18px">
        <div class="card"><div class="toolbar"><div><h3 style="margin:0">Ventas de los últimos 7 días</h3><small style="color:var(--muted)">Ventas registradas en el sistema</small></div><span class="badge">${money(chart.reduce((a,x)=>a+(Number(x.total)||0),0))}</span></div>
          <div class="chart">${chart.map(x=>`<div class="barcol" title="${esc(x.day)}: ${money(x.total)}"><i style="height:${Math.max(6,(Number(x.total)||0)/max*175)}px"></i><small>${esc(x.day)}</small></div>`).join('')||'<div class="empty">Aún no hay datos de ventas.</div>'}</div>
        </div>
        <div class="card"><div class="toolbar"><h3>Resumen</h3><span class="badge">Actualizado</span></div>
          <div class="actions" style="margin-top:18px"><button class="primary" onclick="loadPage('pos')">Nueva venta</button><button class="icon-btn" onclick="loadPage('products')">Productos</button><button class="icon-btn" onclick="loadPage('inventory')">Inventario</button></div>
          <hr style="border:0;border-top:1px solid var(--line);margin:22px 0"><p style="color:var(--muted);font-size:13px">Las ventas se reflejan aquí automáticamente después de cada operación.</p>
        </div>
      </div>`;
    }catch(e){
      const msg=e?.message||'No fue posible conectar con el servidor.';
      content.innerHTML=`<div class="card" style="text-align:center;padding:42px"><h3>No se pudo cargar el Dashboard</h3><p style="color:var(--muted);margin:12px 0 20px">${esc(msg)}</p><button class="primary" onclick="dashboard()">Reintentar</button></div>`;
      toast(msg,true);
    }
  };

  window.renderCashPro=async function(){
    const cur=await api('/api/cash/current'); const hist=await api('/api/cash/history'); const open=!!cur;
    content.innerHTML=`<div class="cash-hero"><div class="card"><div class="label">ESTADO DE CAJA</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${open?'🟢 ABIERTA':'🔴 CERRADA'}</div><div class="hint">${open?'Caja activa para ventas':'Debe abrirse antes de operar'}</div></div><div class="card"><div class="label">FONDO INICIAL</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${money(open?cur.opening_amount:0)}</div></div><div class="card"><div class="label">EFECTIVO ESPERADO</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${money(open?cur.expected:0)}</div></div></div><div class="grid two"><div class="card"><h3>${open?'Caja del turno':'Caja cerrada'}</h3>${open?`<div class="actions" style="margin-top:18px"><button class="primary quick-action" onclick="closeCash()">🔒 Cerrar caja<br><small>Contar efectivo y finalizar turno</small></button><button class="icon-btn quick-action" onclick="cashMovement()">💵 Entrada / salida<br><small>Registrar movimiento</small></button></div>`:`<button class="primary" onclick="openCash()">🔓 Abrir caja</button>`}</div><div class="card"><h3>Historial de cajas</h3>${rowTable(['Fecha','Estado','Inicial','Esperado','Contado','Diferencia'],hist.map(x=>`<tr><td>${new Date(x.opened_at).toLocaleString('es-SV')}</td><td>${x.status}</td><td>${money(x.opening_amount)}</td><td>${x.expected_amount==null?'—':money(x.expected_amount)}</td><td>${x.closing_amount==null?'—':money(x.closing_amount)}</td><td>${x.difference==null?'—':money(x.difference)}</td></tr>`).join(''))}</div></div>`;
  };
})();
