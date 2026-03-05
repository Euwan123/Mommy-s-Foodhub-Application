const sb = window.supabase;
let currentUser = null;
let allProducts = [], allCategories = [], allPromos = [], allStaff = [], allSizes = [], allItems = [];

const S = () => JSON.parse(localStorage.getItem('pos_settings') || '{}');
const sym = () => S().currency || '₱';

window.doLogin = async function() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  if (!u || !p) { err.textContent = 'Enter credentials.'; return; }
  const { data, error } = await sb.from('Employee').select('*').eq('Username', u).eq('Password', p).single();
  if (error || !data) { err.textContent = 'Invalid credentials.'; return; }
  if (data.AccessLevel !== 'Admin' && data.AccessLevel !== 'Manager') { err.textContent = 'Admin / Manager access required.'; return; }
  currentUser = data;
  document.getElementById('loginScreen').style.opacity = '0';
  setTimeout(() => { document.getElementById('loginScreen').style.display = 'none'; launchAdmin(data); }, 300);
};

function launchAdmin(user) {
  document.getElementById('adminName').textContent = user.Name;
  document.getElementById('userAvatar').textContent = user.Name.charAt(0).toUpperCase();
  document.getElementById('roleTag').textContent = user.AccessLevel;
  document.getElementById('app').style.display = 'flex';
  applyTheme();
  loadReports();
  loadAllData();
}

