// Mommy's FoodHub — script.js (Full Featured)
const sb = window.supabase;

let currentUser = null;
let cart = [];
let allProducts = [];
let allPromos = [];
let allStaff = [];
let selectedCategory = 'All';
let activePromo = null;
let selectedPayment = 'Cash';
let queueCounter = 1;
let settings = { name: "Mommy's FoodHub", address: '', contact: '', footer: 'Thank you for dining with us! 🙏' };

const DEMO_USERS = [
  { username: 'admin',   password_plain: 'admin123', role: 'Admin' },
  { username: 'cashier', password_plain: 'cashier1', role: 'Cashier' },
];

/* ══════════ AUTH ══════════ */
window.doLogin = async function () {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  let user = null;
  try {
    const { data } = await sb.from('cashiers').select('*').eq('username', u).eq('password_plain', p).single();
    if (data) user = data;
  } catch (_) {}
  if (!user) user = DEMO_USERS.find(x => x.username === u && x.password_plain === p);
  if (!user) { errEl.textContent = 'Invalid username or password.'; return; }
  currentUser = user;
  document.getElementById('cashierName').textContent = user.username;
  document.getElementById('roleTag').textContent = user.role;
  document.getElementById('roleTag').className = 'role-tag ' + (user.role === 'Admin' ? 'admin' : 'cashier');
  // Show/hide admin tabs
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = user.role === 'Admin' ? '' : 'none';
  });
  const ls = document.getElementById('loginScreen');
  ls.style.opacity = '0';
  setTimeout(() => {
    ls.style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'flex'; app.style.flexDirection = 'column';
    init();
  }, 400);
};

window.doLogout = function () {
  currentUser = null; cart = [];
  document.getElementById('app').style.display = 'none';
  const ls = document.getElementById('loginScreen');
  ls.style.display = 'flex'; ls.style.opacity = '1';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

/* ══════════ INIT ══════════ */
async function init() {
  loadSettings();
  await loadProducts();
  await loadPromos();
  renderCatFilters();
  renderProductGrid();
  updateOfflineBadge();
  // Get today's queue counter
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await sb.from('orders').select('*', { count: 'exact', head: true })
      .gte('created_at', today + 'T00:00:00');
    queueCounter = (count || 0) + 1;
  } catch (_) {}
}

/* ══════════ SETTINGS ══════════ */
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('pos_settings') || '{}');
    settings = { ...settings, ...s };
    if (s.name) document.getElementById('settingName').value = s.name;
    if (s.address) document.getElementById('settingAddress').value = s.address;
    if (s.contact) document.getElementById('settingContact').value = s.contact;
    if (s.footer) document.getElementById('settingFooter').value = s.footer;
  } catch(_) {}
}

window.saveSettings = function () {
  settings = {
    name:    document.getElementById('settingName').value    || "Mommy's FoodHub",
    address: document.getElementById('settingAddress').value || '',
    contact: document.getElementById('settingContact').value || '',
    footer:  document.getElementById('settingFooter').value  || 'Thank you for dining with us! 🙏',
  };
  localStorage.setItem('pos_settings', JSON.stringify(settings));
  showToast('Settings saved!', 'success');
};

/* ══════════ PRODUCTS ══════════ */
async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').order('name');
  if (error) { showToast('Could not load products', 'error'); return; }
  allProducts = data || [];
}

window.filterProducts = function () { renderProductGrid(); };

function getCategories() {
  return ['All', ...[...new Set(allProducts.map(p => p.category || 'Other'))].sort()];
}

function renderCatFilters() {
  const wrap = document.getElementById('catFilters');
  wrap.innerHTML = '';
  getCategories().forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn' + (cat === selectedCategory ? ' active' : '');
    btn.textContent = cat;
    btn.onclick = () => {
      selectedCategory = cat;
      document.querySelectorAll('#catFilters .cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); renderProductGrid();
    };
    wrap.appendChild(btn);
  });
}

