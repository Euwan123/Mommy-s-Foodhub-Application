const sb = window.supabase;

let currentUser = null, activeAttendanceId = null;
let cart = [], allProducts = [], allCategories = [], allPromos = [], allSizes = [];
let selectedCategory = 'All', activePromo = null;
let selectedPayment = 'Cash', selectedPaymentM = 'Cash';
let selectedOrderType = 'Dine-in', selectedOrderTypeM = 'Dine-in';
let checkoutSource = 'desktop', orderCounter = 1;
let kitchenFilter = 'all', kitchenOrders = [];

const S = () => JSON.parse(localStorage.getItem('pos_settings') || '{}');
const sym = () => S().currency || '₱';

window.doLogin = async function() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  if (!u || !p) { err.textContent = 'Enter username and password.'; return; }
  const { data, error } = await sb.from('Employee').select('*').eq('Username', u).eq('Password', p).single();
  if (error || !data) { err.textContent = 'Invalid username or password.'; return; }
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
  document.getElementById('app').style.display = 'flex';
  applyTheme();
  checkOpenAttendance();
  init();
}

window.doLogout = function() {
  if (activeAttendanceId) { if (!confirm('You are still checked in. Check out before logging out?')) return; doCheckout(); }
  currentUser = null; cart = [];
  const ls = document.getElementById('loginScreen');
  document.getElementById('app').style.display = 'none';
  ls.style.display = 'flex';
  setTimeout(() => ls.style.opacity = '1', 10);
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
});

async function checkOpenAttendance() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await sb.from('Attendance')
    .select('*').eq('EmployeeID', currentUser.EmployeeID)
    .is('CheckOut', null).gte('CheckIn', today + 'T00:00:00').maybeSingle();
  if (data) { activeAttendanceId = data.AttendanceID; updateShiftBadge(data.CheckIn, true); }
  else { activeAttendanceId = null; updateShiftBadge(null, false); }
}

function updateShiftBadge(checkInTime, active) {
  const badge = document.getElementById('shiftBadge');
  if (!badge) return;
  if (active && checkInTime) {
    const t = new Date(checkInTime);
    badge.textContent = '✅ Shift since ' + t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    badge.classList.add('active');
  } else {
    badge.textContent = '⏱ Not checked in';
    badge.classList.remove('active');
  }
}

window.openAccountModal = function() {
  if (!currentUser) return;
  document.getElementById('accountAvatar').textContent = currentUser.Name.charAt(0).toUpperCase();
  document.getElementById('accountName').textContent = currentUser.Name;
  document.getElementById('accountMeta').textContent = currentUser.Position || 'Staff';
  document.getElementById('accountUsername').textContent = currentUser.Username || '—';
  document.getElementById('accountId').textContent = '#' + currentUser.EmployeeID;
  document.getElementById('accountAccess').textContent = currentUser.AccessLevel;
  const shiftEl = document.getElementById('accountShift');
  const infoEl = document.getElementById('checkinInfo');
  const btn = document.getElementById('checkinBtn');
  if (activeAttendanceId) {
    shiftEl.textContent = '✅ Checked In';
    shiftEl.style.color = 'var(--green)';
    btn.textContent = '⏹ Check Out';
    btn.style.background = 'var(--red)';
  } else {
    shiftEl.textContent = '⏹ Not Checked In';
    shiftEl.style.color = 'var(--text-muted)';
    btn.textContent = '⏱ Check In';
    btn.style.background = 'var(--green)';
  }
  if (infoEl) infoEl.textContent = '';
  document.getElementById('accountModal').classList.add('open');
};
window.closeAccountModal = function() { document.getElementById('accountModal').classList.remove('open'); };

