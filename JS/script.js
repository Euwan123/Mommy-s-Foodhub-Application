const sb = window.supabase;

let currentUser = null;
let cart = [];
let allProducts = [];
let allCategories = [];
let allPromos = [];
let allStaff = [];
let selectedCategory = 'All';
let activePromo = null;
let selectedPayment = 'Cash';
let selectedPaymentM = 'Cash';
let selectedOrderType = 'Dine-in';
let selectedOrderTypeM = 'Dine-in';
let orderCounter = 1;
let checkoutSource = 'desktop';
let settings = {
  name: "Mommy's FoodHub",
  address: '',
  contact: '',
  footer: 'Thank you for dining with us! 🙏',
  currency: '₱',
  themeColor: '#f59e0b',
  bgColor: '#1a1008'
};

window.doLogin = async function () {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  errEl.textContent = '';
  if (!u || !p) { errEl.textContent = 'Please enter username and password.'; return; }
  const { data, error } = await sb.from('Employee').select('*').eq('Username', u).eq('Password', p).single();
  if (error || !data) { errEl.textContent = 'Invalid username or password.'; return; }
  currentUser = data;
  document.getElementById('loginScreen').style.opacity = '0';
  setTimeout(() => { document.getElementById('loginScreen').style.display = 'none'; showWelcome(data); }, 300);
};

function showWelcome(user) {
  const ws = document.getElementById('welcomeScreen');
  document.getElementById('welcomeName').textContent = 'Hey, ' + user.Name + '!';
  document.getElementById('welcomeRole').textContent = user.AccessLevel;
  ws.style.display = 'flex';
  setTimeout(() => ws.classList.add('show'), 10);
  setTimeout(() => { ws.classList.remove('show'); setTimeout(() => { ws.style.display = 'none'; launchApp(user); }, 500); }, 2200);
}

function launchApp(user) {
  document.getElementById('cashierName').textContent = user.Name;
  document.getElementById('userAvatar').textContent = user.Name.charAt(0).toUpperCase();
  const rt = document.getElementById('roleTag');
  rt.textContent = user.AccessLevel;
  rt.className = 'user-role ' + (user.AccessLevel === 'Admin' || user.AccessLevel === 'Manager' ? 'admin' : 'cashier');
  const isAdmin = user.AccessLevel === 'Admin' || user.AccessLevel === 'Manager';
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = isAdmin ? '' : 'none');
  const app = document.getElementById('app');
  app.style.display = 'flex';
  app.style.flexDirection = 'column';
  init();
}

window.doLogout = function () {
  currentUser = null;
  cart = [];
  document.getElementById('app').style.display = 'none';
  const ls = document.getElementById('loginScreen');
  ls.style.display = 'flex';
  setTimeout(() => ls.style.opacity = '1', 10);
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
};

window.openAccountModal = function () {
  if (!currentUser) return;
  document.getElementById('accountAvatar').textContent = currentUser.Name.charAt(0).toUpperCase();
  document.getElementById('accountName').textContent = currentUser.Name;
  document.getElementById('accountMeta').textContent = currentUser.Position || 'Staff';
  document.getElementById('accountUsername').textContent = currentUser.Username || '—';
  document.getElementById('accountPosition').textContent = currentUser.Position || '—';
  document.getElementById('accountAccess').textContent = currentUser.AccessLevel;
  document.getElementById('accountId').textContent = '#' + currentUser.EmployeeID;
  document.getElementById('accountModal').classList.add('open');
};

window.closeAccountModal = function () {
  document.getElementById('accountModal').classList.remove('open');
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

async function init() {
  loadSettings();
  applyTheme();
  await loadCategories();
  await loadProducts();
  await loadPromos();
  renderCatFilters();
  renderProductGrid();
  populateCategoryDropdown();
  updateOfflineBadge();
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await sb.from('Order').select('*', { count: 'exact', head: true }).gte('OrderDateTime', today + 'T00:00:00');
    orderCounter = (count || 0) + 1;
  } catch (_) {}
}

function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('pos_settings') || '{}');
    settings = { ...settings, ...s };
    if (s.name) document.getElementById('settingName').value = s.name;
    if (s.address) document.getElementById('settingAddress').value = s.address;
    if (s.contact) document.getElementById('settingContact').value = s.contact;
    if (s.footer) document.getElementById('settingFooter').value = s.footer;
  } catch (_) {}
}

window.saveSettings = function () {
  settings.name = document.getElementById('settingName').value || "Mommy's FoodHub";
  settings.address = document.getElementById('settingAddress').value || '';
  settings.contact = document.getElementById('settingContact').value || '';
  settings.footer = document.getElementById('settingFooter').value || 'Thank you for dining with us! 🙏';
  localStorage.setItem('pos_settings', JSON.stringify(settings));
  showToast('Settings saved!', 'success');
};

