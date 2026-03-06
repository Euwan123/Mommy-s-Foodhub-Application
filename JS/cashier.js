let cart = [];
let allProducts = [];
let allCategories = [];
let allPromos = [];
let allSizes = [];
let popularProductIds = [];
let selectedCategory = 'All';
let activePromo = null;
let selectedPayment = 'Cash';
let selectedPaymentM = 'Cash';
let selectedOrderType = 'Dine-in';
let selectedOrderTypeM = 'Dine-in';
let checkoutSource = 'desktop';
let orderCounter = 1;
let kitchenFilter = 'all';
let kitchenOrders = [];

const groupOrder = [
  { label: 'Rice Bowls', keywords: ['rice bowl'] },
  { label: 'Breakfast', keywords: ['breakfast meal'] },
  { label: 'Snacks', keywords: ['snack'] },
  { label: 'Barkada Treats', keywords: ['barkada treat'] },
  { label: 'Panwich', keywords: ['panwich'] },
  { label: 'Belgian Waffle', keywords: ['belgian waffle'] },
  { label: 'Milktea', keywords: ['milktea'] },
  { label: 'Milkshake', keywords: ['milkshake'] },
  { label: 'Fruitshake', keywords: ['fruitshake'] },
  { label: 'Lava Latte', keywords: ['lava latte'] },
  { label: 'Frappuccino', keywords: ['frappuccino'] },
  { label: 'Ice Coffee', keywords: ['ice coffee'] },
  { label: 'Fruit Tea', keywords: ['fruit tea'] },
  { label: 'Drinks', keywords: ['drink'] },
  { label: 'Others', keywords: [] }
];

const ingredientGroups = [
  { label: '🥩 Meats', keywords: ['meat','pork','beef','chicken','fish','liempo','bacon','longganisa','hotdog','tuna','bangus','tilapia','shrimp'] },
  { label: '🥦 Vegetables', keywords: ['vegetable','veggie','tomato','onion','garlic','cabbage','carrot','potato','kangkong','spinach','lettuce','pepper','ginger','leek','celery','mushroom'] },
  { label: '🍚 Grains & Starches', keywords: ['rice','flour','bread','pasta','noodle','pandesal','waffle mix','cornstarch','starch'] },
  { label: '🥛 Dairy & Eggs', keywords: ['milk','cream','egg','butter','cheese','yogurt'] },
  { label: '🍬 Sweeteners & Syrup', keywords: ['sugar','syrup','honey','brown sugar','condensed','caramel','chocolate','choco'] },
  { label: '🫙 Sauces & Condiments', keywords: ['sauce','vinegar','soy','ketchup','oyster','fish sauce','patis','mayo','mustard','dressing','oil','lard'] },
  { label: '🧂 Seasonings & Spices', keywords: ['salt','pepper','seasoning','spice','powder','paprika','cumin','bay','msg','magic sarap','knorr','star anise'] },
  { label: '🧋 Beverages & Base', keywords: ['tea','coffee','juice','water','ice','soda','milk tea','base','concentrate'] },
  { label: '📦 Packaging', keywords: ['cup','box','bag','straw','container','wrap','foil','tray','napkin','tissue','spoon','fork','lid'] },
  { label: '🛒 Others', keywords: [] }
];

function getIngredientGroup(name) {
  const lower = (name || '').toLowerCase();
  for (const g of ingredientGroups) {
    if (g.label === '🛒 Others') continue;
    if (g.keywords.some(k => lower.includes(k))) return g.label;
  }
  return '🛒 Others';
}

function gcashFee(base) {
  if (!base || base <= 0) return 0;
  return Math.min(40, Math.floor(base / 50) * 2);
}

function cartSubtotal() { return cart.reduce((s, i) => s + i.price * i.quantity, 0); }

function cartTotal() {
  const sub = cartSubtotal();
  if (!activePromo) return sub;
  return activePromo.type === 'percent'
    ? Math.max(0, sub - sub * activePromo.value / 100)
    : Math.max(0, sub - activePromo.value);
}

function discountAmt() { return cartSubtotal() - cartTotal(); }

function cartTotalWithFees(payment) {
  const base = cartTotal();
  return payment === 'GCash' ? base + gcashFee(base) : base;
}

function getGroupLabel(catName) {
  const lower = (catName || '').toLowerCase();
  for (const g of groupOrder) {
    if (g.label === 'Others') continue;
    if (lower === g.label.toLowerCase()) return g.label;
    if (g.keywords.some(k => lower.includes(k))) return g.label;
  }
  return 'Others';
}