window.toggleCheckin = async function() {
  if (activeAttendanceId) {
    await doCheckout();
  } else {
    const { data } = await sb.from('Attendance').insert([{ EmployeeID: currentUser.EmployeeID }]).select().single();
    if (data) {
      activeAttendanceId = data.AttendanceID;
      updateShiftBadge(data.CheckIn, true);
      showToast('Checked in! ✅', 'success');
      document.getElementById('checkinInfo').textContent = 'Checked in at ' + new Date(data.CheckIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      document.getElementById('checkinBtn').textContent = '⏹ Check Out';
      document.getElementById('checkinBtn').style.background = 'var(--red)';
      document.getElementById('accountShift').textContent = '✅ Checked In';
    }
  }
};

async function doCheckout() {
  if (!activeAttendanceId) return;
  await sb.from('Attendance').update({ CheckOut: new Date().toISOString() }).eq('AttendanceID', activeAttendanceId);
  activeAttendanceId = null;
  updateShiftBadge(null, false);
  showToast('Checked out! See you next shift 👋', 'success');
  const btn = document.getElementById('checkinBtn');
  if (btn) { btn.textContent = '⏱ Check In'; btn.style.background = 'var(--green)'; }
  const si = document.getElementById('accountShift');
  if (si) { si.textContent = '⏹ Not Checked In'; si.style.color = 'var(--text-muted)'; }
}

async function init() {
  await Promise.all([loadCategories(), loadProducts(), loadPromos()]);
  renderCatFilters();
  renderProductGrid();
  updateOfflineBadge();
  try {
    const today = new Date().toISOString().split('T')[0];
    const { count } = await sb.from('Order').select('*', { count: 'exact', head: true }).gte('OrderDateTime', today + 'T00:00:00');
    orderCounter = (count || 0) + 1;
  } catch (_) {}
}

async function loadCategories() {
  const { data } = await sb.from('Category').select('*').order('CategoryName');
  allCategories = data || [];
}

async function loadProducts() {
  const { data } = await sb.from('Product').select('*, Category(CategoryName), Inventory(QuantityAvailable)').eq('IsAvailable', true).order('Name');
  allProducts = data || [];
  const ids = allProducts.map(p => p.ProductID);
  if (ids.length) {
    const { data: sizes } = await sb.from('ProductSize').select('*').in('ProductID', ids).eq('IsAvailable', true);
    allSizes = sizes || [];
  }
}

async function loadPromos() {
  const { data } = await sb.from('Promo').select('*').eq('IsActive', true);
  allPromos = data || [];
}

window.filterProducts = function() { renderProductGrid(); };

function renderCatFilters() {
  const wrap = document.getElementById('catFilters');
  wrap.innerHTML = '';
  ['All', ...allCategories.map(c => c.CategoryName)].forEach(cat => {
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
  const q = (document.getElementById('menuSearch')?.value || '').toLowerCase();
  const grid = document.getElementById('productGrid');
  const filtered = allProducts.filter(p => {
    const cat = p.Category?.CategoryName || '';
    return (selectedCategory === 'All' || cat === selectedCategory) && (!q || p.Name.toLowerCase().includes(q));
  });
  if (!filtered.length) { grid.innerHTML = '<div class="no-products">No items found.</div>'; return; }
  grid.innerHTML = '';
  filtered.forEach(p => {
    const stock = p.Inventory?.QuantityAvailable ?? p.StockQuantity ?? 99;
    const sizes = allSizes.filter(s => s.ProductID === p.ProductID);
    const low = stock > 0 && stock <= 5;
    const out = stock === 0;
    const d = document.createElement('div');
    d.className = 'product-card' + (low ? ' low-stock' : '') + (out ? ' out-stock' : '');
    d.innerHTML = `
      <div class="p-name">${p.Name}</div>
      <div class="p-price">${sym()}${parseFloat(p.BasePrice).toFixed(2)}</div>
      <div class="p-cat">${p.Category?.CategoryName || ''}</div>
      ${sizes.length ? `<div class="p-size-hint">+ ${sizes.length} sizes</div>` : ''}
      ${low ? `<div class="p-stock-badge">Low: ${stock}</div>` : ''}
      ${out ? `<div class="p-stock-badge" style="color:var(--red)">Out of stock</div>` : ''}`;
    d.onclick = () => sizes.length ? openSizeModal(p) : addToCart(p, null, null);
    grid.appendChild(d);
  });
}

window.openSizeModal = function(p) {
  document.getElementById('sizeModalTitle').textContent = p.Name + ' — Choose Size';
  const list = document.getElementById('sizeList');
  list.innerHTML = '';
  const sizes = allSizes.filter(s => s.ProductID === p.ProductID);
  const plainBtn = document.createElement('button');
  plainBtn.className = 'size-btn';
  plainBtn.innerHTML = `<span>Regular</span><span class="size-price">${sym()}${parseFloat(p.BasePrice).toFixed(2)}</span>`;
  plainBtn.onclick = () => { addToCart(p, null, null); closeSizeModal(); };
  list.appendChild(plainBtn);
  sizes.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'size-btn';
    btn.innerHTML = `<span>${s.Size}</span><span class="size-price">${sym()}${parseFloat(s.Price).toFixed(2)}</span>`;
    btn.onclick = () => { addToCart(p, s.Size, parseFloat(s.Price)); closeSizeModal(); };
    list.appendChild(btn);
  });
  document.getElementById('sizeModal').classList.add('open');
};
window.closeSizeModal = function() { document.getElementById('sizeModal').classList.remove('open'); };

function addToCart(p, sizeLabel, sizePrice) {
  const price = sizePrice !== null ? sizePrice : parseFloat(p.BasePrice);
  const key = p.ProductID + (sizeLabel || '');
  const ex = cart.find(i => i.key === key);
  if (ex) ex.quantity++;
  else cart.push({ key, id: p.ProductID, name: p.Name, size: sizeLabel, price, quantity: 1 });
  renderCart();
}

window.changeQty = function(key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => i.key !== key);
  renderCart();
};
window.removeFromCart = function(key) { cart = cart.filter(i => i.key !== key); renderCart(); };
window.clearCart = function() {
  cart = []; activePromo = null;
  ['promoInput','orderNotes','cashReceived','promoInputM','orderNotesM','cashReceivedM'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  ['promoMsg','promoMsgM'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
  renderCart();
};

const cartSubtotal = () => cart.reduce((s, i) => s + i.price * i.quantity, 0);
function cartTotal() {
  const sub = cartSubtotal();
  if (!activePromo) return sub;
  return activePromo.type === 'percent' ? Math.max(0, sub - sub * activePromo.value / 100) : Math.max(0, sub - activePromo.value);
}
const discountAmt = () => cartSubtotal() - cartTotal();

function renderCart() {
  const total = cartTotal(), disc = discountAmt(), s = sym();
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const html = !cart.length
    ? '<div class="cart-empty">No items yet.<br>Tap a dish to add.</div>'
    : cart.map(i => `
      <div class="cart-item">
        <div style="flex:1">
          <div class="ci-name">${i.name}</div>
          ${i.size ? `<div class="ci-size">${i.size}</div>` : ''}
          <div class="ci-sub">${s}${i.price.toFixed(2)} each</div>
        </div>
        <div class="qty-ctrl">
          <button class="qty-btn" onclick="changeQty('${i.key}',-1)">−</button>
          <span class="qty-val">${i.quantity}</span>
          <button class="qty-btn" onclick="changeQty('${i.key}',1)">+</button>
        </div>
        <div class="ci-total">${s}${(i.price * i.quantity).toFixed(2)}</div>
        <button class="ci-del" onclick="removeFromCart('${i.key}')">×</button>
      </div>`).join('');

  ['cartItems','cartItemsMobile'].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = html; });
  ['cartTotal','cartTotalM'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = total.toFixed(2); });
  ['discountLine','discountLineM'].forEach(id => {
    const e = document.getElementById(id);
    if (!e) return;
    if (activePromo && disc > 0) { e.style.display = 'block'; e.textContent = `− ${s}${disc.toFixed(2)} (${activePromo.code})`; }
    else e.style.display = 'none';
  });
  const cc = document.getElementById('changeCalc');
  if (cc) cc.style.display = selectedPayment === 'Cash' ? 'block' : 'none';
  const ccm = document.getElementById('changeCalcM');
  if (ccm) ccm.style.display = selectedPaymentM === 'Cash' ? 'block' : 'none';
  calcChange(); calcChangeM();
  const fab = document.getElementById('cartFab');
  if (fab) {
    fab.classList.toggle('has-items', count > 0);
    document.getElementById('cartFabCount').textContent = count;
    document.getElementById('cartFabTotal').textContent = s + total.toFixed(2);
  }
  document.querySelectorAll('.curr-sym').forEach(e => e.textContent = s);
  document.querySelectorAll('.curr-sym-inline').forEach(e => e.textContent = s);
}