function applyTheme() {
  const s = JSON.parse(localStorage.getItem('pos_settings') || '{}');
  const color = s.themeColor || '#f59e0b';
  const bg = s.bgColor || '#1a1008';
  const currency = s.currency || '₱';
  setThemeColor(color, false);
  setBgColor(bg, false);
  setCurrency(currency, false);
  document.querySelectorAll('.swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.color === color);
  });
  document.querySelectorAll('.bg-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.bg === bg);
  });
  document.querySelectorAll('.curr-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.symbol === currency);
  });
}

function setThemeColor(color, save = true) {
  document.documentElement.style.setProperty('--amber', color);
  const lighten = color + 'cc';
  document.documentElement.style.setProperty('--amber-light', lighten);
  document.getElementById('themeMetaColor').setAttribute('content', color);
  if (save) {
    settings.themeColor = color;
    localStorage.setItem('pos_settings', JSON.stringify(settings));
  }
}

function setBgColor(bg, save = true) {
  const surface = adjustColor(bg, 14);
  const surface2 = adjustColor(bg, 22);
  const border = adjustColor(bg, 35);
  document.documentElement.style.setProperty('--bg', bg);
  document.documentElement.style.setProperty('--surface', surface);
  document.documentElement.style.setProperty('--surface2', surface2);
  document.documentElement.style.setProperty('--border', border);
  if (save) {
    settings.bgColor = bg;
    localStorage.setItem('pos_settings', JSON.stringify(settings));
  }
}

function adjustColor(hex, amount) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + amount);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + amount);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + amount);
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}

function setCurrency(symbol, save = true) {
  settings.currency = symbol;
  document.querySelectorAll('#currencySymbol, .curr-sym-m').forEach(el => el.textContent = symbol);
  document.querySelectorAll('.curr-label').forEach(el => el.textContent = symbol);
  document.getElementById('cartFabTotal').textContent = symbol + parseFloat(document.getElementById('cartFabTotal').textContent.slice(1) || '0').toFixed(2);
  if (save) localStorage.setItem('pos_settings', JSON.stringify(settings));
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.swatch[data-color]').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      setThemeColor(sw.dataset.color);
    });
  });
  document.querySelectorAll('.bg-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('.bg-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      setBgColor(sw.dataset.bg);
    });
  });
  document.querySelectorAll('.curr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.curr-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setCurrency(btn.dataset.symbol);
    });
  });
});

window.applyCustomColor = function (val) { setThemeColor(val); };
window.resetTheme = function () {
  setThemeColor('#f59e0b');
  setBgColor('#1a1008');
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('active', s.dataset.color === '#f59e0b'));
  document.querySelectorAll('.bg-swatch').forEach(s => s.classList.toggle('active', s.dataset.bg === '#1a1008'));
  showToast('Theme reset!', 'success');
};
window.applyCustomCurrency = function () {
  const val = document.getElementById('customCurrency').value.trim();
  if (!val) return;
  document.querySelectorAll('.curr-btn').forEach(b => b.classList.remove('active'));
  setCurrency(val);
  showToast('Currency updated!', 'success');
};

window.changePassword = async function () {
  const cur = document.getElementById('curPass').value;
  const nw = document.getElementById('newPass').value;
  const confirm = document.getElementById('confirmPass').value;
  if (!cur || !nw || !confirm) { showToast('Fill in all fields', 'error'); return; }
  if (nw !== confirm) { showToast('Passwords do not match', 'error'); return; }
  if (nw.length < 4) { showToast('Password too short', 'error'); return; }
  const { data } = await sb.from('Employee').select('Password').eq('EmployeeID', currentUser.EmployeeID).single();
  if (!data || data.Password !== cur) { showToast('Current password is wrong', 'error'); return; }
  await sb.from('Employee').update({ Password: nw }).eq('EmployeeID', currentUser.EmployeeID);
  currentUser.Password = nw;
  document.getElementById('curPass').value = '';
  document.getElementById('newPass').value = '';
  document.getElementById('confirmPass').value = '';
  showToast('Password updated!', 'success');
};

async function loadCategories() {
  const { data } = await sb.from('Category').select('*').order('CategoryName');
  allCategories = data || [];
}

function populateCategoryDropdown() {
  const sel = document.getElementById('pCat');
  sel.innerHTML = '<option value="">Select category...</option>';
  allCategories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.CategoryID;
    o.textContent = c.CategoryName;
    sel.appendChild(o);
  });
}

async function loadProducts() {
  const { data, error } = await sb.from('Product').select('*, Category(CategoryName), Inventory(QuantityAvailable, LastUpdated)').order('Name');
  if (error) { showToast('Could not load products', 'error'); return; }
  allProducts = data || [];
}

window.filterProducts = function () { renderProductGrid(); };