function renderProductGrid() {
  const q = document.getElementById('menuSearch').value.toLowerCase();
  const grid = document.getElementById('productGrid');
  const filtered = allProducts.filter(p => {
    const matchCat = selectedCategory === 'All' || (p.category || 'Other') === selectedCategory;
    return matchCat && (!q || p.name.toLowerCase().includes(q));
  });
  if (!filtered.length) { grid.innerHTML = '<div class="no-products">No items found.</div>'; return; }
  grid.innerHTML = '';
  filtered.forEach(p => {
    const d = document.createElement('div');
    d.className = 'product-card';
    d.innerHTML = `<div class="p-name">${p.name}</div><div class="p-price">₱${parseFloat(p.price).toFixed(2)}</div><div class="p-cat">${p.category || ''}</div>`;
    d.onclick = () => addToCart(p);
    grid.appendChild(d);
  });
}

/* ══════════ CART ══════════ */
function addToCart(p) {
  const ex = cart.find(i => i.id === p.id);
  if (ex) ex.quantity++;
  else cart.push({ id: p.id, name: p.name, price: p.price, quantity: 1 });
  renderCart();
}

window.changeQty = function (id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
  renderCart();
};

window.removeFromCart = function (id) { cart = cart.filter(i => i.id !== id); renderCart(); };

window.clearCart = function () {
  cart = []; activePromo = null;
  document.getElementById('promoInput').value = '';
  document.getElementById('promoMsg').textContent = '';
  document.getElementById('orderNotes').value = '';
  document.getElementById('cashReceived').value = '';
  document.getElementById('changeAmt').textContent = '₱0.00';
  renderCart();
};

function cartSubtotal() { return cart.reduce((s, i) => s + i.price * i.quantity, 0); }
function cartTotal() {
  const sub = cartSubtotal();
  if (!activePromo) return sub;
  if (activePromo.type === 'percent') return Math.max(0, sub - sub * activePromo.value / 100);
  return Math.max(0, sub - activePromo.value);
}
function discountAmount() { return cartSubtotal() - cartTotal(); }

function renderCart() {
  const wrap = document.getElementById('cartItems');
  const total = cartTotal();
  document.getElementById('cartTotal').textContent = total.toFixed(2);
  const dl = document.getElementById('discountLine');
  if (activePromo && discountAmount() > 0) {
    dl.style.display = 'block';
    dl.textContent = `− ₱${discountAmount().toFixed(2)} (${activePromo.code})`;
  } else { dl.style.display = 'none'; }
  document.getElementById('changeCalc').style.display = selectedPayment === 'Cash' ? 'block' : 'none';
  calcChange();

  const cartHTML = !cart.length
    ? '<div class="cart-empty">No items yet.<br>Tap a product to add.</div>'
    : cart.map(i => `
    <div class="cart-item">
      <div style="flex:1"><div class="ci-name">${i.name}</div><div class="ci-sub">₱${parseFloat(i.price).toFixed(2)} each</div></div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="changeQty('${i.id}',-1)">−</button>
        <span class="qty-val">${i.quantity}</span>
        <button class="qty-btn" onclick="changeQty('${i.id}',1)">+</button>
      </div>
      <div class="ci-total">₱${(i.price * i.quantity).toFixed(2)}</div>
      <button class="ci-del" onclick="removeFromCart('${i.id}')">×</button>
    </div>`).join('');

  if (wrap) wrap.innerHTML = cartHTML;

  // Sync mobile cart
  const mobileWrap = document.getElementById('cartItemsMobile');
  if (mobileWrap) mobileWrap.innerHTML = cartHTML;

  // Sync mobile footer
  const mobileFooter = document.getElementById('cartFooterMobile');
  if (mobileFooter) mobileFooter.innerHTML = document.getElementById('cartFooter')
    ? document.querySelector('.cart-footer').innerHTML : '';

  // Update FAB
  const totalItems = cart.reduce((s,i) => s+i.quantity, 0);
  const fabCount = document.getElementById('cartFabCount');
  const fabTotal = document.getElementById('cartFabTotal');
  const fab = document.getElementById('cartFab');
  if (fabCount) fabCount.textContent = totalItems;
  if (fabTotal) fabTotal.textContent = '₱'+total.toFixed(2);
  if (fab) fab.classList.toggle('has-items', totalItems > 0);
}