async function initPOS() {
  await Promise.all([loadCategories(), loadProducts(), loadPromos(), loadPopularProducts()]);
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

async function loadPopularProducts() {
  try {
    const { data } = await sb.from('OrderDetails').select('ProductID').limit(500);
    if (!data?.length) return;
    const counts = {};
    data.forEach(d => { counts[d.ProductID] = (counts[d.ProductID] || 0) + 1; });
    popularProductIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id]) => parseInt(id, 10));
  } catch (_) {}
}

window.filterProducts = function () { renderProductGrid(); };

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
    if (!(selectedCategory === 'All' || (p.Category?.CategoryName || '') === selectedCategory)) return false;
    if (!q) return true;
    const haystack = [p.Name || '', p.Category?.CategoryName || '', getGroupLabel(p.Category?.CategoryName || '')].join(' ').toLowerCase();
    return q.split(/\s+/).filter(Boolean).every(w => haystack.includes(w));
  });
  if (!filtered.length) { grid.innerHTML = '<div class="no-products">No items found.</div>'; return; }
  grid.innerHTML = '';

  if (popularProductIds.length && selectedCategory === 'All' && !q) {
    const popularItems = filtered.filter(p => popularProductIds.includes(p.ProductID));
    if (popularItems.length) {
      const ph = document.createElement('div');
      ph.className = 'group-header popular-header';
      ph.innerHTML = '⭐ Popular';
      grid.appendChild(ph);
      popularItems.forEach(p => grid.appendChild(buildProductCard(p)));
    }
  }

  const groups = {};
  filtered.forEach(p => {
    const label = getGroupLabel(p.Category?.CategoryName || '');
    if (!groups[label]) groups[label] = [];
    groups[label].push(p);
  });
  const orderedLabels = groupOrder.map(g => g.label).filter(l => groups[l]?.length);
  const otherLabels = Object.keys(groups).filter(l => !orderedLabels.includes(l));
  [...orderedLabels, ...otherLabels].forEach(label => {
    const header = document.createElement('div');
    header.className = 'group-header';
    header.textContent = label;
    grid.appendChild(header);
    groups[label].forEach(p => grid.appendChild(buildProductCard(p)));
  });
}

function buildProductCard(p) {
  const stock = p.Inventory?.QuantityAvailable ?? p.StockQuantity ?? 99;
  const sizes = allSizes.filter(s => s.ProductID === p.ProductID);
  const low = stock > 0 && stock <= 5;
  const out = stock === 0;
  const d = document.createElement('div');
  d.className = 'product-card' + (low ? ' low-stock' : '') + (out ? ' out-stock' : '');
  d.innerHTML = '<div class="p-name">' + escapeHtml(p.Name) + '</div>' +
    '<div class="p-price">' + sym() + parseFloat(p.BasePrice).toFixed(2) + '</div>' +
    '<div class="p-cat">' + escapeHtml(p.Category?.CategoryName || '') + '</div>' +
    (sizes.length ? '<div class="p-size-hint">+ ' + sizes.length + ' sizes</div>' : '') +
    (low ? '<div class="p-stock-badge">Low: ' + stock + '</div>' : '') +
    (out ? '<div class="p-stock-badge" style="color:var(--red)">Out of stock</div>' : '');
  d.onclick = () => sizes.length ? openSizeModal(p) : addToCart(p, null, null);
  return d;
}

window.openSizeModal = function (p) {
  document.getElementById('sizeModalTitle').textContent = p.Name + ' — Choose Size';
  const list = document.getElementById('sizeList');
  list.innerHTML = '';
  const btn0 = document.createElement('button');
  btn0.className = 'size-btn';
  btn0.innerHTML = '<span>Regular</span><span class="size-price">' + sym() + parseFloat(p.BasePrice).toFixed(2) + '</span>';
  btn0.onclick = () => { addToCart(p, null, null); closeSizeModal(); };
  list.appendChild(btn0);
  allSizes.filter(s => s.ProductID === p.ProductID).forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'size-btn';
    btn.innerHTML = '<span>' + escapeHtml(s.Size) + '</span><span class="size-price">' + sym() + parseFloat(s.Price).toFixed(2) + '</span>';
    btn.onclick = () => { addToCart(p, s.Size, parseFloat(s.Price)); closeSizeModal(); };
    list.appendChild(btn);
  });
  document.getElementById('sizeModal').classList.add('open');
};
window.closeSizeModal = function () { document.getElementById('sizeModal').classList.remove('open'); };

function addToCart(p, sizeLabel, sizePrice) {
  const price = sizePrice !== null ? sizePrice : parseFloat(p.BasePrice);
  const key = p.ProductID + '__' + (sizeLabel || '');
  const ex = cart.find(i => i.key === key);
  if (ex) { ex.quantity++; }
  else { cart.push({ key, id: p.ProductID, name: p.Name, size: sizeLabel, price, quantity: 1, mods: [] }); }
  renderCart();
}

