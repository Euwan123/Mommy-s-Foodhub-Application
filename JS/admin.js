let allAdminProducts = [];
let allAdminCategories = [];
let allAdminPromos = [];
let allStaff = [];
let allAdminSizes = [];
let allItems = [];
let productCostPerServing = {};

async function loadAdminData() {
  await Promise.all([loadAdminCategories(), loadAdminProducts(), loadAdminPromos(), loadStaff(), loadItems()]);
  populateCatDropdown();
  populateSizeProdDropdown();
}

async function loadAdminCategories() {
  const { data } = await sb.from('Category').select('*').order('CategoryName');
  allAdminCategories = data || [];
}

async function loadAdminProducts() {
  const { data } = await sb.from('Product').select('*, Category(CategoryName)').order('Name');
  allAdminProducts = data || [];
  if (allAdminProducts.length) {
    const { data: sizes } = await sb.from('ProductSize').select('*, Product(Name)').in('ProductID', allAdminProducts.map(p => p.ProductID));
    allAdminSizes = sizes || [];
  }
}

async function loadAdminPromos() {
  const { data } = await sb.from('Promo').select('*').eq('IsActive', true).order('Code');
  allAdminPromos = data || [];
}

async function loadStaff() {
  const { data } = await sb.from('Employee').select('*').order('Name');
  allStaff = data || [];
}

async function loadItems() {
  const { data } = await sb.from('Item').select('*').order('Name');
  allItems = data || [];
}

async function loadProductCosts() {
  const { data: ingRows } = await sb.from('Ingredients').select('ProductID,ItemID,UnitPerServing');
  if (!ingRows?.length) return;
  const itemIds = [...new Set(ingRows.map(i => i.ItemID))];
  const { data: items } = await sb.from('Item').select('ItemID,UnitPrice').in('ItemID', itemIds);
  const priceMap = {};
  (items || []).forEach(it => { priceMap[it.ItemID] = parseFloat(it.UnitPrice) || 0; });
  productCostPerServing = {};
  ingRows.forEach(ing => {
    const cost = (parseFloat(ing.UnitPerServing) || 0) * (priceMap[ing.ItemID] || 0);
    productCostPerServing[ing.ProductID] = (productCostPerServing[ing.ProductID] || 0) + cost;
  });
}

function populateCatDropdown() {
  const sel = document.getElementById('pCat');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select…</option>';
  allAdminCategories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.CategoryID;
    o.textContent = c.CategoryName;
    sel.appendChild(o);
  });
}

function populateSizeProdDropdown() {
  const sel = document.getElementById('sizeProdId');
  if (!sel) return;
  sel.innerHTML = '<option value="">Select dish…</option>';
  allAdminProducts.forEach(p => {
    const o = document.createElement('option');
    o.value = p.ProductID;
    o.textContent = p.Name;
    sel.appendChild(o);
  });
}

