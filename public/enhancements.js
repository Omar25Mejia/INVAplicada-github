// Mejoras visuales y operativas del POS
(function(){
  const baseLoad=window.loadPage;
  window.loadPage=async function(p){
    if(p==='cash'){state.page=p;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===p));$('#pageTitle').textContent='Caja';content.innerHTML='<div class="card empty">Cargando caja...</div>';try{await renderCashPro()}catch(e){toast(e.message,true)}return}
    return baseLoad(p);
  };
  window.renderCashPro=async function(){
    const cur=await api('/api/cash/current');
    const hist=await api('/api/cash/history');
    const open=!!cur;
    content.innerHTML=`<div class="cash-hero">
      <div class="card ${open?'cash-open':'cash-closed'}"><div class="label">ESTADO DE CAJA</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${open?'🟢 ABIERTA':'🔴 CERRADA'}</div><div class="hint">${open?'Caja activa para ventas':'Debe abrirse antes de operar'}</div></div>
      <div class="card"><div class="label">FONDO INICIAL</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${money(open?cur.opening_amount:0)}</div></div>
      <div class="card"><div class="label">EFECTIVO ESPERADO</div><div class="value" style="font-size:24px;font-weight:900;margin-top:10px">${money(open?cur.expected:0)}</div></div>
    </div>
    <div class="grid two"><div class="card"><div class="toolbar"><div><h3 style="margin:0">${open?'Caja del turno':'Caja cerrada'}</h3><small style="color:var(--muted)">${open?'Control de efectivo en tiempo real':'Abrí una caja para comenzar a cobrar'}</small></div></div>
      ${open?`<div class="actions" style="margin-top:18px"><button class="primary quick-action" onclick="closeCash()">🔒 Cerrar caja<br><small>Contar efectivo y finalizar turno</small></button><button class="icon-btn quick-action" onclick="cashMovement()">💵 Entrada / salida<br><small>Registrar movimiento</small></button></div><div class="card" style="margin-top:16px;background:#f8fafc"><b>Cómo funciona</b><p style="color:var(--muted);font-size:13px;line-height:1.5">Las ventas en efectivo se reflejan en el efectivo esperado. Al cerrar, ingresá el efectivo contado y el sistema calcula automáticamente la diferencia.</p></div>`:`<button class="primary" onclick="openCash()">🔓 Abrir caja</button>`}
    </div><div class="card"><div class="toolbar"><h3>Historial de cajas</h3><span class="badge">${hist.length} registros</span></div>${rowTable(['Fecha','Estado','Inicial','Esperado','Contado','Diferencia'],hist.map(x=>`<tr><td>${new Date(x.opened_at).toLocaleString('es-SV')}</td><td><span class="badge ${x.status==='open'?'ok':''}">${x.status==='open'?'Abierta':'Cerrada'}</span></td><td>${money(x.opening_amount)}</td><td>${money(x.expected_amount)}</td><td>${x.closing_amount==null?'—':money(x.closing_amount)}</td><td>${x.difference==null?'—':money(x.difference)}</td></tr>`).join(''))}</div></div>`;
  };
})();