/* ══════════ PAYMENT & CHANGE ══════════ */
window.setPayment = function (method, btn) {
  selectedPayment = method;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCart();
};

window.calcChange = function () {
  const received = parseFloat(document.getElementById('cashReceived').value) || 0;
  const change = received - cartTotal();
  const el = document.getElementById('changeAmt');
  el.textContent = '₱' + Math.max(0, change).toFixed(2);
  el.style.color = change >= 0 ? 'var(--green)' : 'var(--red)';
};

/* ══════════ PROMO ══════════ */
async function loadPromos() {
  const { data, error } = await sb.from('promos').select('*');
  if (!error) allPromos = data || [];
}

window.applyPromo = function () {
  const code = document.getElementById('promoInput').value.trim().toUpperCase();
  const msgEl = document.getElementById('promoMsg');
  const promo = allPromos.find(p => p.code.toUpperCase() === code);
  if (!promo) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Invalid promo code.'; activePromo = null; renderCart(); return; }
  activePromo = promo;
  msgEl.style.color = 'var(--green)';
  msgEl.textContent = promo.type === 'percent' ? `✓ ${promo.value}% off!` : `✓ ₱${promo.value} off!`;
  renderCart();
};

window.savePromo = async function () {
  const code = document.getElementById('promoCode').value.trim().toUpperCase();
  const type = document.getElementById('promoType').value;
  const value = parseFloat(document.getElementById('promoValue').value);
  const editId = document.getElementById('promoEditId').value;
  if (!code || isNaN(value)) { showToast('Fill in all fields', 'error'); return; }
  if (editId) { await sb.from('promos').update({ code, type, value }).eq('id', editId); }
  else { await sb.from('promos').insert([{ code, type, value }]); }
  showToast('Promo saved!', 'success'); cancelPromoEdit();
  await loadPromos(); renderPromosTable();
};
window.editPromo = function (id) {
  const p = allPromos.find(x => x.id === id); if (!p) return;
  document.getElementById('promoEditId').value = p.id;
  document.getElementById('promoCode').value = p.code;
  document.getElementById('promoType').value = p.type;
  document.getElementById('promoValue').value = p.value;
  document.getElementById('promoFormTitle').textContent = 'Edit Promo';
};
window.deletePromo = async function (id) {
  if (!confirm('Delete?')) return;
  await sb.from('promos').delete().eq('id', id);
  showToast('Deleted', 'success'); await loadPromos(); renderPromosTable();
};
window.cancelPromoEdit = function () {
  document.getElementById('promoEditId').value = '';
  document.getElementById('promoCode').value = '';
  document.getElementById('promoValue').value = '';
  document.getElementById('promoFormTitle').textContent = 'Add Promo Code';
};
function renderPromosTable() {
  const tbody = document.getElementById('promosTableBody');
  if (!allPromos.length) { tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:24px">No promos yet.</td></tr>'; return; }
  tbody.innerHTML = allPromos.map(p => `<tr>
    <td><strong>${p.code}</strong></td>
    <td><span class="badge">${p.type === 'percent' ? 'Percent' : 'Fixed'}</span></td>
    <td>${p.type === 'percent' ? p.value + '%' : '₱' + parseFloat(p.value).toFixed(2)}</td>
    <td><button class="btn-icon" onclick="editPromo('${p.id}')">✏️</button><button class="btn-icon" onclick="deletePromo('${p.id}')">🗑</button></td>
  </tr>`).join('');
}

/* ══════════ STAFF ══════════ */
window.saveStaff = async function () {
  const username = document.getElementById('staffUser').value.trim();
  const password_plain = document.getElementById('staffPass').value.trim();
  const role = document.getElementById('staffRole').value;
  const editId = document.getElementById('staffEditId').value;
  if (!username || !password_plain) { showToast('Fill in all fields', 'error'); return; }
  if (editId) { await sb.from('cashiers').update({ username, password_plain, role }).eq('id', editId); }
  else { await sb.from('cashiers').insert([{ username, password_plain, role }]); }
  showToast('Staff saved!', 'success'); cancelStaffEdit();
  await loadStaff(); renderStaffTable();
};
async function loadStaff() {
  const { data } = await sb.from('cashiers').select('*').order('username');
  allStaff = data || [];
}
window.editStaff = function (id) {
  const s = allStaff.find(x => x.id === id); if (!s) return;
  document.getElementById('staffEditId').value = s.id;
  document.getElementById('staffUser').value = s.username;
  document.getElementById('staffPass').value = s.password_plain;
  document.getElementById('staffRole').value = s.role;
  document.getElementById('staffFormTitle').textContent = 'Edit Staff';
};
window.deleteStaff = async function (id) {
  if (id === currentUser.id) { showToast("Can't delete yourself!", 'error'); return; }
  if (!confirm('Delete this staff?')) return;
  await sb.from('cashiers').delete().eq('id', id);
  showToast('Deleted', 'success'); await loadStaff(); renderStaffTable();
};
window.cancelStaffEdit = function () {
  document.getElementById('staffEditId').value = '';
  document.getElementById('staffUser').value = '';
  document.getElementById('staffPass').value = '';
  document.getElementById('staffFormTitle').textContent = 'Add Staff';
};
function renderStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  if (!allStaff.length) { tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-muted);text-align:center;padding:24px">No staff yet.</td></tr>'; return; }
  tbody.innerHTML = allStaff.map(s => `<tr>
    <td>${s.username}</td>
    <td><span class="badge">${s.role}</span></td>
    <td><button class="btn-icon" onclick="editStaff('${s.id}')">✏️</button><button class="btn-icon" onclick="deleteStaff('${s.id}')">🗑</button></td>
  </tr>`).join('');
}