function renderCatFilters() {
  const wrap = document.getElementById('catFilters');
  wrap.innerHTML = '';
  const cats = ['All', ...allCategories.map(c => c.CategoryName)];
  cats.forEach(cat => {
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
    const catName = p.Category?.CategoryName || 'Other';
    const matchCat = selectedCategory === 'All' || catName === selectedCategory;
    const matchSearch = !q || p.Name.toLowerCase().includes(q);
    return matchCat && matchSearch && p.IsAvailable;
  });
  if (!filtered.length) { grid.innerHTML = '<div class="no-products">No items found.</div>'; return; }
  grid.innerHTML = '';
  filtered.forEach(p => {
    const stock = p.Inventory?.QuantityAvailable ?? p.StockQuantity;
    const low = stock <= 5;
    const d = document.createElement('div');
    d.className = 'product-card' + (low ? ' low-stock' : '');
    d.innerHTML = `<div class="p-name">${p.Name}</div><div class="p-price">${settings.currency}${parseFloat(p.BasePrice).toFixed(2)}</div><div class="p-cat">${p.Category?.CategoryName || ''}</div>${low ? `<div class="p-stock-badge">Low: ${stock}</div>` : ''}`;
    d.onclick = () => addToCart(p);
    grid.appendChild(d);
  });
}

function addToCart(p) {
  const ex = cart.find(i => i.id === p.ProductID);
  if (ex) ex.quantity++;
  else cart.push({ id: p.ProductID, name: p.Name, price: parseFloat(p.BasePrice), quantity: 1 });
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
  cart = [];
  activePromo = null;
  ['promoInput','orderNotes','cashReceived','promoInputM','orderNotesM','cashReceivedM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['promoMsg','promoMsgM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  });
  ['changeAmt','changeAmtM'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '0.00';
  });
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
  const total = cartTotal();
  const disc = discountAmount();
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const sym = settings.currency;
  const cartHTML = !cart.length
    ? '<div class="cart-empty">No items yet.<br>Tap a product to add.</div>'
    : cart.map(i => `
      <div class="cart-item">
        <div style="flex:1"><div class="ci-name">${i.name}</div><div class="ci-sub">${sym}${i.price.toFixed(2)} each</div></div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty(${i.id},-1)">−</button>
          <span class="qty-val">${i.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${i.id},1)">+</button>
        </div>
        <div class="ci-total">${sym}${(i.price * i.quantity).toFixed(2)}</div>
        <button class="ci-del" onclick="removeFromCart(${i.id})">×</button>
      </div>`).join('');

  ['cartItems','cartItemsMobile'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = cartHTML; });
  ['cartTotal','cartTotalM'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = total.toFixed(2); });
  ['discountLine','discountLineM'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (activePromo && disc > 0) { el.style.display = 'block'; el.textContent = `− ${sym}${disc.toFixed(2)} (${activePromo.code})`; }
    else el.style.display = 'none';
  });
  const cc = document.getElementById('changeCalc');
  if (cc) cc.style.display = selectedPayment === 'Cash' ? 'block' : 'none';
  const ccm = document.getElementById('changeCalcM');
  if (ccm) ccm.style.display = selectedPaymentM === 'Cash' ? 'block' : 'none';
  calcChange();
  calcChangeM();
  const fab = document.getElementById('cartFab');
  const fabCount = document.getElementById('cartFabCount');
  const fabTotal = document.getElementById('cartFabTotal');
  if (fab) fab.classList.toggle('has-items', totalItems > 0);
  if (fabCount) fabCount.textContent = totalItems;
  if (fabTotal) fabTotal.textContent = sym + total.toFixed(2);
}