window.changeQty = function (key, delta) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) cart = cart.filter(i => i.key !== key);
  renderCart();
};

window.removeFromCart = function (key) {
  cart = cart.filter(i => i.key !== key);
  renderCart();
};

window.clearCart = function () {
  cart = [];
  activePromo = null;
  ['promoInput','orderNotes','cashReceived','tableNumber','deliveryPlatform','deliveryRider',
   'promoInputM','orderNotesM','cashReceivedM','tableNumberM','deliveryPlatformM','deliveryRiderM']
    .forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  ['promoMsg','promoMsgM'].forEach(id => { const e = document.getElementById(id); if (e) e.textContent = ''; });
  renderCart();
};

function formatModifiers(item) {
  if (!item.mods || !item.mods.length) return '';
  return '<div class="ci-sub" style="font-size:11px;">' + item.mods.map(m => (m.delta > 0 ? '+' : '') + m.delta + ' ' + escapeHtml(m.label)).join(' | ') + '</div>';
}

function renderCart() {
  const baseTotal = cartTotal();
  const disc = discountAmt();
  const s = sym();
  const count = cart.reduce((n, i) => n + i.quantity, 0);
  const html = !cart.length
    ? '<div class="cart-empty">No items yet.<br>Tap a dish to add.</div>'
    : cart.map(i =>
        '<div class="cart-item">' +
        '<div style="flex:1;min-width:0;">' +
        '<div class="ci-name">' + escapeHtml(i.name) + '</div>' +
        (i.size ? '<div class="ci-size">' + escapeHtml(i.size) + '</div>' : '') +
        '<div class="ci-sub">' + s + i.price.toFixed(2) + ' each</div>' +
        formatModifiers(i) +
        '</div>' +
        '<div class="qty-ctrl">' +
        '<button class="qty-btn" onclick="changeQty(\'' + i.key + '\',-1)">−</button>' +
        '<span class="qty-val">' + i.quantity + '</span>' +
        '<button class="qty-btn" onclick="changeQty(\'' + i.key + '\',1)">+</button>' +
        '</div>' +
        '<div class="ci-total">' + s + (i.price * i.quantity).toFixed(2) + '</div>' +
        '<button class="ci-del" onclick="removeFromCart(\'' + i.key + '\')">×</button>' +
        '<button class="qty-btn" onclick="editModifiers(\'' + i.key + '\')" style="margin-left:4px;" title="Modifier">⚙</button>' +
        '</div>'
      ).join('');

  ['cartItems','cartItemsMobile'].forEach(id => { const e = document.getElementById(id); if (e) e.innerHTML = html; });

  const feeD = selectedPayment === 'GCash' ? gcashFee(baseTotal) : 0;
  const feeM = selectedPaymentM === 'GCash' ? gcashFee(baseTotal) : 0;
  const totalDesktop = baseTotal + feeD;
  const totalMobile = baseTotal + feeM;

  const ctEl = document.getElementById('cartTotal');
  if (ctEl) ctEl.textContent = totalDesktop.toFixed(2);
  const ctMEl = document.getElementById('cartTotalM');
  if (ctMEl) ctMEl.textContent = totalMobile.toFixed(2);

  ['discountLine','discountLineM'].forEach(id => {
    const e = document.getElementById(id);
    if (!e) return;
    e.style.display = (activePromo && disc > 0) ? 'block' : 'none';
    if (activePromo && disc > 0) e.textContent = '− ' + s + disc.toFixed(2) + ' (' + activePromo.code + ')';
  });

  [['feeLine',feeD],['feeLineM',feeM]].forEach(([id,fee]) => {
    const e = document.getElementById(id);
    if (!e) return;
    e.style.display = fee > 0 ? 'block' : 'none';
    if (fee > 0) e.textContent = 'GCash fee: + ' + s + fee.toFixed(2);
  });

  const dineIn = selectedOrderType === 'Dine-in';
  const dineInM = selectedOrderTypeM === 'Dine-in';
  const tw = document.getElementById('tableNumberWrap');
  const twM = document.getElementById('tableNumberWrapM');
  if (tw) tw.style.display = dineIn ? 'block' : 'none';
  if (twM) twM.style.display = dineInM ? 'block' : 'none';

  const cc = document.getElementById('changeCalc');
  if (cc) cc.style.display = selectedPayment === 'Cash' ? 'block' : 'none';
  const ccm = document.getElementById('changeCalcM');
  if (ccm) ccm.style.display = selectedPaymentM === 'Cash' ? 'block' : 'none';
  calcChange();
  calcChangeM();

  const fab = document.getElementById('cartFab');
  if (fab) {
    fab.classList.toggle('has-items', count > 0);
    document.getElementById('cartFabCount').textContent = count;
    document.getElementById('cartFabTotal').textContent = s + totalDesktop.toFixed(2);
  }
  document.querySelectorAll('.curr-sym').forEach(e => { e.textContent = s; });
  document.querySelectorAll('.curr-sym-inline').forEach(e => { e.textContent = s; });
}