/* ══════════ CHECKOUT ══════════ */
window.openCheckoutModal = function () {
  if (!cart.length) { showToast('Cart is empty!', 'error'); return; }
  const sub = cartSubtotal(), disc = discountAmount(), total = cartTotal();
  const cash = parseFloat(document.getElementById('cashReceived').value) || 0;
  const change = selectedPayment === 'Cash' ? Math.max(0, cash - total) : null;
  document.getElementById('modalBody').innerHTML =
    `<strong>Queue #${queueCounter}</strong> · ${cart.length} item(s)<br>` +
    cart.map(i => `${i.name} × ${i.quantity} = ₱${(i.price * i.quantity).toFixed(2)}`).join('<br>') +
    `<hr style="border-color:#3d2b14;margin:10px 0;">` +
    (disc > 0 ? `<span style="color:var(--text-muted)">Subtotal: ₱${sub.toFixed(2)}</span><br><span style="color:var(--green)">Discount (${activePromo.code}): − ₱${disc.toFixed(2)}</span><br>` : '') +
    `<strong>Total: ₱${total.toFixed(2)}</strong><br>` +
    `Payment: ${selectedPayment}` +
    (change !== null ? `<br>Change: <strong style="color:var(--green)">₱${change.toFixed(2)}</strong>` : '');
  document.getElementById('checkoutModal').classList.add('open');
};

window.closeModal = function () { document.getElementById('checkoutModal').classList.remove('open'); };

window.checkout = async function () {
  closeModal();
  const orderData = {
    order_items: cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity })),
    total: cartTotal(),
    cashier: currentUser.username,
    discount_code: activePromo ? activePromo.code : null,
    discount_amount: discountAmount(),
    payment_method: selectedPayment,
    notes: document.getElementById('orderNotes').value.trim(),
    queue_number: queueCounter,
  };

  if (!navigator.onLine) {
    saveOfflineOrder(orderData);
    showToast(`Saved offline! Queue #${queueCounter}`, 'success');
    showReceiptFromData(orderData, null);
    queueCounter++;
    clearCart();
    return;
  }

  const { data, error } = await sb.from('orders').insert([{ ...orderData, created_at: new Date().toISOString() }]).select();
  if (error) {
    saveOfflineOrder(orderData);
    showToast('Saved offline (will sync later)', 'error');
  } else {
    showToast(`Order saved! Queue #${queueCounter} ₱${cartTotal().toFixed(2)}`, 'success');
  }
  const orderId = data && data[0] ? data[0].id.slice(0,8).toUpperCase() : null;
  showReceiptFromData(orderData, orderId);
  queueCounter++;
  clearCart();
};

