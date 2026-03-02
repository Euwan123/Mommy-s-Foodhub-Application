// Mommy's FoodHub — script.js
// Uses window.supabase set in index.html

const sb = window.supabase;

let currentUser = null;
let cart = [];
let allProducts = [];
let allPromos = [];
let selectedCategory = 'All';
let activePromo = null;

const DEMO_USERS = [
  { username: 'admin',   password_plain: 'admin123', role: 'Admin' },
  { username: 'cashier', password_plain: 'cashier1', role: 'Cashier' },
];

/* ══════════════════════════════════
   AUTH
══════════════════════════════════ */
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
  const ls = document.getElementById('loginScreen');
  ls.style.opacity = '0';
  setTimeout(() => {
    ls.style.display = 'none';
    const app = document.getElementById('app');
    app.style.display = 'flex';
    app.style.flexDirection = 'column';
    init();
  }, 400);
};

window.doLogout = function () {
  currentUser = null;
  cart = [];
  document.getElementById('app').style.display = 'none';
  const ls = document.getElementById('loginScreen');
  ls.style.display = 'flex';
  ls.style.opacity = '1';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginPass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
async function init() {
  await loadProducts();
  await loadPromos();
  renderCatFilters();
  renderProductGrid();
}

/* ══════════════════════════════════
   PRODUCTS
══════════════════════════════════ */
async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').order('name');
  if (error) { showToast('Could not load products', 'error'); return; }
  allProducts = data || [];
}

window.filterProducts = function () { renderProductGrid(); };

function getCategories() {
  const cats = [...new Set(allProducts.map(p => p.category || 'Other'))];
  return ['All', ...cats.sort()];
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
      btn.classList.add('active');
      renderProductGrid();
    };
    wrap.appendChild(btn);
  });
}