window.editModifiers = function (key) {
  const item = cart.find(i => i.key === key);
  if (!item) return;
  const label = prompt('Describe change (e.g. extra chili, no onions):');
  if (!label) return;
  const deltaStr = prompt('Enter +1 for extra portion or -1 for removed portion:', '+1');
  const delta = parseInt(deltaStr, 10);
  if (!delta || isNaN(delta)) return;
  if (!item.mods) item.mods = [];
  item.mods.push({ label, delta });
  renderCart();
};

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
  const dw = document.getElementById('deliveryFields');
  if (dw) dw.style.display = t === 'Delivery' ? 'block' : 'none';
  const tw = document.getElementById('tableNumberWrap');
  if (tw) tw.style.display = t === 'Dine-in' ? 'block' : 'none';
};
window.setOrderTypeM = function (t, btn) {
  selectedOrderTypeM = t;
  document.querySelectorAll('.cart-drawer .otype-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const dw = document.getElementById('deliveryFieldsM');
  if (dw) dw.style.display = t === 'Delivery' ? 'block' : 'none';
  const tw = document.getElementById('tableNumberWrapM');
  if (tw) tw.style.display = t === 'Dine-in' ? 'block' : 'none';
};

window.setQuickCash = function (amount, source) {
  const id = source === 'mobile' ? 'cashReceivedM' : 'cashReceived';
  const el = document.getElementById(id);
  if (el) el.value = amount;
  if (source === 'mobile') calcChangeM(); else calcChange();
};

window.calcChange = function () {
  const r = parseFloat(document.getElementById('cashReceived')?.value) || 0;
  const total = cartTotalWithFees(selectedPayment);
  const c = r - total;
  const el = document.getElementById('changeAmt');
  if (el) { el.textContent = Math.max(0, c).toFixed(2); el.style.color = c >= 0 ? 'var(--green)' : 'var(--red)'; }
};
window.calcChangeM = function () {
  const r = parseFloat(document.getElementById('cashReceivedM')?.value) || 0;
  const total = cartTotalWithFees(selectedPaymentM);
  const c = r - total;
  const el = document.getElementById('changeAmtM');
  if (el) { el.textContent = Math.max(0, c).toFixed(2); el.style.color = c >= 0 ? 'var(--green)' : 'var(--red)'; }
};

function applyPromoCode(code, msgId) {
  const promo = allPromos.find(p => p.Code.toUpperCase() === code.toUpperCase());
  const msg = document.getElementById(msgId);
  if (!promo) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Invalid promo code.'; }
    activePromo = null;
    renderCart();
    return;
  }
  activePromo = { code: promo.Code, type: promo.Type, value: parseFloat(promo.Value) };
  if (msg) { msg.style.color = 'var(--green)'; msg.textContent = promo.Type === 'percent' ? '✓ ' + promo.Value + '% off!' : '✓ ' + sym() + promo.Value + ' off!'; }
  renderCart();
}
window.applyPromo = function () { applyPromoCode(document.getElementById('promoInput').value.trim(), 'promoMsg'); };
window.applyPromoM = function () { applyPromoCode(document.getElementById('promoInputM').value.trim(), 'promoMsgM'); };

window.openCheckoutModal = function (source) {
  if (!cart.length) { showToast('Cart is empty!', 'error'); return; }
  checkoutSource = source;
  const isMobile = source === 'mobile';
  const payment = isMobile ? selectedPaymentM : selectedPayment;
  const orderType = isMobile ? selectedOrderTypeM : selectedOrderType;
  const notes = document.getElementById(isMobile ? 'orderNotesM' : 'orderNotes').value.trim();
  const tableNum = document.getElementById(isMobile ? 'tableNumberM' : 'tableNumber')?.value.trim() || '';
  const sub = cartSubtotal();
  const disc = discountAmt();
  const baseTotal = cartTotal();
  const fee = payment === 'GCash' ? gcashFee(baseTotal) : 0;
  const total = baseTotal + fee;
  const s = sym();
  const cash = parseFloat(document.getElementById(isMobile ? 'cashReceivedM' : 'cashReceived')?.value) || 0;
  const change = payment === 'Cash' ? Math.max(0, cash - total) : null;
  const feeHtml = fee > 0 ? '<span style="color:var(--text-muted)">GCash fee: + ' + s + fee.toFixed(2) + '</span><br>' : '';
  const tableHtml = tableNum ? '<span style="color:var(--amber)">🪑 Table ' + escapeHtml(tableNum) + '</span><br>' : '';
  document.getElementById('modalBody').innerHTML =
    '<strong>Order #' + orderCounter + '</strong> · ' + escapeHtml(orderType) + '<br>' +
    tableHtml +
    cart.map(i => escapeHtml(i.name) + (i.size ? ' (' + escapeHtml(i.size) + ')' : '') + ' × ' + i.quantity + ' = ' + s + (i.price * i.quantity).toFixed(2)).join('<br>') +
    '<hr style="border-color:#3d2b14;margin:10px 0;">' +
    (disc > 0 ? '<span style="color:var(--text-muted)">Subtotal: ' + s + sub.toFixed(2) + '</span><br><span style="color:var(--green)">Discount: − ' + s + disc.toFixed(2) + '</span><br>' : '<span style="color:var(--text-muted)">Subtotal: ' + s + sub.toFixed(2) + '</span><br>') +
    feeHtml +
    '<strong>Total: ' + s + total.toFixed(2) + '</strong><br>Payment: ' + escapeHtml(payment) +
    (notes ? '<br>Notes: ' + escapeHtml(notes) : '') +
    (change !== null ? '<br>Change: <strong style="color:var(--green)">' + s + change.toFixed(2) + '</strong>' : '');
  document.getElementById('checkoutModal').classList.add('open');
};
window.closeModal = function () { document.getElementById('checkoutModal').classList.remove('open'); };