window.showAdminTab = function (name, btn) {
  document.querySelectorAll('#adminView .page').forEach(p => p.style.display = 'none');
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

window.loadReports = async function () {
  let query = sb.from('Order').select('*, Employee(Name), OrderDetails(Quantity, SizeLabel, Price, Subtotal, ProductID, Product(Name))').order('OrderDateTime', { ascending: false });
  const d = document.getElementById('filterDate')?.value;
  if (d) query = query.gte('OrderDateTime', d + 'T00:00:00').lte('OrderDateTime', d + 'T23:59:59');
  const { data: orders } = await query;
  const s = sym();
  const validOrders = (orders || []).filter(o => o.Status !== 'Cancelled' && o.Status !== 'Refunded');
  const total = validOrders.reduce((n, o) => n + parseFloat(o.TotalAmount || 0), 0);
  const avg = orders?.length ? total / Math.max(1, validOrders.length) : 0;
  document.getElementById('statOrders').textContent = orders?.length || 0;
  document.getElementById('statRevenue').textContent = s + total.toFixed(2);
  document.getElementById('statAvg').textContent = s + avg.toFixed(2);
  await loadProductCosts();
  let totalProfit = 0;
  let totalIngredientCost = 0;
  validOrders.forEach(o => {
    (o.OrderDetails || []).forEach(d => {
      const revenue = parseFloat(d.Price || 0) * (d.Quantity || 0);
      const costPer = productCostPerServing[d.ProductID] || 0;
      totalIngredientCost += costPer * (d.Quantity || 0);
      totalProfit += revenue - costPer * (d.Quantity || 0);
    });
  });
  const profitEl = document.getElementById('statProfit');
  if (profitEl) { profitEl.textContent = s + totalProfit.toFixed(2); profitEl.style.color = totalProfit >= 0 ? 'var(--green)' : 'var(--red)'; }
  const costEl = document.getElementById('statIngredientCost');
  if (costEl) costEl.textContent = s + totalIngredientCost.toFixed(2);
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  document.getElementById('statOffline').textContent = pending.length;
  renderBestSellers(orders || []);
  const tbody = document.getElementById('ordersBody');
  if (!orders?.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:30px;">No orders found.</td></tr>'; return; }
  tbody.innerHTML = orders.map((o, i) => {
    const dt = new Date(o.OrderDateTime);
    const items = (o.OrderDetails || []).map(d => `${escapeHtml(d.Product?.Name)}${d.SizeLabel ? ` (${escapeHtml(d.SizeLabel)})` : ''} ×${d.Quantity}`).join(', ');
    const sc = { Completed: 'var(--green)', Cancelled: 'var(--red)', Pending: '#ca8a04', Refunded: '#7c3aed' }[o.Status] || 'var(--text-muted)';
    return `<tr><td>${orders.length - i}</td><td>${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>${escapeHtml(o.Employee?.Name || '—')}</td><td><span class="badge">${escapeHtml(o.OrderType)}</span></td><td><span class="badge">${escapeHtml(o.PaymentMethod)}</span></td><td style="font-size:12px;color:var(--text-muted);max-width:200px;">${items || '—'}</td><td><span style="color:${sc};font-size:12px;font-weight:600;">${o.Status}</span></td><td style="color:var(--green);font-weight:700;">${s}${parseFloat(o.TotalAmount).toFixed(2)}</td><td><button class="btn-icon" onclick="openStatusModal(${o.OrderID},'${o.Status}')">✏️</button></td></tr>`;
  }).join('');
};

function renderBestSellers(orders) {
  const counts = {};
  orders.forEach(o => (o.OrderDetails || []).forEach(d => { const n = d.Product?.Name || '?'; counts[n] = (counts[n] || 0) + d.Quantity; }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;
  const el = document.getElementById('bestSellersChart');
  if (!sorted.length) { el.innerHTML = '<div style="color:var(--text-muted);padding:16px;">No data yet.</div>'; return; }
  el.innerHTML = sorted.map(([name, qty]) => `<div class="bs-row"><div class="bs-name">${escapeHtml(name)}</div><div class="bs-bar-wrap"><div class="bs-bar" style="width:${(qty / max * 100).toFixed(1)}%"></div></div><div class="bs-qty">${qty}</div></div>`).join('');
}

window.clearDateFilter = function () { document.getElementById('filterDate').value = ''; loadReports(); };

window.openStatusModal = function (orderId, currentStatus) {
  document.getElementById('statusOrderId').value = orderId;
  document.getElementById('statusOrderInfo').textContent = `Order #${orderId} — currently: ${currentStatus}`;
  document.getElementById('orderStatusModal').classList.add('open');
};
window.closeStatusModal = function () { document.getElementById('orderStatusModal').classList.remove('open'); };

window.setOrderStatus = async function (status) {
  const id = parseInt(document.getElementById('statusOrderId').value, 10);
  if (status === 'Cancelled' || status === 'Refunded') await refundOrderIngredients(id);
  await sb.from('Order').update({ Status: status }).eq('OrderID', id);
  closeStatusModal();
  showToast(`Order #${id} → ${status}`, 'success');
  loadReports();
};

window.exportCSV = async function () {
  const { data: orders } = await sb.from('Order').select('*, Employee(Name), OrderDetails(Quantity, SizeLabel, Price, Product(Name))').order('OrderDateTime', { ascending: false });
  if (!orders?.length) { showToast('No orders to export', 'error'); return; }
  const s = sym();
  const rows = [['#', 'Date', 'Time', 'Staff', 'Type', 'Payment', 'Items', 'Status', 'Total']];
  orders.forEach((o, i) => {
    const dt = new Date(o.OrderDateTime);
    const items = (o.OrderDetails || []).map(d => `${d.Product?.Name}${d.SizeLabel ? ` (${d.SizeLabel})` : ''} x${d.Quantity}`).join(' | ');
    rows.push([i + 1, dt.toLocaleDateString(), dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), o.Employee?.Name || '', o.OrderType, o.PaymentMethod, items, o.Status, s + o.TotalAmount]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Exported!', 'success');
};

window.loadAttendance = async function () {
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
  pendingGrid.innerHTML = pending.length
    ? pending.map(a => `<div class="attend-card"><div class="attend-name">${escapeHtml(a.Employee?.Name || '—')}</div><div class="attend-pos">${escapeHtml(a.Employee?.Position || '—')}</div><div class="attend-row"><span>Check In</span><strong>${new Date(a.CheckIn).toLocaleString()}</strong></div><div class="attend-actions"><button class="attend-approve-btn" onclick="approveAttendance(${a.AttendanceID},'Approved')">✓ Accept</button><button class="attend-reject-btn" onclick="approveAttendance(${a.AttendanceID},'Rejected')">✕ Reject</button></div></div>`).join('')
    : '<div style="color:var(--text-muted);font-size:13px;">No pending entry.</div>';
  const checkedIn = all.filter(a => a.Status === 'Approved' && !a.CheckOut);
  const checkedInGrid = document.getElementById('checkedInGrid');
  if (checkedInGrid) {
    checkedInGrid.innerHTML = checkedIn.length
      ? checkedIn.map(a => `<div class="attend-card"><div class="attend-name">${escapeHtml(a.Employee?.Name || '—')}</div><div class="attend-pos">${escapeHtml(a.Employee?.Position || '—')}</div><div class="attend-row"><span>Check In</span><strong>${new Date(a.CheckIn).toLocaleString()}</strong></div><div class="attend-actions"><button class="attend-reject-btn" onclick="checkoutAttendance(${a.AttendanceID})">Check out</button></div></div>`).join('')
      : '<div style="color:var(--text-muted);font-size:13px;">No one checked in.</div>';
  }
  const tbody = document.getElementById('attendanceBody');
  tbody.innerHTML = all.map(a => {
    const ci = new Date(a.CheckIn);
    const co = a.CheckOut ? new Date(a.CheckOut) : null;
    const dur = co ? Math.round((co - ci) / 60000) : null;
    const durText = dur !== null ? `${Math.floor(dur / 60)}h ${dur % 60}m` : 'In progress';
    return `<tr><td><strong>${escapeHtml(a.Employee?.Name || '—')}</strong></td><td>${ci.toLocaleDateString()} ${ci.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td><td>${co ? co.toLocaleDateString() + ' ' + co.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td>${durText}</td><td><span class="attend-status ${a.Status}">${a.Status}</span></td><td>${escapeHtml(a.Approver?.Name || '—')}</td><td>${a.Status === 'Pending' ? `<button class="btn-icon" onclick="approveAttendance(${a.AttendanceID},'Approved')">✓</button><button class="btn-icon" onclick="approveAttendance(${a.AttendanceID},'Rejected')">✕</button>` : ''}</td></tr>`;
  }).join('');
};

window.approveAttendance = async function (id, status) {
  await sb.from('Attendance').update({ Status: status, ApprovedBy: currentUser.EmployeeID }).eq('AttendanceID', id);
  showToast(status === 'Approved' ? 'Entry accepted' : 'Rejected', 'success');
  loadAttendance();
};

window.checkoutAttendance = async function (id) {
  await sb.from('Attendance').update({ CheckOut: new Date().toISOString() }).eq('AttendanceID', id);
  showToast('Checked out', 'success');
  loadAttendance();
};

window.loadPerformance = async function () {
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
  const s = sym();
  if (!allStaff.length) { grid.innerHTML = '<div style="color:var(--text-muted);">No staff found.</div>'; return; }
  grid.innerHTML = allStaff.map(staff => {
    const myOrders = (orders || []).filter(o => o.EmployeeID === staff.EmployeeID);
    const revenue = myOrders.reduce((n, o) => n + parseFloat(o.TotalAmount || 0), 0);
    const items = myOrders.reduce((n, o) => n + (o.OrderDetails || []).reduce((nn, d) => nn + d.Quantity, 0), 0);
    const myAtt = (att || []).filter(a => a.EmployeeID === staff.EmployeeID);
    const totalMins = myAtt.reduce((n, a) => { if (!a.CheckOut) return n; return n + Math.round((new Date(a.CheckOut) - new Date(a.CheckIn)) / 60000); }, 0);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    const hrRate = parseFloat(staff.HourlyRate ?? 0) || 0;
    const estPay = hrRate * (totalMins / 60);
    const payLine = hrRate > 0 ? `<div class="perf-stat"><div class="perf-stat-label">Per hour</div><div class="perf-stat-val">${s}${hrRate.toFixed(2)}</div></div><div class="perf-stat"><div class="perf-stat-label">Est. pay</div><div class="perf-stat-val">${s}${estPay.toFixed(2)}</div></div>` : '';
    return `<div class="perf-card"><div class="perf-name">${escapeHtml(staff.Name)}</div><div class="perf-pos">${escapeHtml(staff.Position || staff.AccessLevel)}</div><div class="perf-stats"><div class="perf-stat"><div class="perf-stat-label">Orders</div><div class="perf-stat-val">${myOrders.length}</div></div><div class="perf-stat"><div class="perf-stat-label">Revenue</div><div class="perf-stat-val">${s}${revenue.toFixed(0)}</div></div><div class="perf-stat"><div class="perf-stat-label">Items Sold</div><div class="perf-stat-val">${items}</div></div><div class="perf-stat"><div class="perf-stat-label">Hours Worked</div><div class="perf-stat-val">${hours}h ${mins}m</div></div>${payLine}</div></div>`;
  }).join('');
};

window.clearPerfFilter = function () {
  document.getElementById('perfDateFrom').value = '';
  document.getElementById('perfDateTo').value = '';
  loadPerformance();
};

let invStockFilter = 'all';

window.filterInventoryByStock = function (filter, btn) {
  invStockFilter = filter;
  document.querySelectorAll('.inv-stat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderInventoryGrid();
};

function buildInvCard(item) {
  const s = sym();
  const pct = item.RestockLvl > 0 ? Math.min(100, (item.UnitQuantity / (item.RestockLvl * 3)) * 100) : 100;
  const statusCls = item.UnitQuantity <= 0 ? 'out' : item.UnitQuantity <= item.RestockLvl ? 'low' : 'ok';
  const statusText = { out: '🔴 Out of Stock', low: '🟡 Low Stock', ok: '🟢 OK' }[statusCls];
  const cardCls = item.UnitQuantity <= 0 ? 'out' : item.UnitQuantity <= item.RestockLvl ? 'low' : '';
  const unitType = item.UnitType || 'unit';
  const safeId = item.ItemID;
  const safeName = (item.Name || '').replace(/'/g, "\\'");
  const safeUnit = unitType.replace(/'/g, "\\'");
  const restockBtn = isAdmin() ? '<button class="inv-restock-btn" onclick="openRestockModal(' + safeId + ',\'' + safeName + '\',' + (item.UnitQuantity || 0) + ')">+ Restock</button>' : '';
  const priceBtn = isAdmin() ? '<button class="inv-restock-btn" style="margin-top:6px;" onclick="openIngredientPriceModal(' + safeId + ',\'' + safeName + '\',\'' + safeUnit + '\',' + parseFloat(item.UnitPrice || 0) + ')">Edit price</button>' : '';
  return '<div class="inv-card ' + cardCls + '">' +
    '<div class="inv-name">' + escapeHtml(item.Name) + '</div>' +
    '<div class="inv-unit" style="color:var(--amber);margin-bottom:4px;">' + s + parseFloat(item.UnitPrice || 0).toFixed(2) + ' per ' + escapeHtml(unitType) + '</div>' +
    '<div class="inv-qty">' + parseFloat(item.UnitQuantity || 0).toFixed(1) + '</div>' +
    '<div class="inv-unit">' + escapeHtml(unitType) + ' remaining</div>' +
    '<div class="inv-bar-wrap"><div class="inv-bar ' + statusCls + '" style="width:' + pct.toFixed(1) + '%"></div></div>' +
    '<div class="inv-status ' + (statusCls === 'ok' ? 'ok' : statusCls === 'low' ? 'low-text' : 'out-text') + '">' + statusText + '</div>' +
    '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">Restock at: ' + item.RestockLvl + ' ' + escapeHtml(unitType) + '</div>' +
    restockBtn + priceBtn +
    '</div>';
}

function renderInventoryGrid() {
  const s = sym();
  let items = allItems;
  if (invStockFilter === 'low') items = allItems.filter(i => i.UnitQuantity <= i.RestockLvl && i.UnitQuantity > 0);
  else if (invStockFilter === 'out') items = allItems.filter(i => i.UnitQuantity <= 0);

  const grid = document.getElementById('invGrid');
  if (!items.length) { grid.innerHTML = '<div style="color:var(--text-muted);padding:20px;grid-column:1/-1;">No items in this filter.</div>'; return; }

  const groups = {};
  items.forEach(item => {
    const g = getIngredientGroup(item.Name);
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  });

  grid.innerHTML = '';
  Object.keys(groups).sort().forEach(groupLabel => {
    const header = document.createElement('div');
    header.className = 'inv-group-header';
    header.textContent = groupLabel;
    grid.appendChild(header);
    groups[groupLabel].forEach(item => {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = buildInvCard(item);
      grid.appendChild(wrapper.firstChild);
    });
  });
}

window.loadInventory = async function () {
  await loadItems();
  const addCard = document.getElementById('addIngredientCard');
  if (addCard) addCard.style.display = isAdmin() ? '' : 'none';
  const low = allItems.filter(i => i.UnitQuantity <= i.RestockLvl && i.UnitQuantity > 0).length;
  const out = allItems.filter(i => i.UnitQuantity <= 0).length;

  const totalEl = document.getElementById('invTotal');
  const lowEl = document.getElementById('invLow');
  const outEl = document.getElementById('invOut');
  if (totalEl) { totalEl.textContent = allItems.length; totalEl.style.cursor = 'pointer'; totalEl.onclick = function () { filterInventoryByStock('all', null); document.querySelectorAll('.inv-stat-btn').forEach(b => b.classList.remove('active')); }; }
  if (lowEl) { lowEl.textContent = low; lowEl.style.cursor = 'pointer'; lowEl.onclick = function () { filterInventoryByStock('low', null); }; }
  if (outEl) { outEl.textContent = out; outEl.style.cursor = 'pointer'; outEl.onclick = function () { filterInventoryByStock('out', null); }; }

  invStockFilter = 'all';
  renderInventoryGrid();

  const { data: ingRows } = await sb.from('Ingredients').select('*, Item(Name, UnitType), Product(Name)');
  document.getElementById('ingMapBody').innerHTML = (ingRows || []).map(r =>
    '<tr><td>' + escapeHtml(r.Item?.Name || '—') + '</td><td>' + escapeHtml(r.Product?.Name || '—') + '</td><td>' + r.UnitPerServing + '</td><td>' + escapeHtml(r.Item?.UnitType || '—') + '</td></tr>'
  ).join('');
};

window.openIngredientPriceModal = function (id, name, unitType, unitPrice) {
  document.getElementById('priceItemId').value = id;
  document.getElementById('priceItemName').textContent = name;
  document.getElementById('priceUnitLabel').textContent = unitType || 'unit';
  document.getElementById('priceItemUnitPrice').value = parseFloat(unitPrice || 0);
  document.getElementById('ingredientPriceModal').classList.add('open');
};
window.closeIngredientPriceModal = function () { document.getElementById('ingredientPriceModal').classList.remove('open'); };

window.saveItemPrice = async function () {
  const id = parseInt(document.getElementById('priceItemId').value, 10);
  const val = parseFloat(document.getElementById('priceItemUnitPrice').value);
  if (isNaN(val) || val < 0) { showToast('Invalid price', 'error'); return; }
  await sb.from('Item').update({ UnitPrice: val }).eq('ItemID', id);
  const idx = allItems.findIndex(i => i.ItemID === id);
  if (idx !== -1) allItems[idx].UnitPrice = val;
  closeIngredientPriceModal();
  showToast('Price updated', 'success');
  loadInventory();
};

window.openRestockModal = function (id, name, curr) {
  document.getElementById('restockItemId').value = id;
  document.getElementById('restockItemName').textContent = name + ' (current: ' + parseFloat(curr).toFixed(1) + ')';
  document.getElementById('restockQty').value = curr;
  document.getElementById('restockModal').classList.add('open');
};
window.closeRestockModal = function () { document.getElementById('restockModal').classList.remove('open'); };

window.saveRestock = async function () {
  const id = parseInt(document.getElementById('restockItemId').value, 10);
  const qty = parseFloat(document.getElementById('restockQty').value);
  if (isNaN(qty) || qty < 0) { showToast('Invalid quantity', 'error'); return; }
  await sb.from('Item').update({ UnitQuantity: qty }).eq('ItemID', id);
  await sb.from('IngredientLog').insert([{ ItemID: id, ChangeAmt: qty, Reason: 'Restock' }]);
  closeRestockModal();
  showToast('Restocked!', 'success');
  loadInventory();
};

window.saveNewIngredient = async function () {
  const name = document.getElementById('ingName').value.trim();
  const unitType = document.getElementById('ingUnitType').value.trim() || 'unit';
  const qty = parseFloat(document.getElementById('ingQty').value) || 0;
  const unitPrice = parseFloat(document.getElementById('ingUnitPrice').value) || 0;
  const restockLvl = parseFloat(document.getElementById('ingRestockLvl').value) || 0;
  if (!name) { showToast('Name required', 'error'); return; }
  await sb.from('Item').insert([{ Name: name, UnitType: unitType, UnitQuantity: qty, UnitPrice: unitPrice, RestockLvl: restockLvl }]);
  ['ingName', 'ingUnitType', 'ingQty', 'ingUnitPrice', 'ingRestockLvl'].forEach(id => { document.getElementById(id).value = ''; });
  showToast('Ingredient added', 'success');
  loadInventory();
};

window.saveProduct = async function () {
  const name = document.getElementById('pName').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const catId = parseInt(document.getElementById('pCat').value, 10);
  const stock = parseInt(document.getElementById('pStock').value, 10) || 0;
  const available = document.getElementById('pAvailable').checked;
  const editId = document.getElementById('editId').value;
  if (!name || isNaN(price) || !catId) { showToast('Fill all required fields', 'error'); return; }
  if (editId) {
    await sb.from('Product').update({ Name: name, BasePrice: price, CategoryID: catId, StockQuantity: stock, IsAvailable: available }).eq('ProductID', editId);
    await sb.from('Inventory').upsert({ ProductID: parseInt(editId, 10), QuantityAvailable: stock, LastUpdated: new Date().toISOString() }, { onConflict: 'ProductID' });
  } else {
    const { data: prod } = await sb.from('Product').insert([{ Name: name, BasePrice: price, CategoryID: catId, StockQuantity: stock, IsAvailable: available }]).select().single();
    if (prod) await sb.from('Inventory').insert([{ ProductID: prod.ProductID, QuantityAvailable: stock, LastUpdated: new Date().toISOString() }]);
  }
  showToast('Item saved!', 'success');
  cancelProductEdit();
  await loadAdminProducts();
  populateSizeProdDropdown();
  renderProductsTable();
  renderSizesTable();
};

window.editProduct = function (id) {
  const p = allAdminProducts.find(x => x.ProductID === id);
  if (!p) return;
  document.getElementById('editId').value = p.ProductID;
  document.getElementById('pName').value = p.Name;
  document.getElementById('pPrice').value = p.BasePrice;
  document.getElementById('pCat').value = p.CategoryID;
  document.getElementById('pAvailable').checked = p.IsAvailable;
  document.getElementById('menuFormTitle').textContent = 'Edit Item';
};

window.deleteProduct = async function (id) {
  if (!confirm('Delete this item?')) return;
  await sb.from('Product').delete().eq('ProductID', id);
  showToast('Deleted', 'success');
  await loadAdminProducts();
  populateSizeProdDropdown();
  renderProductsTable();
  renderSizesTable();
};

window.cancelProductEdit = function () {
  ['editId', 'pName', 'pPrice', 'pStock'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('pCat').value = '';
  document.getElementById('pAvailable').checked = true;
  document.getElementById('menuFormTitle').textContent = 'Add Item';
};

function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = allAdminProducts.map(p => `<tr><td>${escapeHtml(p.Name)}</td><td><span class="badge">${escapeHtml(p.Category?.CategoryName || '—')}</span></td><td>${sym()}${parseFloat(p.BasePrice).toFixed(2)}</td><td><span style="color:${p.IsAvailable ? 'var(--green)' : 'var(--red)'};font-size:12px;font-weight:600;">${p.IsAvailable ? 'Available' : 'Off'}</span></td><td><button class="btn-icon" onclick="editProduct(${p.ProductID})">✏️</button><button class="btn-icon" onclick="deleteProduct(${p.ProductID})">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No items yet.</td></tr>';
}

window.saveSize = async function () {
  const prodId = parseInt(document.getElementById('sizeProdId').value, 10);
  const label = document.getElementById('sizeLabel').value.trim();
  const price = parseFloat(document.getElementById('sizePrice').value);
  const editId = document.getElementById('sizeEditId').value;
  if (!prodId || !label || isNaN(price)) { showToast('Fill all size fields', 'error'); return; }
  if (editId) await sb.from('ProductSize').update({ ProductID: prodId, Size: label, Price: price }).eq('ProductSizeID', editId);
  else await sb.from('ProductSize').insert([{ ProductID: prodId, Size: label, Price: price }]);
  showToast('Size saved!', 'success');
  cancelSizeEdit();
  await loadAdminProducts();
  renderSizesTable();
};

window.editSize = function (id) {
  const s = allAdminSizes.find(x => x.ProductSizeID === id);
  if (!s) return;
  document.getElementById('sizeEditId').value = s.ProductSizeID;
  document.getElementById('sizeProdId').value = s.ProductID;
  document.getElementById('sizeLabel').value = s.Size;
  document.getElementById('sizePrice').value = s.Price;
  document.getElementById('sizeFormTitle').textContent = 'Edit Size';
};

window.deleteSize = async function (id) {
  if (!confirm('Delete this size?')) return;
  await sb.from('ProductSize').delete().eq('ProductSizeID', id);
  showToast('Deleted', 'success');
  await loadAdminProducts();
  renderSizesTable();
};

window.cancelSizeEdit = function () {
  ['sizeEditId', 'sizeLabel', 'sizePrice'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('sizeProdId').value = '';
  document.getElementById('sizeFormTitle').textContent = 'Add Size / Pack';
};

function renderSizesTable() {
  const tbody = document.getElementById('sizesTableBody');
  tbody.innerHTML = allAdminSizes.map(s => `<tr><td>${escapeHtml(s.Product?.Name || '—')}</td><td>${escapeHtml(s.Size)}</td><td>${sym()}${parseFloat(s.Price).toFixed(2)}</td><td><span style="color:${s.IsAvailable ? 'var(--green)' : 'var(--red)'};font-size:12px;font-weight:600;">${s.IsAvailable ? 'Yes' : 'No'}</span></td><td><button class="btn-icon" onclick="editSize(${s.ProductSizeID})">✏️</button><button class="btn-icon" onclick="deleteSize(${s.ProductSizeID})">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No sizes yet.</td></tr>';
}

window.savePromo = async function () {
  const Code = document.getElementById('promoCode').value.trim().toUpperCase();
  const Type = document.getElementById('promoType').value;
  const Value = parseFloat(document.getElementById('promoValue').value);
  const editId = document.getElementById('promoEditId').value;
  if (!Code || isNaN(Value)) { showToast('Fill all fields', 'error'); return; }
  if (editId) await sb.from('Promo').update({ Code, Type, Value }).eq('PromoID', editId);
  else await sb.from('Promo').insert([{ Code, Type, Value }]);
  showToast('Promo saved!', 'success');
  cancelPromoEdit();
  await loadAdminPromos();
  renderPromosTable();
};

window.editPromo = function (id) {
  const p = allAdminPromos.find(x => x.PromoID === id);
  if (!p) return;
  document.getElementById('promoEditId').value = p.PromoID;
  document.getElementById('promoCode').value = p.Code;
  document.getElementById('promoType').value = p.Type;
  document.getElementById('promoValue').value = p.Value;
  document.getElementById('promoFormTitle').textContent = 'Edit Promo';
};

window.deletePromo = async function (id) {
  if (!confirm('Delete?')) return;
  await sb.from('Promo').update({ IsActive: false }).eq('PromoID', id);
  showToast('Deleted', 'success');
  await loadAdminPromos();
  renderPromosTable();
};

window.cancelPromoEdit = function () {
  ['promoEditId', 'promoCode', 'promoValue'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  document.getElementById('promoType').value = 'percent';
  document.getElementById('promoFormTitle').textContent = 'Add Promo';
};

function renderPromosTable() {
  const tbody = document.getElementById('promosTableBody');
  const s = sym();
  const editable = isAdmin();
  tbody.innerHTML = allAdminPromos.map(p => `<tr><td><strong>${escapeHtml(p.Code)}</strong></td><td><span class="badge">${p.Type === 'percent' ? 'Percent' : 'Fixed'}</span></td><td>${p.Type === 'percent' ? p.Value + '%' : s + parseFloat(p.Value).toFixed(2)}</td>${editable ? `<td><button class="btn-icon" onclick="editPromo(${p.PromoID})">✏️</button><button class="btn-icon" onclick="deletePromo(${p.PromoID})">🗑</button></td>` : ''}</tr>`).join('') || `<tr><td colspan="${editable ? 4 : 3}" style="text-align:center;color:var(--text-muted);padding:20px;">No promos.</td></tr>`;
}

window.saveStaff = async function () {
  const name = document.getElementById('staffName').value.trim();
  const username = document.getElementById('staffUser').value.trim();
  const password = document.getElementById('staffPass').value.trim();
  const position = document.getElementById('staffPosition').value.trim();
  const role = document.getElementById('staffRole').value;
  const dob = document.getElementById('staffDob').value || null;
  const dateHired = document.getElementById('staffDateHired').value || null;
  const hourlyRate = parseFloat(document.getElementById('staffHourlyRate').value) || 0;
  const contact = document.getElementById('staffContact').value.trim() || null;
  const email = document.getElementById('staffEmail').value.trim() || null;
  const address = document.getElementById('staffAddress').value.trim() || null;
  const editId = document.getElementById('staffEditId').value;
  if (!name || !username) { showToast('Name and username required', 'error'); return; }
  if (!editId && !password) { showToast('Password required for new staff', 'error'); return; }
  const payload = { Name: name, Username: username, Position: position || 'Cashier', AccessLevel: role, DateofBirth: dob, HourlyRate: hourlyRate, DateHired: dateHired, ContactNumber: contact, Email: email, Address: address };
  if (password) payload.Password = password;
  if (editId) {
    await sb.from('Employee').update(payload).eq('EmployeeID', editId);
  } else {
    await sb.from('Employee').insert([payload]);
  }
  showToast('Staff saved!', 'success');
  cancelStaffEdit();
  await loadStaff();
  renderStaffTable();
};

window.editStaff = function (id) {
  const s = allStaff.find(x => x.EmployeeID === id);
  if (!s) return;
  document.getElementById('staffEditId').value = s.EmployeeID;
  document.getElementById('staffName').value = s.Name;
  document.getElementById('staffUser').value = s.Username || '';
  document.getElementById('staffPass').value = '';
  document.getElementById('staffPass').placeholder = 'leave blank to keep current';
  document.getElementById('staffPosition').value = s.Position || '';
  document.getElementById('staffRole').value = s.AccessLevel || 'Staff';
  document.getElementById('staffDob').value = (s.DateofBirth || '').toString().split('T')[0] || '';
  document.getElementById('staffDateHired').value = (s.DateHired || '').toString().split('T')[0] || '';
  document.getElementById('staffHourlyRate').value = s.HourlyRate ?? '';
  document.getElementById('staffContact').value = s.ContactNumber || '';
  document.getElementById('staffEmail').value = s.Email || '';
  document.getElementById('staffAddress').value = s.Address || '';
  document.getElementById('staffFormTitle').textContent = 'Edit Staff';
};

window.deleteStaff = async function (id) {
  if (id === currentUser?.EmployeeID) { showToast("Can't delete yourself!", 'error'); return; }
  if (!confirm('Delete this staff?')) return;
  await sb.from('Employee').delete().eq('EmployeeID', id);
  showToast('Deleted', 'success');
  await loadStaff();
  renderStaffTable();
};

window.cancelStaffEdit = function () {
  ['staffEditId', 'staffName', 'staffUser', 'staffPass', 'staffPosition', 'staffDob', 'staffDateHired', 'staffHourlyRate', 'staffContact', 'staffEmail', 'staffAddress'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const pp = document.getElementById('staffPass');
  if (pp) pp.placeholder = 'password';
  document.getElementById('staffFormTitle').textContent = 'Add Staff';
};

window.openStaffInfo = function (id) {
  const s = allStaff.find(x => x.EmployeeID === id);
  if (!s) return;
  const fmt = v => (v == null || v === '') ? '—' : escapeHtml(String(v));
  const dob = (s.DateofBirth || '').toString().split('T')[0];
  const hired = (s.DateHired || '').toString().split('T')[0];
  document.getElementById('staffInfoContent').innerHTML = `<div class="account-row"><span>Full Name</span><strong>${fmt(s.Name)}</strong></div><div class="account-row"><span>Username</span><strong>${fmt(s.Username)}</strong></div><div class="account-row"><span>Position</span><strong>${fmt(s.Position)}</strong></div><div class="account-row"><span>Password</span><strong>••••••••</strong></div><div class="account-row"><span>Access Level</span><strong>${fmt(s.AccessLevel)}</strong></div><div class="account-row"><span>Per hour salary</span><strong>₱${parseFloat(s.HourlyRate ?? 0).toFixed(2)}</strong></div><div class="account-row"><span>Date of Birth</span><strong>${fmt(dob)}</strong></div><div class="account-row"><span>Date Hired</span><strong>${fmt(hired)}</strong></div><div class="account-row"><span>Contact</span><strong>${fmt(s.ContactNumber)}</strong></div><div class="account-row"><span>Email</span><strong>${fmt(s.Email)}</strong></div><div class="account-row"><span>Address</span><strong>${fmt(s.Address)}</strong></div>`;
  document.getElementById('staffInfoModal').classList.add('open');
};
window.closeStaffInfo = function () { document.getElementById('staffInfoModal').classList.remove('open'); };

function renderStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  tbody.innerHTML = allStaff.map(s => `<tr style="cursor:pointer;" onclick="openStaffInfo(${s.EmployeeID})" title="Click to view info"><td>${escapeHtml(s.Name)}</td><td>${escapeHtml(s.Username || '—')}</td><td>${escapeHtml(s.Position || '—')}</td><td><span class="badge">${escapeHtml(s.AccessLevel)}</span></td><td><button class="btn-icon" onclick="event.stopPropagation();editStaff(${s.EmployeeID})">✏️</button><button class="btn-icon" onclick="event.stopPropagation();deleteStaff(${s.EmployeeID})">🗑</button></td></tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">No staff.</td></tr>';
}