window.setPayment = function(m, btn) { selectedPayment = m; document.querySelectorAll('.pay-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderCart(); };
window.setPaymentM = function(m, btn) { selectedPaymentM = m; document.querySelectorAll('.pay-btn-m').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderCart(); };
window.setOrderType = function(t, btn) { selectedOrderType = t; document.querySelectorAll('.cart-panel .otype-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
window.setOrderTypeM = function(t, btn) { selectedOrderTypeM = t; document.querySelectorAll('.cart-drawer .otype-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); };
window.calcChange = function() {
  const r = parseFloat(document.getElementById('cashReceived')?.value) || 0;
  const c = r - cartTotal();
  const el = document.getElementById('changeAmt');
  if (el) { el.textContent = Math.max(0, c).toFixed(2); el.style.color = c >= 0 ? 'var(--green)' : 'var(--red)'; }
};
window.calcChangeM = function() {
  const r = parseFloat(document.getElementById('cashReceivedM')?.value) || 0;
  const c = r - cartTotal();
  const el = document.getElementById('changeAmtM');
  if (el) { el.textContent = Math.max(0, c).toFixed(2); el.style.color = c >= 0 ? 'var(--green)' : 'var(--red)'; }
};

function applyPromoCode(code, msgId) {
  const promo = allPromos.find(p => p.Code.toUpperCase() === code.toUpperCase());
  const msg = document.getElementById(msgId);
  if (!promo) { if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Invalid promo code.'; } activePromo = null; renderCart(); return; }
  activePromo = { code: promo.Code, type: promo.Type, value: parseFloat(promo.Value) };
  if (msg) { msg.style.color = 'var(--green)'; msg.textContent = promo.Type === 'percent' ? `✓ ${promo.Value}% off!` : `✓ ${sym()}${promo.Value} off!`; }
  renderCart();
}
window.applyPromo = function() { applyPromoCode(document.getElementById('promoInput').value.trim(), 'promoMsg'); };
window.applyPromoM = function() { applyPromoCode(document.getElementById('promoInputM').value.trim(), 'promoMsgM'); };

window.openCheckoutModal = function(source) {
  if (!cart.length) { showToast('Cart is empty!', 'error'); return; }
  checkoutSource = source;
  const isMobile = source === 'mobile';
  const payment = isMobile ? selectedPaymentM : selectedPayment;
  const orderType = isMobile ? selectedOrderTypeM : selectedOrderType;
  const notes = document.getElementById(isMobile ? 'orderNotesM' : 'orderNotes').value.trim();
  const sub = cartSubtotal(), disc = discountAmt(), total = cartTotal(), s = sym();
  const cash = parseFloat(document.getElementById(isMobile ? 'cashReceivedM' : 'cashReceived')?.value) || 0;
  const change = payment === 'Cash' ? Math.max(0, cash - total) : null;
  document.getElementById('modalBody').innerHTML =
    `<strong>Order #${orderCounter}</strong> · ${orderType}<br>` +
    cart.map(i => `${i.name}${i.size ? ` (${i.size})` : ''} × ${i.quantity} = ${s}${(i.price * i.quantity).toFixed(2)}`).join('<br>') +
    `<hr style="border-color:#3d2b14;margin:10px 0;">` +
    (disc > 0 ? `<span style="color:var(--text-muted)">Subtotal: ${s}${sub.toFixed(2)}</span><br><span style="color:var(--green)">Discount: − ${s}${disc.toFixed(2)}</span><br>` : '') +
    `<strong>Total: ${s}${total.toFixed(2)}</strong><br>Payment: ${payment}` +
    (notes ? `<br>Notes: ${notes}` : '') +
    (change !== null ? `<br>Change: <strong style="color:var(--green)">${s}${change.toFixed(2)}</strong>` : '');
  document.getElementById('checkoutModal').classList.add('open');
};
window.closeModal = function() { document.getElementById('checkoutModal').classList.remove('open'); };

window.checkout = async function() {
  closeModal();
  const isMobile = checkoutSource === 'mobile';
  const payment = isMobile ? selectedPaymentM : selectedPayment;
  const orderType = isMobile ? selectedOrderTypeM : selectedOrderType;
  const notes = document.getElementById(isMobile ? 'orderNotesM' : 'orderNotes').value.trim();
  const total = cartTotal(), disc = discountAmt();
  const cartSnapshot = [...cart.map(i => ({ ...i }))];
  const orderData = {
    EmployeeID: currentUser.EmployeeID,
    OrderDateTime: new Date().toISOString(),
    OrderType: orderType, PaymentMethod: payment,
    TotalAmount: total, Status: 'Pending',
    Notes: notes || null,
    DiscountCode: activePromo?.code || null,
    DiscountAmount: disc,
  };
  if (!navigator.onLine) {
    saveOfflineOrder({ ...orderData, items: cartSnapshot, orderNum: orderCounter });
    showToast(`Saved offline! Order #${orderCounter}`, 'success');
    showReceiptFromData({ ...orderData, items: cartSnapshot, orderNum: orderCounter }, null);
    orderCounter++; clearCart(); closeMobileCart(); return;
  }
  const { data: orderRow, error } = await sb.from('Order').insert([orderData]).select().single();
  if (error) {
    saveOfflineOrder({ ...orderData, items: cartSnapshot, orderNum: orderCounter });
    showToast('Saved offline — will sync later', 'error');
    orderCounter++; clearCart(); closeMobileCart(); return;
  }
  await sb.from('OrderDetails').insert(cartSnapshot.map(i => ({
    OrderID: orderRow.OrderID, ProductID: i.id, SizeLabel: i.size || null,
    Quantity: i.quantity, Price: i.price, Subtotal: i.price * i.quantity,
  })));
  for (const i of cartSnapshot) {
    const ingRows = await sb.from('Ingredients').select('ItemID, UnitPerServing').eq('ProductID', i.id);
    if (ingRows.data?.length) {
      for (const ing of ingRows.data) {
        const { data: itemRow } = await sb.from('Item').select('UnitQuantity').eq('ItemID', ing.ItemID).single();
        const curr = itemRow?.UnitQuantity ?? 0;
        const deduct = (ing.UnitPerServing || 0) * i.quantity;
        await sb.from('Item').update({ UnitQuantity: Math.max(0, curr - deduct) }).eq('ItemID', ing.ItemID);
        await sb.from('IngredientLog').insert([{ ItemID: ing.ItemID, OrderID: orderRow.OrderID, ChangeAmt: -deduct, Reason: 'Order' }]);
      }
    }
  }
  showToast(`Order #${orderCounter} placed! ${sym()}${total.toFixed(2)}`, 'success');
  showReceiptFromData({ ...orderData, items: cartSnapshot, orderNum: orderCounter }, orderRow.OrderID);
  orderCounter++;
  await loadProducts(); renderProductGrid();
  clearCart(); closeMobileCart();
};

function saveOfflineOrder(order) {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  pending.push({ ...order, saved_at: new Date().toISOString() });
  localStorage.setItem('offline_orders', JSON.stringify(pending));
  updateOfflineBadge();
}

window.syncOfflineOrders = async function() {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  if (!pending.length) { showToast('No offline orders', ''); return; }
  if (!navigator.onLine) { showToast('Still offline!', 'error'); return; }
  let synced = 0;
  for (const o of pending) {
    const { data: row, error } = await sb.from('Order').insert([{ EmployeeID: o.EmployeeID, OrderDateTime: o.saved_at, OrderType: o.OrderType, PaymentMethod: o.PaymentMethod, TotalAmount: o.TotalAmount, Status: 'Completed', Notes: o.Notes, DiscountCode: o.DiscountCode, DiscountAmount: o.DiscountAmount }]).select().single();
    if (!error && row) {
      await sb.from('OrderDetails').insert(o.items.map(i => ({ OrderID: row.OrderID, ProductID: i.id, SizeLabel: i.size || null, Quantity: i.quantity, Price: i.price, Subtotal: i.price * i.quantity })));
      synced++;
    }
  }
  if (synced) { localStorage.setItem('offline_orders', JSON.stringify(pending.slice(synced))); showToast(`Synced ${synced} order(s)!`, 'success'); updateOfflineBadge(); }
};

function updateOfflineBadge() {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  const el = document.getElementById('statOffline');
  if (el) el.textContent = pending.length;
}

function showReceiptFromData(order, orderId) {
  const settings = S();
  const s = sym();
  const now = new Date();
  const items = order.items || [];
  const sub = items.reduce((n, i) => n + i.price * i.quantity, 0);
  document.getElementById('receiptContent').innerHTML = `
    <div style="font-family:monospace;font-size:13px;color:#1a1008;padding:8px;">
      <div style="text-align:center;margin-bottom:12px;">
        <div style="font-size:17px;font-weight:bold;">${settings.name || "Mommy's FoodHub"}</div>
        ${settings.address ? `<div style="font-size:11px;color:#666;">${settings.address}</div>` : ''}
        ${settings.contact ? `<div style="font-size:11px;color:#666;">${settings.contact}</div>` : ''}
        <div style="font-size:11px;color:#666;">${now.toLocaleDateString()} ${now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
        <div style="font-size:11px;color:#666;">Cashier: ${currentUser?.Name || '—'} | Order #${order.orderNum || orderId || '—'}</div>
        <div style="font-size:11px;color:#666;">${order.OrderType}</div>
        ${!orderId ? '<div style="font-size:11px;color:#e66;">⚠ Offline Order</div>' : ''}
      </div>
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="font-size:11px;color:#999;"><th style="text-align:left">Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Amt</th></tr></thead>
        <tbody>${items.map(i => `<tr><td>${i.name}${i.size ? ` (${i.size})` : ''}</td><td style="text-align:center">${i.quantity}</td><td style="text-align:right">${s}${(i.price*i.quantity).toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <div style="display:flex;justify-content:space-between;"><span>Subtotal</span><span>${s}${sub.toFixed(2)}</span></div>
      ${(order.DiscountAmount||0)>0 ? `<div style="display:flex;justify-content:space-between;color:green;"><span>Discount (${order.DiscountCode})</span><span>− ${s}${parseFloat(order.DiscountAmount).toFixed(2)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:6px;"><span>TOTAL</span><span>${s}${parseFloat(order.TotalAmount).toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:#555;margin-top:4px;"><span>Payment</span><span>${order.PaymentMethod}</span></div>
      ${order.Notes ? `<div style="margin-top:6px;font-size:11px;color:#555;"><em>Notes: ${order.Notes}</em></div>` : ''}
      <hr style="border:1px dashed #ccc;margin:8px 0;">
      <div style="text-align:center;font-size:11px;color:#999;">${settings.footer || 'Thank you for dining with us! 🙏'}</div>
    </div>`;
  document.getElementById('receiptModal').classList.add('open');
}
window.closeReceipt = function() { document.getElementById('receiptModal').classList.remove('open'); };
window.printReceipt = function() {
  document.getElementById('printArea').innerHTML = document.getElementById('receiptContent').innerHTML;
  document.getElementById('printArea').style.display = 'block';
  window.print();
  document.getElementById('printArea').style.display = 'none';
};

window.loadKitchen = async function() {
  const query = sb.from('Order').select('*, Employee(Name), OrderDetails(Quantity, SizeLabel, Product(Name))').order('OrderDateTime', { ascending: false }).limit(80);
  const { data } = await query;
  kitchenOrders = data || [];
  renderKitchenGrid();
};

window.filterKitchen = function(status, btn) {
  kitchenFilter = status;
  document.querySelectorAll('.kfilter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderKitchenGrid();
};

function renderKitchenGrid() {
  const grid = document.getElementById('kitchenGrid');
  const filtered = kitchenFilter === 'all' ? kitchenOrders : kitchenOrders.filter(o => o.Status === kitchenFilter);
  if (!filtered.length) { grid.innerHTML = '<div style="color:var(--text-muted);padding:30px;text-align:center;">No orders found.</div>'; return; }
  const s = sym();
  grid.innerHTML = filtered.map(o => {
    const d = new Date(o.OrderDateTime);
    const items = (o.OrderDetails || []).map(d => `<strong>${d.Product?.Name || '?'}</strong>${d.SizeLabel ? ` (${d.SizeLabel})` : ''} ×${d.Quantity}`).join('<br>');
    const next = nextStatuses(o.Status);
    return `<div class="kitchen-card status-${o.Status}">
      <div class="kcard-header">
        <div><div class="kcard-num">Order #${o.OrderID}</div><div class="kcard-type">${o.OrderType} · ${o.PaymentMethod}</div></div>
        <div class="kcard-status ${o.Status}">${statusEmoji(o.Status)} ${o.Status}</div>
      </div>
      <div class="kcard-items">${items || '—'}</div>
      <div class="kcard-time">🕐 ${d.toLocaleDateString()} ${d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · ${o.Employee?.Name || '—'}</div>
      ${o.Notes ? `<div class="kcard-time">📝 ${o.Notes}</div>` : ''}
      <div class="kcard-actions">${next.map(n => `<button class="kaction-btn ${n.cls}" onclick="updateOrderStatus(${o.OrderID},'${n.status}')">${n.label}</button>`).join('')}</div>
    </div>`;
  }).join('');
}

function statusEmoji(s) {
  return { Pending:'🟡', Accepted:'🔵', Cooking:'🟠', Ready:'🟢', Completed:'✅', Cancelled:'❌', Refunded:'↩' }[s] || '⬜';
}

function nextStatuses(current) {
  const map = {
    Pending:   [{ status:'Accepted', label:'✔ Accept', cls:'' }, { status:'Cancelled', label:'✕ Cancel', cls:'danger' }],
    Accepted:  [{ status:'Cooking', label:'🍳 Cooking', cls:'' }, { status:'Cancelled', label:'✕ Cancel', cls:'danger' }],
    Cooking:   [{ status:'Ready', label:'🟢 Ready', cls:'success' }, { status:'Cancelled', label:'✕ Cancel', cls:'danger' }],
    Ready:     [{ status:'Completed', label:'✅ Done', cls:'success' }, { status:'Refunded', label:'↩ Refund', cls:'danger' }],
    Completed: [{ status:'Refunded', label:'↩ Refund', cls:'danger' }],
    Cancelled: [],
    Refunded:  [],
  };
  return map[current] || [];
}

window.updateOrderStatus = async function(orderId, status) {
  await sb.from('Order').update({ Status: status }).eq('OrderID', orderId);
  const idx = kitchenOrders.findIndex(o => o.OrderID === orderId);
  if (idx !== -1) kitchenOrders[idx].Status = status;
  renderKitchenGrid();
  showToast(`Order #${orderId} → ${status}`, 'success');
};

window.showTab = function(name, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  if (btn) btn.classList.add('active');
  document.querySelectorAll(`[onclick*="showTab('${name}"]`).forEach(b => b.classList.add('active'));
  closeMobileCart();
  if (name === 'kitchen') loadKitchen();
};

window.openMobileCart = function() { document.getElementById('cartDrawer').classList.add('open'); document.getElementById('cartDrawerOverlay').classList.add('open'); };
window.closeMobileCart = function() { document.getElementById('cartDrawer').classList.remove('open'); document.getElementById('cartDrawerOverlay').classList.remove('open'); };

function applyTheme() {
  const s = S();
  if (s.themeColor) {
    document.documentElement.style.setProperty('--amber', s.themeColor);
    const meta = document.getElementById('themeMetaColor');
    if (meta) meta.setAttribute('content', s.themeColor);
  }
  if (s.bgColor) {
    const adj = (hex, a) => '#' + [1,3,5].map(i => Math.min(255, parseInt(hex.slice(i,i+2),16)+a).toString(16).padStart(2,'0')).join('');
    document.documentElement.style.setProperty('--bg', s.bgColor);
    document.documentElement.style.setProperty('--surface', adj(s.bgColor, 14));
    document.documentElement.style.setProperty('--surface2', adj(s.bgColor, 22));
    document.documentElement.style.setProperty('--border', adj(s.bgColor, 35));
  }
}

let toastTimer;
window.showToast = function(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
};
function showToast(msg, type) { window.showToast(msg, type); }