/* ══════════ OFFLINE SUPPORT ══════════ */
function saveOfflineOrder(order) {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  pending.push({ ...order, saved_at: new Date().toISOString() });
  localStorage.setItem('offline_orders', JSON.stringify(pending));
  updateOfflineBadge();
}

window.syncOfflineOrders = async function () {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  if (!pending.length) { showToast('No offline orders to sync', ''); return; }
  if (!navigator.onLine) { showToast('Still offline!', 'error'); return; }
  let synced = 0, failed = 0;
  for (const order of pending) {
    const { error } = await sb.from('orders').insert([{ ...order, created_at: order.saved_at }]);
    if (!error) synced++; else failed++;
  }
  if (synced > 0) {
    const remaining = pending.slice(synced);
    localStorage.setItem('offline_orders', JSON.stringify(remaining));
    showToast(`Synced ${synced} order(s)!`, 'success');
    updateOfflineBadge();
  }
  if (failed > 0) showToast(`${failed} order(s) failed to sync`, 'error');
};

function updateOfflineBadge() {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  const el = document.getElementById('statOffline');
  if (el) el.textContent = pending.length;
}

/* ══════════ RECEIPT ══════════ */
function showReceiptFromData(order, orderId) {
  document.getElementById('receiptContent').innerHTML = buildReceiptHTML(order, orderId);
  document.getElementById('receiptModal').classList.add('open');
}

