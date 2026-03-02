// Mommy's FoodHub — script.js
// Uses window.supabase set in index.html

const sb = window.supabase;

let currentUser = null;
let cart = [];
let allProducts = [];
let selectedCategory = 'All';

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
  renderCart();
};

function cartTotal() {
  return cart.reduce((s, i) => s + i.price * i.quantity, 0);
}

function renderCart() {
  const wrap = document.getElementById('cartItems');
  document.getElementById('cartTotal').textContent = cartTotal().toFixed(2);
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
   CHECKOUT
══════════════════════════════════ */
window.openCheckoutModal = function () {
  if (!cart.length) { showToast('Cart is empty!', 'error'); return; }
  document.getElementById('modalBody').innerHTML =
    `<strong>${cart.length} item(s)</strong><br>` +
    cart.map(i => `${i.name} × ${i.quantity} = ₱${(i.price * i.quantity).toFixed(2)}`).join('<br>') +
    `<br><br><strong>Total: ₱${cartTotal().toFixed(2)}</strong>`;
  document.getElementById('checkoutModal').classList.add('open');
};

window.closeModal = function () {
  document.getElementById('checkoutModal').classList.remove('open');
};

window.checkout = async function () {
  closeModal();
  const orderItems = cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }));
  const { error } = await sb.from('orders').insert([{
    order_items: orderItems,
    total: cartTotal(),
    cashier: currentUser.username
  }]);
  if (error) { showToast('Error saving order!', 'error'); return; }
  showToast(`Order saved! ₱${cartTotal().toFixed(2)}`, 'success');
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
  if (name === 'reports') loadReports();
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