function renderProductGrid() {
  const q = document.getElementById('menuSearch').value.toLowerCase();
  const grid = document.getElementById('productGrid');
  const filtered = allProducts.filter(p => {
    const matchCat = selectedCategory === 'All' || (p.category || 'Other') === selectedCategory;
    const matchQ = !q || p.name.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
  if (!filtered.length) { grid.innerHTML = '<div class="no-products">No items found.</div>'; return; }
  grid.innerHTML = '';
  filtered.forEach(p => {
    const d = document.createElement('div');
    d.className = 'product-card';
    d.innerHTML = `
      <div class="p-name">${p.name}</div>
      <div class="p-price">₱${parseFloat(p.price).toFixed(2)}</div>
      <div class="p-cat">${p.category || ''}</div>
    `;
    d.onclick = () => addToCart(p);
    grid.appendChild(d);
  });
}

/* ══════════════════════════════════
   CART
══════════════════════════════════ */
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

window.removeFromCart = function (id) {
  cart = cart.filter(i => i.id !== id);
  renderCart();
};

window.clearCart = function () {
  cart = [];
  activePromo = null;
  document.getElementById('promoInput').value = '';
  document.getElementById('promoMsg').textContent = '';
  renderCart();
};

function cartSubtotal() {
  return cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

function cartTotal() {
  const sub = cartSubtotal();
  if (!activePromo) return sub;
  if (activePromo.type === 'percent') return Math.max(0, sub - (sub * activePromo.value / 100));
  if (activePromo.type === 'fixed')   return Math.max(0, sub - activePromo.value);
  return sub;
}

function discountAmount() {
  return cartSubtotal() - cartTotal();
}

function renderCart() {
  const wrap = document.getElementById('cartItems');
  const sub = cartSubtotal();
  const total = cartTotal();
  document.getElementById('cartTotal').textContent = total.toFixed(2);

  const discLine = document.getElementById('discountLine');
  if (activePromo && discountAmount() > 0) {
    discLine.style.display = 'block';
    discLine.textContent = `− ₱${discountAmount().toFixed(2)} (${activePromo.code})`;
  } else {
    discLine.style.display = 'none';
  }

  if (!cart.length) {
    wrap.innerHTML = '<div class="cart-empty">No items yet.<br>Tap a product to add.</div>';
    return;
  }
  wrap.innerHTML = cart.map(i => `
    <div class="cart-item">
      <div style="flex:1">
        <div class="ci-name">${i.name}</div>
        <div class="ci-sub">₱${parseFloat(i.price).toFixed(2)} each</div>
      </div>
      <div class="qty-ctrl">
        <button class="qty-btn" onclick="changeQty('${i.id}', -1)">−</button>
        <span class="qty-val">${i.quantity}</span>
        <button class="qty-btn" onclick="changeQty('${i.id}', 1)">+</button>
      </div>
      <div class="ci-total">₱${(i.price * i.quantity).toFixed(2)}</div>
      <button class="ci-del" onclick="removeFromCart('${i.id}')">×</button>
    </div>
  `).join('');
}

/* ══════════════════════════════════
   PROMO CODES
══════════════════════════════════ */
async function loadPromos() {
  const { data, error } = await sb.from('promos').select('*');
  if (!error) allPromos = data || [];
}

window.applyPromo = function () {
  const code = document.getElementById('promoInput').value.trim().toUpperCase();
  const msgEl = document.getElementById('promoMsg');
  const promo = allPromos.find(p => p.code.toUpperCase() === code);
  if (!promo) {
    msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Invalid promo code.';
    activePromo = null; renderCart(); return;
  }
  activePromo = promo;
  msgEl.style.color = 'var(--green)';
  msgEl.textContent = promo.type === 'percent'
    ? `✓ ${promo.value}% off applied!`
    : `✓ ₱${promo.value} off applied!`;
  renderCart();
};

window.savePromo = async function () {
  const code  = document.getElementById('promoCode').value.trim().toUpperCase();
  const type  = document.getElementById('promoType').value;
  const value = parseFloat(document.getElementById('promoValue').value);
  const editId = document.getElementById('promoEditId').value;
  if (!code || isNaN(value)) { showToast('Fill in all fields', 'error'); return; }

  if (editId) {
    const { error } = await sb.from('promos').update({ code, type, value }).eq('id', editId);
    if (error) { showToast('Update failed', 'error'); return; }
    showToast('Promo updated!', 'success');
  } else {
    const { error } = await sb.from('promos').insert([{ code, type, value }]);
    if (error) { showToast('Add failed', 'error'); return; }
    showToast('Promo added!', 'success');
  }
  cancelPromoEdit();
  await loadPromos();
  renderPromosTable();
};

window.editPromo = function (id) {
  const p = allPromos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('promoEditId').value = p.id;
  document.getElementById('promoCode').value = p.code;
  document.getElementById('promoType').value = p.type;
  document.getElementById('promoValue').value = p.value;
  document.getElementById('promoFormTitle').textContent = 'Edit Promo';
};

window.deletePromo = async function (id) {
  if (!confirm('Delete this promo?')) return;
  const { error } = await sb.from('promos').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Promo deleted', 'success');
  await loadPromos();
  renderPromosTable();
};

window.cancelPromoEdit = function () {
  document.getElementById('promoEditId').value = '';
  document.getElementById('promoCode').value = '';
  document.getElementById('promoValue').value = '';
  document.getElementById('promoFormTitle').textContent = 'Add Promo Code';
};

function renderPromosTable() {
  const tbody = document.getElementById('promosTableBody');
  if (!allPromos.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:30px">No promos yet.</td></tr>';
    return;
  }
  tbody.innerHTML = allPromos.map(p => `
    <tr>
      <td><strong>${p.code}</strong></td>
      <td><span class="badge">${p.type === 'percent' ? 'Percent' : 'Fixed'}</span></td>
      <td>${p.type === 'percent' ? p.value + '%' : '₱' + parseFloat(p.value).toFixed(2)}</td>
      <td>
        <button class="btn-icon" onclick="editPromo('${p.id}')">✏️</button>
        <button class="btn-icon" onclick="deletePromo('${p.id}')">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ══════════════════════════════════
   RECEIPT
══════════════════════════════════ */
function buildReceiptHTML(orderNum) {
  const now = new Date();
  const sub = cartSubtotal();
  const disc = discountAmount();
  const total = cartTotal();
  const itemRows = cart.map(i =>
    `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">₱${(i.price * i.quantity).toFixed(2)}</td></tr>`
  ).join('');

  return `
    <div style="font-family:monospace;font-size:13px;color:#1a1008;padding:8px;">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:18px;font-weight:bold;">🍛 Mommy's FoodHub</div>
        <div style="font-size:11px;color:#666;">${now.toLocaleDateString()} ${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
        <div style="font-size:11px;color:#666;">Cashier: ${currentUser.username}</div>
        ${orderNum ? `<div style="font-size:11px;color:#666;">Order #${orderNum}</div>` : ''}
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="font-size:11px;color:#999;"><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>₱${sub.toFixed(2)}</span></div>
      ${disc > 0 ? `<div style="display:flex;justify-content:space-between;color:green;"><span>Discount (${activePromo.code})</span><span>− ₱${disc.toFixed(2)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:6px;"><span>TOTAL</span><span>₱${total.toFixed(2)}</span></div>
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <div style="text-align:center;font-size:11px;color:#999;">Thank you for dining with us! 🙏</div>
    </div>
  `;
}

window.closeReceipt = function () {
  document.getElementById('receiptModal').classList.remove('open');
};

window.printReceipt = function () {
  const content = document.getElementById('receiptContent').innerHTML;
  document.getElementById('printArea').innerHTML = content;
  document.getElementById('printArea').style.display = 'block';
  window.print();
  document.getElementById('printArea').style.display = 'none';
};

/* ══════════════════════════════════
   CHECKOUT
══════════════════════════════════ */
window.openCheckoutModal = function () {
  if (!cart.length) { showToast('Cart is empty!', 'error'); return; }
  const sub = cartSubtotal();
  const disc = discountAmount();
  const total = cartTotal();
  document.getElementById('modalBody').innerHTML =
    `<strong>${cart.length} item(s)</strong><br>` +
    cart.map(i => `${i.name} × ${i.quantity} = ₱${(i.price * i.quantity).toFixed(2)}`).join('<br>') +
    `<br><hr style="border-color:#3d2b14;margin:10px 0;">` +
    (disc > 0 ? `<span style="color:var(--text-muted)">Subtotal: ₱${sub.toFixed(2)}</span><br><span style="color:var(--green)">Discount (${activePromo.code}): − ₱${disc.toFixed(2)}</span><br>` : '') +
    `<br><strong>Total: ₱${total.toFixed(2)}</strong>`;
  document.getElementById('checkoutModal').classList.add('open');
};

window.closeModal = function () {
  document.getElementById('checkoutModal').classList.remove('open');
};

window.checkout = async function () {
  closeModal();
  const orderItems = cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }));
  const total = cartTotal();
  const { data, error } = await sb.from('orders').insert([{
    order_items: orderItems,
    total,
    cashier: currentUser.username,
    discount_code: activePromo ? activePromo.code : null,
    discount_amount: discountAmount()
  }]).select();

  if (error) { showToast('Error saving order!', 'error'); return; }

  // Show receipt
  const orderNum = data && data[0] ? data[0].id.slice(0, 8).toUpperCase() : '';
  document.getElementById('receiptContent').innerHTML = buildReceiptHTML(orderNum);
  document.getElementById('receiptModal').classList.add('open');

  showToast(`Order saved! ₱${total.toFixed(2)}`, 'success');
  clearCart();
};

/* ══════════════════════════════════
   MENU MANAGEMENT
══════════════════════════════════ */
window.saveProduct = async function () {
  const name  = document.getElementById('pName').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const cat   = document.getElementById('pCat').value.trim();
  const editId = document.getElementById('editId').value;

  if (!name || isNaN(price)) { showToast('Fill in name and price', 'error'); return; }

  if (editId) {
    const { error } = await sb.from('products').update({ name, price, category: cat }).eq('id', editId);
    if (error) { showToast('Update failed', 'error'); return; }
    showToast('Item updated!', 'success');
  } else {
    const { error } = await sb.from('products').insert([{ name, price, category: cat }]);
    if (error) { showToast('Add failed', 'error'); return; }
    showToast('Item added!', 'success');
  }
  cancelEdit();
  await loadProducts();
  renderCatFilters();
  renderProductGrid();
  renderProductsTable();
};

window.editProduct = function (id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;
  document.getElementById('editId').value = p.id;
  document.getElementById('pName').value = p.name;
  document.getElementById('pPrice').value = p.price;
  document.getElementById('pCat').value = p.category || '';
  document.getElementById('formTitle').textContent = 'Edit Item';
};

window.deleteProduct = async function (id) {
  if (!confirm('Delete this item?')) return;
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) { showToast('Delete failed', 'error'); return; }
  showToast('Item deleted', 'success');
  await loadProducts();
  renderCatFilters();
  renderProductGrid();
  renderProductsTable();
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
  if (!allProducts.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:30px">No items yet.</td></tr>';
    return;
  }
  tbody.innerHTML = allProducts.map(p => `
    <tr>
      <td>${p.name}</td>
      <td>₱${parseFloat(p.price).toFixed(2)}</td>
      <td><span class="badge">${p.category || '—'}</span></td>
      <td>
        <button class="btn-icon" onclick="editProduct('${p.id}')" title="Edit">✏️</button>
        <button class="btn-icon" onclick="deleteProduct('${p.id}')" title="Delete">🗑</button>
      </td>
    </tr>
  `).join('');
}