window.checkout = async function () {
  closeModal();
  const isMobile = checkoutSource === 'mobile';
  const payment = isMobile ? selectedPaymentM : selectedPayment;
  const orderType = isMobile ? selectedOrderTypeM : selectedOrderType;
  const notesBase = document.getElementById(isMobile ? 'orderNotesM' : 'orderNotes').value.trim();
  const platform = document.getElementById(isMobile ? 'deliveryPlatformM' : 'deliveryPlatform')?.value.trim() || '';
  const rider = document.getElementById(isMobile ? 'deliveryRiderM' : 'deliveryRider')?.value.trim() || '';
  const tableNum = document.getElementById(isMobile ? 'tableNumberM' : 'tableNumber')?.value.trim() || '';
  let notes = notesBase;
  if (orderType === 'Dine-in' && tableNum) {
    const tableTag = 'Table: ' + tableNum;
    notes = notes ? notes + ' | ' + tableTag : tableTag;
  }
  if (orderType === 'Delivery') {
    const parts = [];
    if (platform) parts.push('Platform: ' + platform);
    if (rider) parts.push('Rider: ' + rider);
    if (parts.length) {
      const extra = 'Delivery Info — ' + parts.join(' | ');
      notes = notes ? notes + ' | ' + extra : extra;
    }
  }
  const disc = discountAmt();
  const baseTotal = cartTotal();
  const fee = payment === 'GCash' ? gcashFee(baseTotal) : 0;
  const total = baseTotal + fee;
  const cartSnapshot = cart.map(i => ({ ...i }));
  const orderData = {
    EmployeeID: currentUser.EmployeeID,
    OrderDateTime: new Date().toISOString(),
    OrderType: orderType,
    PaymentMethod: payment,
    TotalAmount: total,
    Status: 'Pending',
    Notes: notes || null,
    DiscountCode: activePromo?.code || null,
    DiscountAmount: disc,
    GCashFee: fee > 0 ? fee : null,
    TableNumber: tableNum || null
  };

  if (!navigator.onLine) {
    saveOfflineOrder({ ...orderData, items: cartSnapshot, orderNum: orderCounter, tableNum });
    showToast('Saved offline! Order #' + orderCounter, 'success');
    showReceiptFromData({ ...orderData, items: cartSnapshot, orderNum: orderCounter, tableNum }, null);
    orderCounter++;
    clearCart();
    closeMobileCart();
    return;
  }

  const insertPayload = {
    EmployeeID: orderData.EmployeeID,
    OrderDateTime: orderData.OrderDateTime,
    OrderType: orderData.OrderType,
    PaymentMethod: orderData.PaymentMethod,
    TotalAmount: orderData.TotalAmount,
    Status: orderData.Status,
    Notes: orderData.Notes,
    DiscountCode: orderData.DiscountCode,
    DiscountAmount: orderData.DiscountAmount
  };
  if (orderData.GCashFee != null) insertPayload.GCashFee = orderData.GCashFee;

  const { data: orderRow, error: orderErr } = await sb.from('Order').insert([insertPayload]).select().single();
  if (orderErr || !orderRow) {
    const msg = orderErr?.message || 'Unknown error';
    showToast('DB error: ' + msg, 'error');
    console.error('Order insert failed:', orderErr);
    const tryBase = {
      EmployeeID: orderData.EmployeeID,
      OrderDateTime: orderData.OrderDateTime,
      OrderType: orderData.OrderType,
      PaymentMethod: orderData.PaymentMethod,
      TotalAmount: orderData.TotalAmount,
      Status: orderData.Status,
      Notes: orderData.Notes,
      DiscountCode: orderData.DiscountCode,
      DiscountAmount: orderData.DiscountAmount
    };
    if (orderData.GCashFee != null) tryBase.GCashFee = orderData.GCashFee;
    const { data: retryRow, error: retryErr } = await sb.from('Order').insert([tryBase]).select().single();
    if (retryErr || !retryRow) {
      showToast('Failed: ' + (retryErr?.message || msg), 'error');
      console.error('Retry failed:', retryErr);
      saveOfflineOrder({ ...orderData, items: cartSnapshot, orderNum: orderCounter, tableNum });
      orderCounter++;
      clearCart();
      closeMobileCart();
      return;
    }
    Object.assign(orderRow || {}, retryRow);
    const orderRowFinal = retryRow;
    const orderId2 = orderRowFinal.OrderID;
    await sb.from('OrderDetails').insert(cartSnapshot.map(i => ({
      OrderID: orderId2, ProductID: i.id, SizeLabel: i.size || null,
      Quantity: i.quantity, Price: i.price, Subtotal: i.price * i.quantity
    })));
    for (const i of cartSnapshot) {
      try {
        const { data: ingData } = await sb.from('Ingredients').select('ItemID,UnitPerServing').eq('ProductID', i.id);
        if (ingData?.length) {
          for (const ing of ingData) {
            const { data: itemRow } = await sb.from('Item').select('UnitQuantity').eq('ItemID', ing.ItemID).single();
            const curr = parseFloat(itemRow?.UnitQuantity ?? 0) || 0;
            const deduct = (parseFloat(ing.UnitPerServing) || 0) * i.quantity;
            const { error: updateErr } = await sb.from('Item').update({ UnitQuantity: Math.max(0, curr - deduct) }).eq('ItemID', ing.ItemID);
            if (!updateErr) await sb.from('IngredientLog').insert([{ ItemID: ing.ItemID, OrderID: orderId2, ChangeAmt: -deduct, Reason: 'Order' }]);
          }
        }
      } catch (_) {}
    }
    showToast('Order #' + orderCounter + ' placed! ' + sym() + total.toFixed(2), 'success');
    showReceiptFromData({ ...orderData, items: cartSnapshot, orderNum: orderCounter, tableNum }, orderId2);
    orderCounter++;
    await loadProducts();
    renderProductGrid();
    clearCart();
    closeMobileCart();
    return;
  }

  const orderId = orderRow.OrderID;
  const { error: detailsErr } = await sb.from('OrderDetails').insert(cartSnapshot.map(i => ({
    OrderID: orderId, ProductID: i.id, SizeLabel: i.size || null,
    Quantity: i.quantity, Price: i.price, Subtotal: i.price * i.quantity
  })));

  if (detailsErr) {
    showToast('Order saved but items failed: ' + detailsErr.message, 'error');
    await sb.from('Order').delete().eq('OrderID', orderId);
    return;
  }

  for (const i of cartSnapshot) {
    try {
      const { data: ingData } = await sb.from('Ingredients').select('ItemID,UnitPerServing').eq('ProductID', i.id);
      if (ingData?.length) {
        for (const ing of ingData) {
          const { data: itemRow } = await sb.from('Item').select('UnitQuantity').eq('ItemID', ing.ItemID).single();
          const curr = parseFloat(itemRow?.UnitQuantity ?? 0) || 0;
          const deduct = (parseFloat(ing.UnitPerServing) || 0) * i.quantity;
          const { error: updateErr } = await sb.from('Item').update({ UnitQuantity: Math.max(0, curr - deduct) }).eq('ItemID', ing.ItemID);
          if (!updateErr) await sb.from('IngredientLog').insert([{ ItemID: ing.ItemID, OrderID: orderId, ChangeAmt: -deduct, Reason: 'Order' }]);
        }
      }
    } catch (_) {}
  }

  showToast('Order #' + orderCounter + ' placed! ' + sym() + total.toFixed(2), 'success');
  showReceiptFromData({ ...orderData, items: cartSnapshot, orderNum: orderCounter, tableNum }, orderId);
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

function showReceiptFromData(order, orderId) {
  const settings = S();
  const s = sym();
  const now = new Date();
  const items = order.items || [];
  const sub = items.reduce((n, i) => n + i.price * i.quantity, 0);
  const fee = order.GCashFee || 0;
  const tableNum = order.tableNum || order.TableNumber || '';
  const discountLine = (order.DiscountAmount || 0) > 0
    ? '<div style="display:flex;justify-content:space-between;color:green;font-size:12px;"><span>Discount (' + escapeHtml(order.DiscountCode) + ')</span><span>− ' + s + parseFloat(order.DiscountAmount).toFixed(2) + '</span></div>'
    : '';
  const feeLine = fee > 0
    ? '<div style="display:flex;justify-content:space-between;color:#555;font-size:12px;"><span>GCash fee</span><span>+ ' + s + parseFloat(fee).toFixed(2) + '</span></div>'
    : '';
  const tableLine = tableNum ? '<div style="font-size:12px;font-weight:700;color:#333;margin-top:4px;">🪑 Table ' + escapeHtml(String(tableNum)) + '</div>' : '';
  const itemRows = items.map(i => {
    const mods = i.mods?.length ? '<div style="font-size:10px;color:#666;">' + i.mods.map(m => (m.delta > 0 ? '+' : '') + m.delta + ' ' + escapeHtml(m.label)).join(' | ') + '</div>' : '';
    return '<tr>' +
      '<td style="padding:4px 0;">' + escapeHtml(i.name) + (i.size ? ' (' + escapeHtml(i.size) + ')' : '') + mods + '</td>' +
      '<td style="text-align:center;padding:4px 6px;white-space:nowrap;">' + i.quantity + '</td>' +
      '<td style="text-align:right;padding:4px 0;white-space:nowrap;">' + s + (i.price * i.quantity).toFixed(2) + '</td>' +
      '</tr>';
  }).join('');

  document.getElementById('receiptContent').innerHTML =
    '<div style="font-family:monospace;font-size:13px;color:#1a1008;padding:8px;">' +
    '<div style="text-align:center;margin-bottom:12px;">' +
    '<div style="font-size:17px;font-weight:bold;">' + escapeHtml(settings.name || "Mommy's FoodHub") + '</div>' +
    (settings.address ? '<div style="font-size:11px;color:#666;">' + escapeHtml(settings.address) + '</div>' : '') +
    (settings.contact ? '<div style="font-size:11px;color:#666;">' + escapeHtml(settings.contact) + '</div>' : '') +
    '<div style="font-size:11px;color:#666;">' + now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</div>' +
    '<div style="font-size:11px;color:#666;">Cashier: ' + escapeHtml(currentUser?.Name || '—') + ' | Order #' + (order.orderNum || orderId || '—') + '</div>' +
    '<div style="font-size:11px;color:#666;">' + escapeHtml(order.OrderType) + '</div>' +
    tableLine +
    (!orderId ? '<div style="font-size:11px;color:#e66;">⚠ Offline Order</div>' : '') +
    '</div>' +
    '<hr style="border:1px dashed #ccc;margin:8px 0;">' +
    '<table style="width:100%;border-collapse:collapse;">' +
    '<thead><tr style="font-size:11px;color:#999;border-bottom:1px dashed #ccc;">' +
    '<th style="text-align:left;padding-bottom:4px;">Item</th>' +
    '<th style="text-align:center;padding-bottom:4px;">Qty</th>' +
    '<th style="text-align:right;padding-bottom:4px;">Amt</th>' +
    '</tr></thead>' +
    '<tbody>' + itemRows + '</tbody>' +
    '</table>' +
    '<hr style="border:1px dashed #ccc;margin:8px 0;">' +
    '<div style="display:flex;justify-content:space-between;font-size:13px;"><span>Subtotal</span><span>' + s + sub.toFixed(2) + '</span></div>' +
    discountLine + feeLine +
    '<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:15px;margin-top:6px;border-top:2px solid #333;padding-top:6px;"><span>TOTAL</span><span>' + s + parseFloat(order.TotalAmount).toFixed(2) + '</span></div>' +
    '<div style="display:flex;justify-content:space-between;font-size:12px;color:#555;margin-top:4px;"><span>Payment</span><span>' + escapeHtml(order.PaymentMethod) + '</span></div>' +
    (order.Notes ? '<div style="margin-top:6px;font-size:11px;color:#555;word-break:break-word;"><em>Notes: ' + escapeHtml(order.Notes) + '</em></div>' : '') +
    '<hr style="border:1px dashed #ccc;margin:8px 0;">' +
    '<div style="text-align:center;font-size:11px;color:#999;">' + escapeHtml(settings.footer || 'Thank you for dining with us! 🙏') + '</div>' +
    '</div>';
  document.getElementById('receiptModal').classList.add('open');
}
window.closeReceipt = function () { document.getElementById('receiptModal').classList.remove('open'); };
window.printReceipt = function () {
  document.getElementById('printArea').innerHTML = document.getElementById('receiptContent').innerHTML;
  document.getElementById('printArea').style.display = 'block';
  window.print();
  document.getElementById('printArea').style.display = 'none';
};

window.loadKitchen = async function () {
  const { data } = await sb.from('Order')
    .select('*, Employee(Name), OrderDetails(Quantity, SizeLabel, Product(Name))')
    .order('OrderDateTime', { ascending: false })
    .limit(80);
  kitchenOrders = data || [];
  renderKitchenGrid();
};

window.filterKitchen = function (status, btn) {
  kitchenFilter = status;
  document.querySelectorAll('.kfilter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderKitchenGrid();
};

function parseTableFromNotes(notes) {
  if (!notes) return '';
  const m = notes.match(/Table:\s*([^|]+)/i);
  return m ? m[1].trim() : '';
}

function renderKitchenGrid() {
  const grid = document.getElementById('kitchenGrid');
  const filtered = kitchenFilter === 'all' ? kitchenOrders : kitchenOrders.filter(o => o.Status === kitchenFilter);
  if (!filtered.length) { grid.innerHTML = '<div style="color:var(--text-muted);padding:30px;text-align:center;">No orders found.</div>'; return; }
  grid.innerHTML = filtered.map(o => {
    const d = new Date(o.OrderDateTime);
    const items = (o.OrderDetails || []).map(d => '<strong>' + escapeHtml(d.Product?.Name || '?') + '</strong>' + (d.SizeLabel ? ' (' + escapeHtml(d.SizeLabel) + ')' : '') + ' ×' + d.Quantity).join('<br>');
    const next = nextStatuses(o.Status);
    const tableNum = o.TableNumber || parseTableFromNotes(o.Notes);
    const tableBadge = tableNum ? '<div style="display:inline-block;background:#78350f;color:#fcd34d;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;margin-bottom:8px;">🪑 Table ' + escapeHtml(String(tableNum)) + '</div><br>' : '';
    return '<div class="kitchen-card status-' + o.Status + '">' +
      '<div class="kcard-header"><div><div class="kcard-num">Order #' + o.OrderID + '</div>' +
      '<div class="kcard-type">' + escapeHtml(o.OrderType) + ' · ' + escapeHtml(o.PaymentMethod) + '</div></div>' +
      '<div class="kcard-status ' + o.Status + '">' + statusEmoji(o.Status) + ' ' + o.Status + '</div></div>' +
      tableBadge +
      '<div class="kcard-items">' + (items || '—') + '</div>' +
      '<div class="kcard-time">🕐 ' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' · ' + escapeHtml(o.Employee?.Name || '—') + '</div>' +
      (o.Notes ? '<div class="kcard-time">📝 ' + escapeHtml(o.Notes) + '</div>' : '') +
      '<div class="kcard-actions">' + next.map(n => '<button class="kaction-btn ' + n.cls + '" onclick="updateOrderStatus(' + o.OrderID + ',\'' + n.status + '\')">' + n.label + '</button>').join('') + '</div>' +
      '</div>';
  }).join('');
}

function statusEmoji(s) {
  return { Pending: '🟡', Accepted: '🔵', Cooking: '🟠', Ready: '🟢', Completed: '✅', Cancelled: '❌', Refunded: '↩' }[s] || '⬜';
}

function nextStatuses(current) {
  return ({
    Pending: [{ status: 'Accepted', label: '✔ Accept', cls: '' }, { status: 'Cancelled', label: '✕ Cancel', cls: 'danger' }],
    Accepted: [{ status: 'Cooking', label: '🍳 Cooking', cls: '' }, { status: 'Cancelled', label: '✕ Cancel', cls: 'danger' }],
    Cooking: [{ status: 'Ready', label: '🟢 Ready', cls: 'success' }, { status: 'Cancelled', label: '✕ Cancel', cls: 'danger' }],
    Ready: [{ status: 'Completed', label: '✅ Done', cls: 'success' }, { status: 'Refunded', label: '↩ Refund', cls: 'danger' }],
    Completed: [{ status: 'Refunded', label: '↩ Refund', cls: 'danger' }],
    Cancelled: [],
    Refunded: []
  })[current] || [];
}

window.updateOrderStatus = async function (orderId, status) {
  if (status === 'Cancelled' || status === 'Refunded') await refundOrderIngredients(orderId);
  await sb.from('Order').update({ Status: status }).eq('OrderID', orderId);
  const idx = kitchenOrders.findIndex(o => o.OrderID === orderId);
  if (idx !== -1) kitchenOrders[idx].Status = status;
  renderKitchenGrid();
  showToast('Order #' + orderId + ' → ' + status, 'success');
};

window.showTab = function (name, btn) {
  document.querySelectorAll('#posView .tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  closeMobileCart();
  if (name === 'kitchen') loadKitchen();
};

window.openMobileCart = function () {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartDrawerOverlay').classList.add('open');
};
window.closeMobileCart = function () {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartDrawerOverlay').classList.remove('open');
};

window.getIngredientGroup = getIngredientGroup;