window.doLogout = function() {
  currentUser = null;
  document.getElementById('app').style.display = 'none';
  const ls = document.getElementById('loginScreen');
  ls.style.display = 'flex';
  setTimeout(() => ls.style.opacity = '1', 10);
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.querySelectorAll('.swatch[data-color]').forEach(sw => sw.addEventListener('click', () => { document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active')); sw.classList.add('active'); setThemeColor(sw.dataset.color); }));
  document.querySelectorAll('.bg-swatch').forEach(sw => sw.addEventListener('click', () => { document.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('active')); sw.classList.add('active'); setBgColor(sw.dataset.bg); }));
  document.querySelectorAll('.curr-btn').forEach(btn => btn.addEventListener('click', () => { document.querySelectorAll('.curr-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); setCurrency(btn.dataset.symbol); }));
});

async function loadAllData() {
  await Promise.all([loadCategories(), loadProducts(), loadPromos(), loadStaff(), loadItems()]);
  populateCatDropdown();
  populateSizeProdDropdown();
}

async function loadCategories() { const { data } = await sb.from('Category').select('*').order('CategoryName'); allCategories = data || []; }
async function loadProducts() {
  const { data } = await sb.from('Product').select('*, Category(CategoryName)').order('Name');
  allProducts = data || [];
  if (allProducts.length) { const { data: sizes } = await sb.from('ProductSize').select('*, Product(Name)').in('ProductID', allProducts.map(p=>p.ProductID)); allSizes = sizes || []; }
}
async function loadPromos() { const { data } = await sb.from('Promo').select('*').eq('IsActive', true).order('Code'); allPromos = data || []; }
async function loadStaff() { const { data } = await sb.from('Employee').select('*').order('Name'); allStaff = data || []; }
async function loadItems() { const { data } = await sb.from('Item').select('*').order('Name'); allItems = data || []; }

function populateCatDropdown() {
  const sel = document.getElementById('pCat');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select…</option>';
  allCategories.forEach(c => { const o = document.createElement('option'); o.value = c.CategoryID; o.textContent = c.CategoryName; sel.appendChild(o); });
}

function populateSizeProdDropdown() {
  const sel = document.getElementById('sizeProdId');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select dish…</option>';
  allProducts.forEach(p => { const o = document.createElement('option'); o.value = p.ProductID; o.textContent = p.Name; sel.appendChild(o); });
}

window.showAdminTab = function(name, btn) {
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.atab-btn').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById('atab-' + name);
  if (tab) tab.style.display = 'block';
  if (btn) btn.classList.add('active');
  if (name === 'reports') loadReports();
  if (name === 'attendance') loadAttendance();
  if (name === 'performance') loadPerformance();
  if (name === 'inventory') loadInventory();
  if (name === 'menu') { renderProductsTable(); renderSizesTable(); }
  if (name === 'promos') renderPromosTable();
  if (name === 'staffmgmt') renderStaffTable();
  if (name === 'settings') { loadSettingsForm(); applyTheme(); }
};

window.openAccountModal = function() {
  if (!currentUser) return;
  document.getElementById('accountAvatar').textContent = currentUser.Name.charAt(0).toUpperCase();
  document.getElementById('accountName').textContent = currentUser.Name;
  document.getElementById('accountMeta').textContent = currentUser.Position || 'Admin';
  document.getElementById('accountId').textContent = '#' + currentUser.EmployeeID;
  document.getElementById('accountAccess').textContent = currentUser.AccessLevel;
  document.getElementById('accountModal').classList.add('open');
};
window.closeAccountModal = function() { document.getElementById('accountModal').classList.remove('open'); };

window.loadReports = async function() {
  let query = sb.from('Order').select('*, Employee(Name), OrderDetails(Quantity, SizeLabel, Price, Subtotal, Product(Name))').order('OrderDateTime', { ascending: false });
  const d = document.getElementById('filterDate')?.value;
  if (d) query = query.gte('OrderDateTime', d + 'T00:00:00').lte('OrderDateTime', d + 'T23:59:59');
  const { data: orders } = await query;
  const s = sym();
  const total = (orders||[]).reduce((n,o) => n + parseFloat(o.TotalAmount||0), 0);
  const avg = orders?.length ? total / orders.length : 0;
  document.getElementById('statOrders').textContent = orders?.length || 0;
  document.getElementById('statRevenue').textContent = s + total.toFixed(2);
  document.getElementById('statAvg').textContent = s + avg.toFixed(2);
  const pending = JSON.parse(localStorage.getItem('offline_orders')||'[]');
  document.getElementById('statOffline').textContent = pending.length;
  renderBestSellers(orders||[]);
  const tbody = document.getElementById('ordersBody');
  if (!orders?.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px;">No orders found.</td></tr>'; return; }
  tbody.innerHTML = orders.map((o, i) => {
    const dt = new Date(o.OrderDateTime);
    const items = (o.OrderDetails||[]).map(d => `${d.Product?.Name}${d.SizeLabel?` (${d.SizeLabel})`:''} ×${d.Quantity}`).join(', ');
    const sc = { Completed:'var(--green)', Cancelled:'var(--red)', Pending:'#ca8a04', Refunded:'#7c3aed' }[o.Status] || 'var(--text-muted)';
    return `<tr>
      <td>${orders.length - i}</td>
      <td>${dt.toLocaleDateString()} ${dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
      <td>${o.Employee?.Name||'—'}</td>
      <td><span class="badge">${o.OrderType}</span></td>
      <td><span class="badge">${o.PaymentMethod}</span></td>
      <td style="font-size:12px;color:var(--text-muted);max-width:200px;">${items||'—'}</td>
      <td><span style="color:${sc};font-size:12px;font-weight:600;">${o.Status}</span></td>
      <td style="color:var(--green);font-weight:700;">${s}${parseFloat(o.TotalAmount).toFixed(2)}</td>
      <td><button class="btn-icon" onclick="openStatusModal(${o.OrderID},'${o.Status}')">✏️</button></td>
    </tr>`;
  }).join('');
};

function renderBestSellers(orders) {
  const counts = {};
  orders.forEach(o => (o.OrderDetails||[]).forEach(d => { const n = d.Product?.Name||'?'; counts[n] = (counts[n]||0) + d.Quantity; }));
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8);
  const max = sorted[0]?.[1] || 1;
  const el = document.getElementById('bestSellersChart');
  if (!sorted.length) { el.innerHTML = '<div style="color:var(--text-muted);padding:16px;">No data yet.</div>'; return; }
  el.innerHTML = sorted.map(([name,qty]) => `
    <div class="bs-row">
      <div class="bs-name">${name}</div>
      <div class="bs-bar-wrap"><div class="bs-bar" style="width:${(qty/max*100).toFixed(1)}%"></div></div>
      <div class="bs-qty">${qty}</div>
    </div>`).join('');
}

window.clearDateFilter = function() { document.getElementById('filterDate').value = ''; loadReports(); };

window.openStatusModal = function(orderId, currentStatus) {
  document.getElementById('statusOrderId').value = orderId;
  document.getElementById('statusOrderInfo').textContent = `Order #${orderId} — currently: ${currentStatus}`;
  document.getElementById('orderStatusModal').classList.add('open');
};
window.closeStatusModal = function() { document.getElementById('orderStatusModal').classList.remove('open'); };
window.setOrderStatus = async function(status) {
  const id = document.getElementById('statusOrderId').value;
  await sb.from('Order').update({ Status: status }).eq('OrderID', id);
  closeStatusModal();
  showToast(`Order #${id} → ${status}`, 'success');
  loadReports();
};

window.exportCSV = async function() {
  const { data: orders } = await sb.from('Order').select('*, Employee(Name), OrderDetails(Quantity, SizeLabel, Price, Product(Name))').order('OrderDateTime', { ascending: false });
  if (!orders?.length) { showToast('No orders to export', 'error'); return; }
  const s = sym();
  const rows = [['#','Date','Time','Staff','Type','Payment','Items','Status','Total']];
  orders.forEach((o,i) => {
    const dt = new Date(o.OrderDateTime);
    const items = (o.OrderDetails||[]).map(d => `${d.Product?.Name}${d.SizeLabel?` (${d.SizeLabel})`:''} x${d.Quantity}`).join(' | ');
    rows.push([i+1, dt.toLocaleDateString(), dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), o.Employee?.Name||'', o.OrderType, o.PaymentMethod, items, o.Status, s+o.TotalAmount]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Exported!', 'success');
};

window.syncOfflineOrders = async function() {
  const pending = JSON.parse(localStorage.getItem('offline_orders')||'[]');
  if (!pending.length) { showToast('No offline orders', ''); return; }
  if (!navigator.onLine) { showToast('Still offline!', 'error'); return; }
  let synced = 0;
  for (const o of pending) {
    const { data: row, error } = await sb.from('Order').insert([{ EmployeeID: o.EmployeeID, OrderDateTime: o.saved_at, OrderType: o.OrderType, PaymentMethod: o.PaymentMethod, TotalAmount: o.TotalAmount, Status: 'Completed', Notes: o.Notes, DiscountCode: o.DiscountCode, DiscountAmount: o.DiscountAmount }]).select().single();
    if (!error && row) { await sb.from('OrderDetails').insert(o.items.map(i => ({ OrderID: row.OrderID, ProductID: i.id, SizeLabel: i.size||null, Quantity: i.quantity, Price: i.price, Subtotal: i.price*i.quantity }))); synced++; }
  }
  if (synced) { localStorage.setItem('offline_orders', JSON.stringify(pending.slice(synced))); showToast(`Synced ${synced}!`, 'success'); loadReports(); }
};

window.loadAttendance = async function() {
  let q = sb.from('Attendance').select('*, Employee:EmployeeID(Name,Position), Approver:ApprovedBy(Name)').order('CheckIn', { ascending: false });
  const d = document.getElementById('attendDate')?.value;
  if (d) q = q.gte('CheckIn', d + 'T00:00:00').lte('CheckIn', d + 'T23:59:59');
  const { data } = await q;
  const all = data || [];
  const pending = all.filter(a => a.Status === 'Pending');
  const todayStr = new Date().toISOString().split('T')[0];
  const todayCheckedIn = all.filter(a => a.CheckIn?.startsWith(todayStr) && !a.CheckOut).length;
  document.getElementById('attendPending').textContent = pending.length;
  document.getElementById('attendToday').textContent = todayCheckedIn;
  const pendingGrid = document.getElementById('pendingAttendGrid');
  if (pending.length) {
    pendingGrid.innerHTML = pending.map(a => `
      <div class="attend-card">
        <div class="attend-name">${a.Employee?.Name || '—'}</div>
        <div class="attend-pos">${a.Employee?.Position || '—'}</div>
        <div class="attend-row"><span>Check In</span><strong>${new Date(a.CheckIn).toLocaleString()}</strong></div>
        <div class="attend-row"><span>Check Out</span><strong>${a.CheckOut ? new Date(a.CheckOut).toLocaleString() : 'Still in'}</strong></div>
        <div class="attend-actions">
          <button class="attend-approve-btn" onclick="approveAttendance(${a.AttendanceID}, 'Approved')">✓ Approve</button>
          <button class="attend-reject-btn" onclick="approveAttendance(${a.AttendanceID}, 'Rejected')">✕ Reject</button>
        </div>
      </div>`).join('');
  } else { pendingGrid.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">No pending approvals.</div>'; }
  const tbody = document.getElementById('attendanceBody');
  tbody.innerHTML = all.map(a => {
    const ci = new Date(a.CheckIn);
    const co = a.CheckOut ? new Date(a.CheckOut) : null;
    const dur = co ? Math.round((co - ci) / 60000) : null;
    const durText = dur !== null ? `${Math.floor(dur/60)}h ${dur%60}m` : 'In progress';
    return `<tr>
      <td><strong>${a.Employee?.Name||'—'}</strong></td>
      <td>${ci.toLocaleDateString()} ${ci.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
      <td>${co ? co.toLocaleDateString() + ' ' + co.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}) : '—'}</td>
      <td>${durText}</td>
      <td><span class="attend-status ${a.Status}">${a.Status}</span></td>
      <td>${a.Approver?.Name || '—'}</td>
      <td>
        ${a.Status === 'Pending' ? `<button class="btn-icon" onclick="approveAttendance(${a.AttendanceID},'Approved')">✓</button><button class="btn-icon" onclick="approveAttendance(${a.AttendanceID},'Rejected')">✕</button>` : ''}
      </td>
    </tr>`;
  }).join('');
};

window.approveAttendance = async function(id, status) {
  await sb.from('Attendance').update({ Status: status, ApprovedBy: currentUser.EmployeeID }).eq('AttendanceID', id);
  showToast(`Attendance ${status}`, 'success');
  loadAttendance();
};

window.loadPerformance = async function() {
  const from = document.getElementById('perfDateFrom')?.value;
  const to = document.getElementById('perfDateTo')?.value;
  let q = sb.from('Order').select('EmployeeID, TotalAmount, OrderDetails(Quantity)');
  if (from) q = q.gte('OrderDateTime', from + 'T00:00:00');
  if (to) q = q.lte('OrderDateTime', to + 'T23:59:59');
  const { data: orders } = await q;
  let attQ = sb.from('Attendance').select('EmployeeID, CheckIn, CheckOut, Status').eq('Status', 'Approved');
  if (from) attQ = attQ.gte('CheckIn', from + 'T00:00:00');
  const { data: att } = await attQ;
  const grid = document.getElementById('perfGrid');
  if (!allStaff.length) { grid.innerHTML = '<div style="color:var(--text-muted);">No staff found.</div>'; return; }
  const s = sym();
  grid.innerHTML = allStaff.map(staff => {
    const myOrders = (orders||[]).filter(o => o.EmployeeID === staff.EmployeeID);
    const revenue = myOrders.reduce((n,o) => n + parseFloat(o.TotalAmount||0), 0);
    const items = myOrders.reduce((n,o) => n + (o.OrderDetails||[]).reduce((nn,d) => nn + d.Quantity, 0), 0);
    const myAtt = (att||[]).filter(a => a.EmployeeID === staff.EmployeeID);
    const totalMins = myAtt.reduce((n,a) => { if (!a.CheckOut) return n; return n + Math.round((new Date(a.CheckOut)-new Date(a.CheckIn))/60000); }, 0);
    const hours = Math.floor(totalMins/60), mins = totalMins%60;
    return `<div class="perf-card">
      <div class="perf-name">${staff.Name}</div>
      <div class="perf-pos">${staff.Position || staff.AccessLevel}</div>
      <div class="perf-stats">
        <div class="perf-stat"><div class="perf-stat-label">Orders</div><div class="perf-stat-val">${myOrders.length}</div></div>
        <div class="perf-stat"><div class="perf-stat-label">Revenue</div><div class="perf-stat-val">${s}${revenue.toFixed(0)}</div></div>
        <div class="perf-stat"><div class="perf-stat-label">Items Sold</div><div class="perf-stat-val">${items}</div></div>
        <div class="perf-stat"><div class="perf-stat-label">Hours Worked</div><div class="perf-stat-val">${hours}h ${mins}m</div></div>
      </div>
    </div>`;
  }).join('');
};

window.clearPerfFilter = function() {
  document.getElementById('perfDateFrom').value = '';
  document.getElementById('perfDateTo').value = '';
  loadPerformance();
};

window.loadInventory = async function() {
  await loadItems();
  const low = allItems.filter(i => i.UnitQuantity <= i.RestockLvl && i.UnitQuantity > 0).length;
  const out = allItems.filter(i => i.UnitQuantity <= 0).length;
  document.getElementById('invTotal').textContent = allItems.length;
  document.getElementById('invLow').textContent = low;
  document.getElementById('invOut').textContent = out;
  const grid = document.getElementById('invGrid');
  grid.innerHTML = allItems.map(item => {
    const pct = item.RestockLvl > 0 ? Math.min(100, (item.UnitQuantity / (item.RestockLvl * 3)) * 100) : 100;
    const statusCls = item.UnitQuantity <= 0 ? 'out' : item.UnitQuantity <= item.RestockLvl ? 'low' : 'ok';
    const statusText = { out: '🔴 Out of Stock', low: '🟡 Low Stock', ok: '🟢 OK' }[statusCls];
    const cardCls = item.UnitQuantity <= 0 ? 'out' : item.UnitQuantity <= item.RestockLvl ? 'low' : '';
    return `<div class="inv-card ${cardCls}">
      <div class="inv-name">${item.Name}</div>
      <div class="inv-cat">${item.CategoryLabel || '—'}</div>
      <div class="inv-qty">${parseFloat(item.UnitQuantity||0).toFixed(1)}</div>
      <div class="inv-unit">${item.UnitType} remaining</div>
      <div class="inv-bar-wrap"><div class="inv-bar ${statusCls}" style="width:${pct.toFixed(1)}%"></div></div>
      <div class="inv-status ${statusCls === 'ok' ? 'ok' : statusCls === 'low' ? 'low-text' : 'out-text'}">${statusText}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Restock at: ${item.RestockLvl} ${item.UnitType}</div>
      <button class="inv-restock-btn" onclick="openRestockModal(${item.ItemID},'${item.Name.replace(/'/g,"\\'")}',${item.UnitQuantity||0})">+ Restock</button>
    </div>`;
  }).join('');
  const { data: ingRows } = await sb.from('Ingredients').select('*, Item(Name, UnitType), Product(Name)');
  const tbody = document.getElementById('ingMapBody');
  tbody.innerHTML = (ingRows||[]).map(r => `<tr>
    <td>${r.Item?.Name||'—'}</td>
    <td>${r.Product?.Name||'—'}</td>
    <td>${r.UnitPerServing}</td>
    <td>${r.Item?.UnitType||'—'}</td>
  </tr>`).join('');
};

window.openRestockModal = function(id, name, curr) {
  document.getElementById('restockItemId').value = id;
  document.getElementById('restockItemName').textContent = name + ' (current: ' + parseFloat(curr).toFixed(1) + ')';
  document.getElementById('restockQty').value = curr;
  document.getElementById('restockModal').classList.add('open');
};
window.closeRestockModal = function() { document.getElementById('restockModal').classList.remove('open'); };
window.saveRestock = async function() {
  const id = parseInt(document.getElementById('restockItemId').value);
  const qty = parseFloat(document.getElementById('restockQty').value);
  if (isNaN(qty) || qty < 0) { showToast('Invalid quantity', 'error'); return; }
  await sb.from('Item').update({ UnitQuantity: qty }).eq('ItemID', id);
  await sb.from('IngredientLog').insert([{ ItemID: id, ChangeAmt: qty, Reason: 'Restock' }]);
  closeRestockModal();
  showToast('Restocked!', 'success');
  loadInventory();
};

window.saveProduct = async function() {
  const name = document.getElementById('pName').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const catId = parseInt(document.getElementById('pCat').value);
  const stock = parseInt(document.getElementById('pStock').value) || 0;
  const available = document.getElementById('pAvailable').checked;
  const editId = document.getElementById('editId').value;
  if (!name || isNaN(price) || !catId) { showToast('Fill all required fields', 'error'); return; }
  if (editId) {
    await sb.from('Product').update({ Name: name, BasePrice: price, CategoryID: catId, StockQuantity: stock, IsAvailable: available }).eq('ProductID', editId);
    await sb.from('Inventory').upsert({ ProductID: parseInt(editId), QuantityAvailable: stock, LastUpdated: new Date().toISOString() }, { onConflict: 'ProductID' });
  } else {
    const { data: prod } = await sb.from('Product').insert([{ Name: name, BasePrice: price, CategoryID: catId, StockQuantity: stock, IsAvailable: available }]).select().single();
    if (prod) await sb.from('Inventory').insert([{ ProductID: prod.ProductID, QuantityAvailable: stock, LastUpdated: new Date().toISOString() }]);
  }
  showToast('Item saved!', 'success');
  cancelProductEdit();
  await loadProducts();
  populateSizeProdDropdown();
  renderProductsTable();
  renderSizesTable();
};

window.editProduct = function(id) {
  const p = allProducts.find(x => x.ProductID === id); if (!p) return;
  document.getElementById('editId').value = p.ProductID;
  document.getElementById('pName').value = p.Name;
  document.getElementById('pPrice').value = p.BasePrice;
  document.getElementById('pCat').value = p.CategoryID;
  document.getElementById('pAvailable').checked = p.IsAvailable;
  document.getElementById('menuFormTitle').textContent = 'Edit Item';
};

window.deleteProduct = async function(id) {
  if (!confirm('Delete this item?')) return;
  await sb.from('Product').delete().eq('ProductID', id);
  showToast('Deleted', 'success');
  await loadProducts(); populateSizeProdDropdown(); renderProductsTable(); renderSizesTable();
};

window.cancelProductEdit = function() {
  ['editId','pName','pPrice','pStock'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('pCat').value = '';
  document.getElementById('pAvailable').checked = true;
  document.getElementById('menuFormTitle').textContent = 'Add Item';
};

function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = allProducts.map(p => `<tr>
    <td>${p.Name}</td>
    <td><span class="badge">${p.Category?.CategoryName||'—'}</span></td>
    <td>${sym()}${parseFloat(p.BasePrice).toFixed(2)}</td>
    <td><span style="color:${p.IsAvailable?'var(--green)':'var(--red)'};font-size:12px;font-weight:600;">${p.IsAvailable?'Available':'Off'}</span></td>
    <td><button class="btn-icon" onclick="editProduct(${p.ProductID})">✏️</button><button class="btn-icon" onclick="deleteProduct(${p.ProductID})">🗑</button></td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No items yet.</td></tr>';
}

window.saveSize = async function() {
  const prodId = parseInt(document.getElementById('sizeProdId').value);
  const label = document.getElementById('sizeLabel').value.trim();
  const price = parseFloat(document.getElementById('sizePrice').value);
  const editId = document.getElementById('sizeEditId').value;
  if (!prodId || !label || isNaN(price)) { showToast('Fill all size fields', 'error'); return; }
  if (editId) await sb.from('ProductSize').update({ ProductID: prodId, Size: label, Price: price }).eq('ProductSizeID', editId);
  else await sb.from('ProductSize').insert([{ ProductID: prodId, Size: label, Price: price }]);
  showToast('Size saved!', 'success');
  cancelSizeEdit();
  await loadProducts(); renderSizesTable();
};

window.editSize = function(id) {
  const s = allSizes.find(x => x.ProductSizeID === id); if (!s) return;
  document.getElementById('sizeEditId').value = s.ProductSizeID;
  document.getElementById('sizeProdId').value = s.ProductID;
  document.getElementById('sizeLabel').value = s.Size;
  document.getElementById('sizePrice').value = s.Price;
  document.getElementById('sizeFormTitle').textContent = 'Edit Size';
};

window.deleteSize = async function(id) {
  if (!confirm('Delete this size?')) return;
  await sb.from('ProductSize').delete().eq('ProductSizeID', id);
  showToast('Deleted', 'success');
  await loadProducts(); renderSizesTable();
};

window.cancelSizeEdit = function() {
  ['sizeEditId','sizeLabel','sizePrice'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('sizeProdId').value = '';
  document.getElementById('sizeFormTitle').textContent = 'Add Size / Pack';
};

function renderSizesTable() {
  const tbody = document.getElementById('sizesTableBody');
  tbody.innerHTML = allSizes.map(s => `<tr>
    <td>${s.Product?.Name||'—'}</td>
    <td>${s.Size}</td>
    <td>${sym()}${parseFloat(s.Price).toFixed(2)}</td>
    <td><span style="color:${s.IsAvailable?'var(--green)':'var(--red)'};font-size:12px;font-weight:600;">${s.IsAvailable?'Yes':'No'}</span></td>
    <td><button class="btn-icon" onclick="editSize(${s.ProductSizeID})">✏️</button><button class="btn-icon" onclick="deleteSize(${s.ProductSizeID})">🗑</button></td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No sizes yet.</td></tr>';
}

window.savePromo = async function() {
  const Code = document.getElementById('promoCode').value.trim().toUpperCase();
  const Type = document.getElementById('promoType').value;
  const Value = parseFloat(document.getElementById('promoValue').value);
  const editId = document.getElementById('promoEditId').value;
  if (!Code || isNaN(Value)) { showToast('Fill all fields', 'error'); return; }
  if (editId) await sb.from('Promo').update({ Code, Type, Value }).eq('PromoID', editId);
  else await sb.from('Promo').insert([{ Code, Type, Value }]);
  showToast('Promo saved!', 'success');
  cancelPromoEdit();
  await loadPromos(); renderPromosTable();
};

window.editPromo = function(id) {
  const p = allPromos.find(x => x.PromoID === id); if (!p) return;
  document.getElementById('promoEditId').value = p.PromoID;
  document.getElementById('promoCode').value = p.Code;
  document.getElementById('promoType').value = p.Type;
  document.getElementById('promoValue').value = p.Value;
  document.getElementById('promoFormTitle').textContent = 'Edit Promo';
};

window.deletePromo = async function(id) {
  if (!confirm('Delete?')) return;
  await sb.from('Promo').update({ IsActive: false }).eq('PromoID', id);
  showToast('Deleted', 'success');
  await loadPromos(); renderPromosTable();
};

window.cancelPromoEdit = function() {
  ['promoEditId','promoCode','promoValue'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('promoType').value = 'percent';
  document.getElementById('promoFormTitle').textContent = 'Add Promo';
};

function renderPromosTable() {
  const tbody = document.getElementById('promosTableBody');
  const s = sym();
  tbody.innerHTML = allPromos.map(p => `<tr>
    <td><strong>${p.Code}</strong></td>
    <td><span class="badge">${p.Type === 'percent' ? 'Percent' : 'Fixed'}</span></td>
    <td>${p.Type === 'percent' ? p.Value + '%' : s + parseFloat(p.Value).toFixed(2)}</td>
    <td><button class="btn-icon" onclick="editPromo(${p.PromoID})">✏️</button><button class="btn-icon" onclick="deletePromo(${p.PromoID})">🗑</button></td>
  </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;">No promos.</td></tr>';
}

window.saveStaff = async function() {
  const name = document.getElementById('staffName').value.trim();
  const username = document.getElementById('staffUser').value.trim();
  const password = document.getElementById('staffPass').value.trim();
  const position = document.getElementById('staffPosition').value.trim();
  const role = document.getElementById('staffRole').value;
  const dob = document.getElementById('staffDob').value;
  const editId = document.getElementById('staffEditId').value;
  if (!name || !username || !password) { showToast('Name, username and password required', 'error'); return; }
  const payload = { Name: name, Username: username, Password: password, Position: position || 'Cashier', AccessLevel: role, DateofBirth: dob || null };
  if (editId) await sb.from('Employee').update(payload).eq('EmployeeID', editId);
  else await sb.from('Employee').insert([payload]);
  showToast('Staff saved!', 'success');
  cancelStaffEdit();
  await loadStaff(); renderStaffTable();
};

window.editStaff = function(id) {
  const s = allStaff.find(x => x.EmployeeID === id); if (!s) return;
  document.getElementById('staffEditId').value = s.EmployeeID;
  document.getElementById('staffName').value = s.Name;
  document.getElementById('staffUser').value = s.Username || '';
  document.getElementById('staffPass').value = s.Password || '';
  document.getElementById('staffPosition').value = s.Position || '';
  document.getElementById('staffRole').value = s.AccessLevel;
  document.getElementById('staffDob').value = s.DateofBirth?.split('T')[0] || '';
  document.getElementById('staffFormTitle').textContent = 'Edit Staff';
};

window.deleteStaff = async function(id) {
  if (id === currentUser?.EmployeeID) { showToast("Can't delete yourself!", 'error'); return; }
  if (!confirm('Delete this staff?')) return;
  await sb.from('Employee').delete().eq('EmployeeID', id);
  showToast('Deleted', 'success');
  await loadStaff(); renderStaffTable();
};

window.cancelStaffEdit = function() {
  ['staffEditId','staffName','staffUser','staffPass','staffPosition','staffDob'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('staffFormTitle').textContent = 'Add Staff';
};

function renderStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = allStaff.map(s => `<tr>
    <td>${s.Name}</td>
    <td>${s.Username||'—'}</td>
    <td>${s.Position||'—'}</td>
    <td><span class="badge">${s.AccessLevel}</span></td>
    <td><button class="btn-icon" onclick="editStaff(${s.EmployeeID})">✏️</button><button class="btn-icon" onclick="deleteStaff(${s.EmployeeID})">🗑</button></td>
  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No staff.</td></tr>';
}

function loadSettingsForm() {
  const s = S();
  if (s.name) document.getElementById('settingName').value = s.name;
  if (s.address) document.getElementById('settingAddress').value = s.address;
  if (s.contact) document.getElementById('settingContact').value = s.contact;
  if (s.footer) document.getElementById('settingFooter').value = s.footer;
  document.querySelectorAll('.swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.color === (s.themeColor||'#f59e0b')));
  document.querySelectorAll('.bg-swatch').forEach(sw => sw.classList.toggle('active', sw.dataset.bg === (s.bgColor||'#1a1008')));
  document.querySelectorAll('.curr-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.symbol === (s.currency||'₱')));
}

window.saveSettings = function() {
  const prev = S();
  const updated = { ...prev, name: document.getElementById('settingName').value || "Mommy's FoodHub", address: document.getElementById('settingAddress').value || '', contact: document.getElementById('settingContact').value || '', footer: document.getElementById('settingFooter').value || 'Thank you for dining with us! 🙏' };
  localStorage.setItem('pos_settings', JSON.stringify(updated));
  showToast('Settings saved!', 'success');
};

function setThemeColor(color) {
  const s = S(); s.themeColor = color; localStorage.setItem('pos_settings', JSON.stringify(s));
  document.documentElement.style.setProperty('--amber', color);
  const meta = document.getElementById('themeMetaColor'); if (meta) meta.setAttribute('content', color);
}
function setBgColor(bg) {
  const s = S(); s.bgColor = bg; localStorage.setItem('pos_settings', JSON.stringify(s));
  const adj = (hex, a) => '#' + [1,3,5].map(i => Math.min(255, parseInt(hex.slice(i,i+2),16)+a).toString(16).padStart(2,'0')).join('');
  document.documentElement.style.setProperty('--bg', bg);
  document.documentElement.style.setProperty('--surface', adj(bg,14));
  document.documentElement.style.setProperty('--surface2', adj(bg,22));
  document.documentElement.style.setProperty('--border', adj(bg,35));
}
function setCurrency(symbol) {
  const s = S(); s.currency = symbol; localStorage.setItem('pos_settings', JSON.stringify(s));
}
window.applyCustomColor = function(val) { setThemeColor(val); };
window.resetTheme = function() {
  setThemeColor('#f59e0b'); setBgColor('#1a1008');
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color==='#f59e0b'));
  document.querySelectorAll('.bg-swatch').forEach(s => s.classList.toggle('active', s.dataset.bg==='#1a1008'));
  showToast('Theme reset!', 'success');
};
window.applyCustomCurrency = function() {
  const val = document.getElementById('customCurrency').value.trim();
  if (!val) return;
  document.querySelectorAll('.curr-btn').forEach(b => b.classList.remove('active'));
  setCurrency(val); showToast('Currency updated!', 'success');
};

window.changePassword = async function() {
  const cur = document.getElementById('curPass').value;
  const nw = document.getElementById('newPass').value;
  const conf = document.getElementById('confirmPass').value;
  if (!cur || !nw || !conf) { showToast('Fill all fields', 'error'); return; }
  if (nw !== conf) { showToast('Passwords do not match', 'error'); return; }
  if (nw.length < 4) { showToast('Password too short', 'error'); return; }
  const { data } = await sb.from('Employee').select('Password').eq('EmployeeID', currentUser.EmployeeID).single();
  if (!data || data.Password !== cur) { showToast('Current password wrong', 'error'); return; }
  await sb.from('Employee').update({ Password: nw }).eq('EmployeeID', currentUser.EmployeeID);
  currentUser.Password = nw;
  ['curPass','newPass','confirmPass'].forEach(id => document.getElementById(id).value = '');
  showToast('Password updated!', 'success');
};

function applyTheme() {
  const s = S();
  if (s.themeColor) document.documentElement.style.setProperty('--amber', s.themeColor);
  if (s.bgColor) {
    const adj = (hex, a) => '#' + [1,3,5].map(i => Math.min(255, parseInt(hex.slice(i,i+2),16)+a).toString(16).padStart(2,'0')).join('');
    document.documentElement.style.setProperty('--bg', s.bgColor);
    document.documentElement.style.setProperty('--surface', adj(s.bgColor,14));
    document.documentElement.style.setProperty('--surface2', adj(s.bgColor,22));
    document.documentElement.style.setProperty('--border', adj(s.bgColor,35));
  }
}

let toastTimer;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}
window.showToast = showToast;