function buildReceiptHTML(order, orderId) {
  const now = new Date();
  const itemRows = order.order_items.map(i =>
    `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₱${(i.price*i.quantity).toFixed(2)}</td></tr>`
  ).join('');
  const sub = order.order_items.reduce((s,i) => s + i.price*i.quantity, 0);
  const disc = order.discount_amount || 0;
  const total = order.total;
  return `
    <div style="font-family:monospace;font-size:13px;color:#1a1008;padding:8px;">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:17px;font-weight:bold;">${settings.name}</div>
        ${settings.address ? `<div style="font-size:11px;color:#666;">${settings.address}</div>` : ''}
        ${settings.contact ? `<div style="font-size:11px;color:#666;">${settings.contact}</div>` : ''}
        <div style="font-size:11px;color:#666;margin-top:4px;">${now.toLocaleDateString()} ${now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
        <div style="font-size:11px;color:#666;">Cashier: ${order.cashier} | Queue #${order.queue_number}</div>
        ${orderId ? `<div style="font-size:11px;color:#666;">Order ID: ${orderId}</div>` : '<div style="font-size:11px;color:#e66;">⚠ Offline Order</div>'}
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="font-size:11px;color:#999;"><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>₱${sub.toFixed(2)}</span></div>
      ${disc > 0 ? `<div style="display:flex;justify-content:space-between;color:green;"><span>Discount (${order.discount_code})</span><span>− ₱${disc.toFixed(2)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:6px;"><span>TOTAL</span><span>₱${total.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:12px;color:#555;"><span>Payment</span><span>${order.payment_method}</span></div>
      ${order.notes ? `<div style="margin-top:6px;font-size:11px;color:#555;"><em>Notes: ${order.notes}</em></div>` : ''}
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <div style="text-align:center;font-size:11px;color:#999;">${settings.footer}</div>
    </div>`;
}

window.closeReceipt = function () { document.getElementById('receiptModal').classList.remove('open'); };
window.printReceipt = function () {
  const content = document.getElementById('receiptContent').innerHTML;
  document.getElementById('printArea').innerHTML = content;
  document.getElementById('printArea').style.display = 'block';
  window.print();
  document.getElementById('printArea').style.display = 'none';
};

/* ══════════ PRODUCTS MGMT ══════════ */
window.saveProduct = async function () {
  const name = document.getElementById('pName').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const cat = document.getElementById('pCat').value.trim();
  const editId = document.getElementById('editId').value;
  if (!name || isNaN(price)) { showToast('Fill in name and price', 'error'); return; }
  if (editId) { await sb.from('products').update({ name, price, category: cat }).eq('id', editId); }
  else { await sb.from('products').insert([{ name, price, category: cat }]); }
  showToast('Item saved!', 'success'); cancelEdit();
  await loadProducts(); renderCatFilters(); renderProductGrid(); renderProductsTable();
};
window.editProduct = function (id) {
  const p = allProducts.find(x => x.id === id); if (!p) return;
  document.getElementById('editId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pCat').value = p.category || '';
  document.getElementById('formTitle').textContent = 'Edit Item';
};
window.deleteProduct = async function (id) {
  if (!confirm('Delete this item?')) return;
  await sb.from('products').delete().eq('id', id);
  showToast('Deleted', 'success');
  await loadProducts(); renderCatFilters(); renderProductGrid(); renderProductsTable();
};
window.cancelEdit = function () {
  document.getElementById('editId').value = '';
  document.getElementById('pName').value = '';
  document.getElementById('pPrice').value = '';
  document.getElementById('pCat').value = '';
  document.getElementById('formTitle').textContent = 'Add New Item';
};
function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  if (!allProducts.length) { tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:24px">No items yet.</td></tr>'; return; }
  tbody.innerHTML = allProducts.map(p => `<tr>
    <td>${p.name}</td><td>₱${parseFloat(p.price).toFixed(2)}</td>
    <td><span class="badge">${p.category || '—'}</span></td>
    <td><button class="btn-icon" onclick="editProduct('${p.id}')">✏️</button><button class="btn-icon" onclick="deleteProduct('${p.id}')">🗑</button></td>
  </tr>`).join('');
}

/* ══════════ REPORTS ══════════ */
window.loadReports = async function () {
  let query = sb.from('orders').select('*').order('created_at', { ascending: false });
  const dateVal = document.getElementById('filterDate').value;
  if (dateVal) query = query.gte('created_at', dateVal+'T00:00:00').lte('created_at', dateVal+'T23:59:59');
  const { data: orders, error } = await query;
  if (error) { showToast('Error loading orders', 'error'); return; }

  const total = (orders||[]).reduce((s,o) => s+(o.total||0), 0);
  const avg = orders && orders.length ? total/orders.length : 0;
  document.getElementById('statOrders').textContent = orders ? orders.length : 0;
  document.getElementById('statRevenue').textContent = '₱'+total.toFixed(2);
  document.getElementById('statAvg').textContent = '₱'+avg.toFixed(2);
  updateOfflineBadge();

  // Best sellers
  renderBestSellers(orders || []);

  const tbody = document.getElementById('ordersBody');
  if (!orders || !orders.length) { tbody.innerHTML = '<tr><td colspan="8" style="color:var(--text-muted);text-align:center;padding:30px">No orders found.</td></tr>'; return; }
  tbody.innerHTML = orders.map((o, idx) => {
    const items = (o.order_items||[]).map(i => `${i.name} ×${i.quantity}`).join(', ');
    const d = new Date(o.created_at);
    return `<tr>
      <td>${orders.length-idx}</td>
      <td><span class="queue-badge">#${o.queue_number||'—'}</span></td>
      <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
      <td>${o.cashier||'—'}</td>
      <td><span class="badge">${o.payment_method||'Cash'}</span></td>
      <td class="order-items-list">${items}</td>
      <td class="order-items-list">${o.notes||'—'}</td>
      <td class="order-total">₱${parseFloat(o.total).toFixed(2)}</td>
    </tr>`;
  }).join('');
};

function renderBestSellers(orders) {
  const counts = {};
  orders.forEach(o => (o.order_items||[]).forEach(i => {
    counts[i.name] = (counts[i.name]||0) + i.quantity;
  }));
  const sorted = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,8);
  const max = sorted[0] ? sorted[0][1] : 1;
  const container = document.getElementById('bestSellersChart');
  if (!sorted.length) { container.innerHTML = '<div style="color:var(--text-muted);padding:20px;">No data yet.</div>'; return; }
  container.innerHTML = sorted.map(([name, qty]) => `
    <div class="bs-row">
      <div class="bs-name">${name}</div>
      <div class="bs-bar-wrap"><div class="bs-bar" style="width:${(qty/max*100).toFixed(1)}%"></div></div>
      <div class="bs-qty">${qty}</div>
    </div>`).join('');
}

window.clearDateFilter = function (btn) { document.getElementById('filterDate').value = ''; loadReports(); };

/* ══════════ EXPORT EXCEL ══════════ */
window.exportToExcel = async function () {
  const { data: orders } = await sb.from('orders').select('*').order('created_at', { ascending: false });
  if (!orders || !orders.length) { showToast('No orders to export', 'error'); return; }
  const rows = [['#','Queue','Date','Time','Cashier','Payment','Items','Notes','Discount Code','Discount Amount','Total']];
  orders.forEach((o,idx) => {
    const d = new Date(o.created_at);
    const items = (o.order_items||[]).map(i => `${i.name} x${i.quantity}`).join(' | ');
    rows.push([
      idx+1, o.queue_number||'', d.toLocaleDateString(), d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}),
      o.cashier||'', o.payment_method||'Cash', items, o.notes||'',
      o.discount_code||'', o.discount_amount||0, o.total
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Exported!', 'success');
};

/* ══════════ MOBILE UI ══════════ */
window.toggleMobileCart = function () {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartDrawerOverlay');
  const isOpen = drawer.classList.contains('open');
  drawer.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  // Sync footer into mobile drawer
  if (!isOpen) {
    const src = document.querySelector('#page-cashier .cart-footer');
    const dest = document.getElementById('cartFooterMobile');
    if (src && dest) dest.innerHTML = src.innerHTML;
  }
};

window.showMoreMenu = function () {
  document.getElementById('moreMenu').classList.add('open');
  document.getElementById('moreMenuOverlay').classList.add('open');
};
window.closeMoreMenu = function () {
  document.getElementById('moreMenu').classList.remove('open');
  document.getElementById('moreMenuOverlay').classList.remove('open');
};

/* ══════════ NAVIGATION ══════════ */
window.showPage = function (name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  if (btn) btn.classList.add('active');
  // sync both navbars
  document.querySelectorAll(`[data-page="${name}"]`).forEach(b => b.classList.add('active'));
  if (name === 'products') renderProductsTable();
  if (name === 'reports')  loadReports();
  if (name === 'promos')   renderPromosTable();
  if (name === 'staff')    { loadStaff().then(renderStaffTable); }
  if (name === 'settings') loadSettings();
};

/* ══════════ TOAST ══════════ */
let toastTimer;
function showToast(msg, type='') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show '+type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}

/* ══════════════════════════════
   MOBILE CART DRAWER
══════════════════════════════ */
window.toggleMobileCart = function () {
  const drawer = document.getElementById('cartDrawer');
  const overlay = document.getElementById('cartDrawerOverlay');
  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    overlay.classList.remove('open');
  } else {
    syncMobileCart();
    drawer.classList.add('open');
    overlay.classList.add('open');
  }
};

function syncMobileCart() {
  // Mirror cart items into mobile drawer
  const mobileItems = document.getElementById('cartItemsMobile');
  const desktopItems = document.getElementById('cartItems');
  mobileItems.innerHTML = desktopItems.innerHTML;

  // Mirror cart footer
  const mobileFooter = document.getElementById('cartFooterMobile');
  const desktopFooter = document.querySelector('.cart-footer');
  mobileFooter.innerHTML = desktopFooter.innerHTML;

  // Update FAB
  updateCartFab();
}

function updateCartFab() {
  const count = cart.reduce((s, i) => s + i.quantity, 0);
  const fabCount = document.getElementById('cartFabCount');
  const fabTotal = document.getElementById('cartFabTotal');
  if (fabCount) fabCount.textContent = count;
  if (fabTotal) fabTotal.textContent = '₱' + cartTotal().toFixed(2);
  const fab = document.getElementById('cartFab');
  if (fab) fab.classList.toggle('has-items', count > 0);
}