/* ══════════════════════════════════
   REPORTS
══════════════════════════════════ */
window.loadReports = async function () {
  let query = sb.from('orders').select('*').order('created_at', { ascending: false });
  const dateVal = document.getElementById('filterDate').value;
  if (dateVal) {
    query = query.gte('created_at', dateVal + 'T00:00:00').lte('created_at', dateVal + 'T23:59:59');
  }
  const { data: orders, error } = await query;
  if (error) { showToast('Error loading orders', 'error'); return; }

  const total = (orders || []).reduce((s, o) => s + (o.total || 0), 0);
  const avg = orders && orders.length ? total / orders.length : 0;
  document.getElementById('statOrders').textContent = orders ? orders.length : 0;
  document.getElementById('statRevenue').textContent = '₱' + total.toFixed(2);
  document.getElementById('statAvg').textContent = '₱' + avg.toFixed(2);

  const tbody = document.getElementById('ordersBody');
  if (!orders || !orders.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:30px">No orders found.</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map((o, idx) => {
    const items = (o.order_items || []).map(i => `${i.name} ×${i.quantity}`).join(', ');
    const d = new Date(o.created_at);
    return `<tr>
      <td>${orders.length - idx}</td>
      <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${o.cashier || '—'}</td>
      <td class="order-items-list">${items}</td>
      <td class="order-total">₱${parseFloat(o.total).toFixed(2)}</td>
    </tr>`;
  }).join('');
};

window.clearDateFilter = function (btn) {
  document.getElementById('filterDate').value = '';
  loadReports();
};

/* ══════════════════════════════════
   NAVIGATION
══════════════════════════════════ */
window.showPage = function (name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'products') renderProductsTable();
  if (name === 'reports')  loadReports();
  if (name === 'promos')   renderPromosTable();
};

/* ══════════════════════════════════
   TOAST
══════════════════════════════════ */
let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}