window.setPayment = function (m, btn) {
  selectedPayment = m;
  document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCart();
};
window.setPaymentM = function (m, btn) {
  selectedPaymentM = m;
  document.querySelectorAll('.pay-btn-m').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCart();
};
window.setOrderType = function (t, btn) {
  selectedOrderType = t;
  document.querySelectorAll('.cart-panel .otype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};
window.setOrderTypeM = function (t, btn) {
  selectedOrderTypeM = t;
  document.querySelectorAll('.cart-drawer .otype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

window.calcChange = function () {
  const r = parseFloat(document.getElementById('cashReceived')?.value) || 0;
  const c = r - cartTotal();
  const el = document.getElementById('changeAmt');
  if (el) { el.textContent = Math.max(0, c).toFixed(2); el.style.color = c >= 0 ? 'var(--green)' : 'var(--red)'; }
};
window.calcChangeM = function () {
  const r = parseFloat(document.getElementById('cashReceivedM')?.value) || 0;
  const c = r - cartTotal();
  const el = document.getElementById('changeAmtM');
  if (el) { el.textContent = Math.max(0, c).toFixed(2); el.style.color = c >= 0 ? 'var(--green)' : 'var(--red)'; }
};

async function loadPromos() {
  const { data } = await sb.from('Promo').select('*').eq('IsActive', true).order('Code');
  allPromos = data || [];
}

function applyPromoCode(code, msgId) {
  const promo = allPromos.find(p => p.Code.toUpperCase() === code.toUpperCase());
  const msgEl = document.getElementById(msgId);
  if (!promo) {
    if (msgEl) { msgEl.style.color = 'var(--red)'; msgEl.textContent = 'Invalid promo code.'; }
    activePromo = null;
    renderCart();
    return;
  }
  activePromo = { code: promo.Code, type: promo.Type, value: parseFloat(promo.Value), id: promo.PromoID };
  if (msgEl) { msgEl.style.color = 'var(--green)'; msgEl.textContent = promo.Type === 'percent' ? `✓ ${promo.Value}% off!` : `✓ ${settings.currency}${promo.Value} off!`; }
  renderCart();
}

window.applyPromo = function () { applyPromoCode(document.getElementById('promoInput').value.trim(), 'promoMsg'); };
window.applyPromoM = function () { applyPromoCode(document.getElementById('promoInputM').value.trim(), 'promoMsgM'); };

window.savePromo = async function () {
  const Code = document.getElementById('promoCode').value.trim().toUpperCase();
  const Type = document.getElementById('promoType').value;
  const Value = parseFloat(document.getElementById('promoValue').value);
  const editId = document.getElementById('promoEditId').value;
  if (!Code || isNaN(Value)) { showToast('Fill in all fields', 'error'); return; }
  if (editId) await sb.from('Promo').update({ Code, Type, Value }).eq('PromoID', editId);
  else await sb.from('Promo').insert([{ Code, Type, Value }]);
  showToast('Promo saved!', 'success');
  cancelPromoEdit();
  await loadPromos();
  renderPromosTable();
};

window.editPromo = function (id) {
  const p = allPromos.find(x => x.PromoID === id);
  if (!p) return;
  document.getElementById('promoEditId').value = p.PromoID;
  document.getElementById('promoCode').value = p.Code;
  document.getElementById('promoType').value = p.Type;
  document.getElementById('promoValue').value = p.Value;
  document.getElementById('promoFormTitle').textContent = 'Edit Promo';
};

window.deletePromo = async function (id) {
  if (!confirm('Delete this promo?')) return;
  await sb.from('Promo').update({ IsActive: false }).eq('PromoID', id);
  showToast('Deleted', 'success');
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
  if (!allPromos.length) { tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-muted);text-align:center;padding:24px">No promos yet.</td></tr>'; return; }
  tbody.innerHTML = allPromos.map(p => `<tr>
    <td><strong>${p.Code}</strong></td>
    <td><span class="badge">${p.Type === 'percent' ? 'Percent' : 'Fixed'}</span></td>
    <td>${p.Type === 'percent' ? p.Value + '%' : settings.currency + parseFloat(p.Value).toFixed(2)}</td>
    <td><button class="btn-icon" onclick="editPromo(${p.PromoID})">✏️</button><button class="btn-icon" onclick="deletePromo(${p.PromoID})">🗑</button></td>
  </tr>`).join('');
}

window.saveStaff = async function () {
  const name = document.getElementById('staffName').value.trim();
  const username = document.getElementById('staffUser').value.trim();
  const password = document.getElementById('staffPass').value.trim();
  const position = document.getElementById('staffPosition').value.trim();
  const role = document.getElementById('staffRole').value;
  const dob = document.getElementById('staffDob').value;
  const editId = document.getElementById('staffEditId').value;
  if (!name || !username || !password || !dob) { showToast('Fill in all required fields', 'error'); return; }
  const payload = { Name: name, Username: username, Password: password, Position: position || 'Cashier', AccessLevel: role, DateofBirth: dob };
  if (editId) await sb.from('Employee').update(payload).eq('EmployeeID', editId);
  else await sb.from('Employee').insert([payload]);
  showToast('Staff saved!', 'success');
  cancelStaffEdit();
  await loadStaff();
  renderStaffTable();
};

async function loadStaff() {
  const { data } = await sb.from('Employee').select('*').order('Name');
  allStaff = data || [];
}

window.editStaff = function (id) {
  const s = allStaff.find(x => x.EmployeeID === id);
  if (!s) return;
  document.getElementById('staffEditId').value = s.EmployeeID;
  document.getElementById('staffName').value = s.Name;
  document.getElementById('staffUser').value = s.Username || '';
  document.getElementById('staffPass').value = s.Password || '';
  document.getElementById('staffPosition').value = s.Position || '';
  document.getElementById('staffRole').value = s.AccessLevel;
  document.getElementById('staffDob').value = s.DateofBirth?.split('T')[0] || '';
  document.getElementById('staffFormTitle').textContent = 'Edit Staff';
};

window.deleteStaff = async function (id) {
  if (id === currentUser.EmployeeID) { showToast("Can't delete yourself!", 'error'); return; }
  if (!confirm('Delete this staff?')) return;
  await sb.from('Employee').delete().eq('EmployeeID', id);
  showToast('Deleted', 'success');
  await loadStaff();
  renderStaffTable();
};

window.cancelStaffEdit = function () {
  ['staffEditId','staffName','staffUser','staffPass','staffPosition','staffDob'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('staffFormTitle').textContent = 'Add Staff';
};

function renderStaffTable() {
  const tbody = document.getElementById('staffTableBody');
  if (!allStaff.length) { tbody.innerHTML = '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;padding:24px">No staff yet.</td></tr>'; return; }
  tbody.innerHTML = allStaff.map(s => `<tr>
    <td>${s.Name}</td>
    <td>${s.Username || '—'}</td>
    <td>${s.Position}</td>
    <td><span class="badge">${s.AccessLevel}</span></td>
    <td><button class="btn-icon" onclick="editStaff(${s.EmployeeID})">✏️</button><button class="btn-icon" onclick="deleteStaff(${s.EmployeeID})">🗑</button></td>
  </tr>`).join('');
}

window.openCheckoutModal = function (source) {
  if (!cart.length) { showToast('Cart is empty!', 'error'); return; }
  checkoutSource = source;
  const isMobile = source === 'mobile';
  const payment = isMobile ? selectedPaymentM : selectedPayment;
  const orderType = isMobile ? selectedOrderTypeM : selectedOrderType;
  const notes = document.getElementById(isMobile ? 'orderNotesM' : 'orderNotes').value.trim();
  const sub = cartSubtotal(), disc = discountAmount(), total = cartTotal();
  const sym = settings.currency;
  const cash = parseFloat(document.getElementById(isMobile ? 'cashReceivedM' : 'cashReceived')?.value) || 0;
  const change = payment === 'Cash' ? Math.max(0, cash - total) : null;
  document.getElementById('modalBody').innerHTML =
    `<strong>Order #${orderCounter}</strong> · ${orderType}<br>` +
    cart.map(i => `${i.name} × ${i.quantity} = ${sym}${(i.price * i.quantity).toFixed(2)}`).join('<br>') +
    `<hr style="border-color:#3d2b14;margin:10px 0;">` +
    (disc > 0 ? `<span style="color:var(--text-muted)">Subtotal: ${sym}${sub.toFixed(2)}</span><br><span style="color:var(--green)">Discount: − ${sym}${disc.toFixed(2)}</span><br>` : '') +
    `<strong>Total: ${sym}${total.toFixed(2)}</strong><br>Payment: ${payment}` +
    (notes ? `<br>Notes: ${notes}` : '') +
    (change !== null ? `<br>Change: <strong style="color:var(--green)">${sym}${change.toFixed(2)}</strong>` : '');
  document.getElementById('checkoutModal').classList.add('open');
};

window.closeModal = function () { document.getElementById('checkoutModal').classList.remove('open'); };

window.checkout = async function () {
  closeModal();
  const isMobile = checkoutSource === 'mobile';
  const payment = isMobile ? selectedPaymentM : selectedPayment;
  const orderType = isMobile ? selectedOrderTypeM : selectedOrderType;
  const notes = document.getElementById(isMobile ? 'orderNotesM' : 'orderNotes').value.trim();
  const total = cartTotal();
  const disc = discountAmount();

  const orderData = {
    EmployeeID: currentUser.EmployeeID,
    OrderDateTime: new Date().toISOString(),
    OrderType: orderType,
    PaymentMethod: payment,
    TotalAmount: total,
    Status: 'Completed',
    Notes: notes || null,
    DiscountCode: activePromo ? activePromo.code : null,
    DiscountAmount: disc,
  };

  const offlinePayload = {
    ...orderData,
    items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity })),
    orderNum: orderCounter
  };

  if (!navigator.onLine) {
    saveOfflineOrder(offlinePayload);
    showToast(`Saved offline! Order #${orderCounter}`, 'success');
    showReceiptFromData(offlinePayload, null);
    orderCounter++;
    clearCart();
    closeMobileCart();
    return;
  }

  const { data: orderRow, error } = await sb.from('Order').insert([orderData]).select().single();
  if (error) {
    saveOfflineOrder(offlinePayload);
    showToast('Saved offline — will sync later', 'error');
    orderCounter++;
    clearCart();
    closeMobileCart();
    return;
  }

  const details = cart.map(i => ({
    OrderID: orderRow.OrderID,
    ProductID: i.id,
    Quantity: i.quantity,
    Price: i.price,
    Subtotal: i.price * i.quantity,
  }));
  await sb.from('OrderDetails').insert(details);

  for (const i of cart) {
    const { data: inv } = await sb.from('Inventory').select('QuantityAvailable').eq('ProductID', i.id).single();
    const current = inv?.QuantityAvailable ?? 0;
    await sb.from('Inventory').upsert({ ProductID: i.id, QuantityAvailable: Math.max(0, current - i.quantity), LastUpdated: new Date().toISOString() }, { onConflict: 'ProductID' });
  }

  showToast(`Order #${orderCounter} placed! ${settings.currency}${total.toFixed(2)}`, 'success');
  showReceiptFromData({ ...offlinePayload, OrderID: orderRow.OrderID }, orderRow.OrderID);
  orderCounter++;
  await loadProducts();
  renderProductGrid();
  clearCart();
  closeMobileCart();
};

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
  let synced = 0;
  for (const o of pending) {
    const { data: orderRow, error } = await sb.from('Order').insert([{
      EmployeeID: o.EmployeeID,
      OrderDateTime: o.saved_at,
      OrderType: o.OrderType,
      PaymentMethod: o.PaymentMethod,
      TotalAmount: o.TotalAmount,
      Status: 'Completed',
      Notes: o.Notes,
      DiscountCode: o.DiscountCode,
      DiscountAmount: o.DiscountAmount
    }]).select().single();
    if (!error && orderRow) {
      await sb.from('OrderDetails').insert(o.items.map(i => ({
        OrderID: orderRow.OrderID,
        ProductID: i.id,
        Quantity: i.quantity,
        Price: i.price,
        Subtotal: i.price * i.quantity
      })));
      synced++;
    }
  }
  if (synced > 0) {
    localStorage.setItem('offline_orders', JSON.stringify(pending.slice(synced)));
    showToast(`Synced ${synced} order(s)!`, 'success');
    updateOfflineBadge();
  }
};

function updateOfflineBadge() {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  const el = document.getElementById('statOffline');
  if (el) el.textContent = pending.length;
}

function showReceiptFromData(order, orderId) {
  document.getElementById('receiptContent').innerHTML = buildReceiptHTML(order, orderId);
  document.getElementById('receiptModal').classList.add('open');
}

function buildReceiptHTML(order, orderId) {
  const now = new Date();
  const sym = settings.currency;
  const items = order.items || cart.map(i => ({ name: i.name, price: i.price, quantity: i.quantity }));
  const sub = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return `<div style="font-family:monospace;font-size:13px;color:#1a1008;padding:8px;">
    <div style="text-align:center;margin-bottom:12px;">
      <div style="font-size:17px;font-weight:bold;">${settings.name}</div>
      ${settings.address ? `<div style="font-size:11px;color:#666;">${settings.address}</div>` : ''}
      ${settings.contact ? `<div style="font-size:11px;color:#666;">${settings.contact}</div>` : ''}
      <div style="font-size:11px;color:#666;">${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      <div style="font-size:11px;color:#666;">Staff: ${currentUser?.Name || '—'} | Order #${order.orderNum || orderId || '—'}</div>
      <div style="font-size:11px;color:#666;">Type: ${order.OrderType}</div>
      ${orderId ? '' : '<div style="font-size:11px;color:#e66;">⚠ Offline Order</div>'}
    </div>
    <hr style="border:1px dashed #ccc;margin:8px 0;">
    <table style="width:100%;border-collapse:collapse;">
      <thead><tr style="font-size:11px;color:#999;"><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${items.map(i => `<tr><td>${i.name}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${sym}${(i.price * i.quantity).toFixed(2)}</td></tr>`).join('')}</tbody>
    </table>
    <hr style="border:1px dashed #ccc;margin:8px 0;">
    <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${sym}${sub.toFixed(2)}</span></div>
    ${(order.DiscountAmount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;color:green;"><span>Discount (${order.DiscountCode})</span><span>− ${sym}${parseFloat(order.DiscountAmount).toFixed(2)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:6px;"><span>TOTAL</span><span>${sym}${parseFloat(order.TotalAmount).toFixed(2)}</span></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;color:#555;margin-top:4px;"><span>Payment</span><span>${order.PaymentMethod}</span></div>
    ${order.Notes ? `<div style="margin-top:6px;font-size:11px;color:#555;"><em>Notes: ${order.Notes}</em></div>` : ''}
    <hr style="border:1px dashed #ccc;margin:8px 0;">
    <div style="text-align:center;font-size:11px;color:#999;">${settings.footer}</div>
  </div>`;
}

window.closeReceipt = function () { document.getElementById('receiptModal').classList.remove('open'); };
window.printReceipt = function () {
  document.getElementById('printArea').innerHTML = document.getElementById('receiptContent').innerHTML;
  document.getElementById('printArea').style.display = 'block';
  window.print();
  document.getElementById('printArea').style.display = 'none';
};

window.saveProduct = async function () {
  const name = document.getElementById('pName').value.trim();
  const price = parseFloat(document.getElementById('pPrice').value);
  const catId = parseInt(document.getElementById('pCat').value);
  const stock = parseInt(document.getElementById('pStock').value) || 0;
  const available = document.getElementById('pAvailable').checked;
  const editId = document.getElementById('editId').value;
  if (!name || isNaN(price) || !catId) { showToast('Fill in name, price and category', 'error'); return; }
  if (editId) {
    await sb.from('Product').update({ Name: name, BasePrice: price, CategoryID: catId, StockQuantity: stock, IsAvailable: available }).eq('ProductID', editId);
    await sb.from('Inventory').upsert({ ProductID: parseInt(editId), QuantityAvailable: stock, LastUpdated: new Date().toISOString() }, { onConflict: 'ProductID' });
  } else {
    const { data: prod } = await sb.from('Product').insert([{ Name: name, BasePrice: price, CategoryID: catId, StockQuantity: stock, IsAvailable: available }]).select().single();
    if (prod) await sb.from('Inventory').insert([{ ProductID: prod.ProductID, QuantityAvailable: stock, LastUpdated: new Date().toISOString() }]);
  }
  showToast('Item saved!', 'success');
  cancelEdit();
  await loadProducts();
  renderCatFilters();
  renderProductGrid();
  renderProductsTable();
};

window.editProduct = function (id) {
  const p = allProducts.find(x => x.ProductID === id);
  if (!p) return;
  document.getElementById('editId').value = p.ProductID;
  document.getElementById('pName').value = p.Name;
  document.getElementById('pPrice').value = p.BasePrice;
  document.getElementById('pCat').value = p.CategoryID;
  document.getElementById('pStock').value = p.Inventory?.QuantityAvailable ?? p.StockQuantity;
  document.getElementById('pAvailable').checked = p.IsAvailable;
  document.getElementById('formTitle').textContent = 'Edit Item';
};

window.deleteProduct = async function (id) {
  if (!confirm('Delete this item?')) return;
  await sb.from('Product').delete().eq('ProductID', id);
  showToast('Deleted', 'success');
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
  document.getElementById('pStock').value = '';
  document.getElementById('pAvailable').checked = true;
  document.getElementById('formTitle').textContent = 'Add New Item';
};

function renderProductsTable() {
  const tbody = document.getElementById('productsTableBody');
  if (!allProducts.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:24px">No items yet.</td></tr>'; return; }
  tbody.innerHTML = allProducts.map(p => {
    const stock = p.Inventory?.QuantityAvailable ?? p.StockQuantity;
    const statusColor = !p.IsAvailable ? 'var(--red)' : stock <= 5 ? '#f59e0b' : 'var(--green)';
    const statusText = !p.IsAvailable ? 'Unavailable' : stock <= 5 ? 'Low Stock' : 'Available';
    return `<tr>
      <td>${p.Name}</td>
      <td><span class="badge">${p.Category?.CategoryName || '—'}</span></td>
      <td>${settings.currency}${parseFloat(p.BasePrice).toFixed(2)}</td>
      <td>${stock}</td>
      <td><span style="color:${statusColor};font-size:12px;font-weight:600;">${statusText}</span></td>
      <td><button class="btn-icon" onclick="editProduct(${p.ProductID})">✏️</button><button class="btn-icon" onclick="deleteProduct(${p.ProductID})">🗑</button></td>
    </tr>`;
  }).join('');
}

window.loadReports = async function () {
  let query = sb.from('Order').select('*, Employee(Name), OrderDetails(Quantity, Price, Subtotal, Product(Name))').order('OrderDateTime', { ascending: false });
  const dateVal = document.getElementById('filterDate').value;
  if (dateVal) query = query.gte('OrderDateTime', dateVal + 'T00:00:00').lte('OrderDateTime', dateVal + 'T23:59:59');
  const { data: orders, error } = await query;
  if (error) { showToast('Error loading orders', 'error'); return; }
  const total = (orders || []).reduce((s, o) => s + parseFloat(o.TotalAmount || 0), 0);
  const avg = orders?.length ? total / orders.length : 0;
  const sym = settings.currency;
  document.getElementById('statOrders').textContent = orders?.length || 0;
  document.getElementById('statRevenue').textContent = sym + total.toFixed(2);
  document.getElementById('statAvg').textContent = sym + avg.toFixed(2);
  updateOfflineBadge();
  renderBestSellers(orders || []);
  const tbody = document.getElementById('ordersBody');
  if (!orders?.length) { tbody.innerHTML = '<tr><td colspan="9" style="color:var(--text-muted);text-align:center;padding:30px">No orders found.</td></tr>'; return; }
  tbody.innerHTML = orders.map((o, idx) => {
    const items = (o.OrderDetails || []).map(d => `${d.Product?.Name} ×${d.Quantity}`).join(', ');
    const d = new Date(o.OrderDateTime);
    const statusColor = o.Status === 'Completed' ? 'var(--green)' : o.Status === 'Cancelled' ? 'var(--red)' : 'var(--amber)';
    return `<tr>
      <td>${orders.length - idx}</td>
      <td>${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
      <td>${o.Employee?.Name || '—'}</td>
      <td><span class="badge">${o.OrderType}</span></td>
      <td><span class="badge">${o.PaymentMethod}</span></td>
      <td class="order-items-list">${items || '—'}</td>
      <td class="order-items-list">${o.Notes || '—'}</td>
      <td><span style="color:${statusColor};font-size:12px;font-weight:600;">${o.Status}</span></td>
      <td class="order-total">${sym}${parseFloat(o.TotalAmount).toFixed(2)}</td>
    </tr>`;
  }).join('');
};

function renderBestSellers(orders) {
  const counts = {};
  orders.forEach(o => (o.OrderDetails || []).forEach(d => {
    const n = d.Product?.Name || '?';
    counts[n] = (counts[n] || 0) + d.Quantity;
  }));
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const max = sorted[0]?.[1] || 1;
  const container = document.getElementById('bestSellersChart');
  if (!sorted.length) { container.innerHTML = '<div style="color:var(--text-muted);padding:16px;">No data yet.</div>'; return; }
  container.innerHTML = sorted.map(([name, qty]) => `
    <div class="bs-row">
      <div class="bs-name">${name}</div>
      <div class="bs-bar-wrap"><div class="bs-bar" style="width:${(qty / max * 100).toFixed(1)}%"></div></div>
      <div class="bs-qty">${qty}</div>
    </div>`).join('');
}

window.clearDateFilter = function () { document.getElementById('filterDate').value = ''; loadReports(); };

window.exportToExcel = async function () {
  const { data: orders } = await sb.from('Order').select('*, Employee(Name), OrderDetails(Quantity, Price, Subtotal, Product(Name))').order('OrderDateTime', { ascending: false });
  if (!orders?.length) { showToast('No orders to export', 'error'); return; }
  const sym = settings.currency;
  const rows = [['#', 'Date', 'Time', 'Staff', 'Type', 'Payment', 'Items', 'Notes', 'Discount', 'Status', 'Total']];
  orders.forEach((o, idx) => {
    const d = new Date(o.OrderDateTime);
    const items = (o.OrderDetails || []).map(i => `${i.Product?.Name} x${i.Quantity}`).join(' | ');
    rows.push([idx + 1, d.toLocaleDateString(), d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), o.Employee?.Name || '', o.OrderType, o.PaymentMethod, items, o.Notes || '', o.DiscountCode || '', o.Status, sym + o.TotalAmount]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `orders_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  showToast('Exported!', 'success');
};

window.loadInventory = async function () {
  await loadProducts();
  const low = allProducts.filter(p => (p.Inventory?.QuantityAvailable ?? p.StockQuantity) <= 5 && p.IsAvailable).length;
  const out = allProducts.filter(p => (p.Inventory?.QuantityAvailable ?? p.StockQuantity) === 0).length;
  document.getElementById('invTotal').textContent = allProducts.length;
  document.getElementById('invLow').textContent = low;
  document.getElementById('invOut').textContent = out;
  const tbody = document.getElementById('inventoryBody');
  if (!allProducts.length) { tbody.innerHTML = '<tr><td colspan="6" style="color:var(--text-muted);text-align:center;padding:24px">No products.</td></tr>'; return; }
  tbody.innerHTML = allProducts.map(p => {
    const stock = p.Inventory?.QuantityAvailable ?? p.StockQuantity;
    const updated = p.Inventory?.LastUpdated ? new Date(p.Inventory.LastUpdated).toLocaleDateString() : '—';
    const statusColor = stock === 0 ? 'var(--red)' : stock <= 5 ? '#f59e0b' : 'var(--green)';
    const statusText = stock === 0 ? '🔴 Out of Stock' : stock <= 5 ? '🟡 Low Stock' : '🟢 OK';
    return `<tr>
      <td>${p.Name}</td>
      <td><span class="badge">${p.Category?.CategoryName || '—'}</span></td>
      <td><strong>${stock}</strong></td>
      <td><span style="color:${statusColor};font-size:12px;font-weight:600;">${statusText}</span></td>
      <td>${updated}</td>
      <td><button class="btn-icon" onclick="openStockModal(${p.ProductID},${stock})">✏️ Restock</button></td>
    </tr>`;
  }).join('');
};

window.openStockModal = function (id, current) {
  document.getElementById('stockProductId').value = id;
  document.getElementById('stockQty').value = current;
  document.getElementById('stockModal').classList.add('open');
};
window.closeStockModal = function () { document.getElementById('stockModal').classList.remove('open'); };
window.saveStock = async function () {
  const id = parseInt(document.getElementById('stockProductId').value);
  const qty = parseInt(document.getElementById('stockQty').value);
  if (isNaN(qty) || qty < 0) { showToast('Enter a valid quantity', 'error'); return; }
  await sb.from('Inventory').upsert({ ProductID: id, QuantityAvailable: qty, LastUpdated: new Date().toISOString() }, { onConflict: 'ProductID' });
  await sb.from('Product').update({ StockQuantity: qty }).eq('ProductID', id);
  closeStockModal();
  showToast('Stock updated!', 'success');
  await loadInventory();
};

window.openMobileCart = function () {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartDrawerOverlay').classList.add('open');
};
window.closeMobileCart = function () {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartDrawerOverlay').classList.remove('open');
};
window.showMoreMenu = function () {
  document.getElementById('moreMenu').classList.add('open');
  document.getElementById('moreMenuOverlay').classList.add('open');
};
window.closeMoreMenu = function () {
  document.getElementById('moreMenu').classList.remove('open');
  document.getElementById('moreMenuOverlay').classList.remove('open');
};

window.showPage = function (name, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  if (btn) btn.classList.add('active');
  document.querySelectorAll(`[data-page="${name}"]`).forEach(b => b.classList.add('active'));
  closeMobileCart();
  if (name === 'products') renderProductsTable();
  if (name === 'reports') loadReports();
  if (name === 'promos') renderPromosTable();
  if (name === 'staff') loadStaff().then(renderStaffTable);
  if (name === 'settings') { loadSettings(); applyTheme(); }
  if (name === 'inventory') loadInventory();
};

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}