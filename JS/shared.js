const sb = window.supabase;

let currentUser = null;
let activeAttendanceId = null;
let currentViewMode = 'pos';
let adminOverride = false;
let adminPanelMode = false;
let employeeCheckoutPollTimer = null;

const S = () => JSON.parse(localStorage.getItem('pos_settings') || '{}');
const sym = () => S().currency || '₱';
const isAdmin = () => currentUser && (currentUser.AccessLevel === 'Admin' || currentUser.AccessLevel === 'Manager');

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let toastTimer;
function showToast(msg, type) {
  type = type || '';
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.className = ''; }, 3000);
}
window.showToast = showToast;

function applyTheme() {
  const s = S();
  if (s.themeColor) {
    document.documentElement.style.setProperty('--amber', s.themeColor);
    const meta = document.getElementById('themeMetaColor');
    if (meta) meta.setAttribute('content', s.themeColor);
  }
  if (s.bgColor) {
    const adj = function (hex, a) {
      return '#' + [1, 3, 5].map(function (i) { return Math.min(255, parseInt(hex.slice(i, i + 2), 16) + a).toString(16).padStart(2, '0'); }).join('');
    };
    document.documentElement.style.setProperty('--bg', s.bgColor);
    document.documentElement.style.setProperty('--surface', adj(s.bgColor, 14));
    document.documentElement.style.setProperty('--surface2', adj(s.bgColor, 22));
    document.documentElement.style.setProperty('--border', adj(s.bgColor, 35));
  }
}

function setThemeColor(color) {
  const s = S();
  s.themeColor = color;
  localStorage.setItem('pos_settings', JSON.stringify(s));
  document.documentElement.style.setProperty('--amber', color);
  const meta = document.getElementById('themeMetaColor');
  if (meta) meta.setAttribute('content', color);
}

function setBgColor(bg) {
  const s = S();
  s.bgColor = bg;
  localStorage.setItem('pos_settings', JSON.stringify(s));
  const adj = function (hex, a) {
    return '#' + [1, 3, 5].map(function (i) { return Math.min(255, parseInt(hex.slice(i, i + 2), 16) + a).toString(16).padStart(2, '0'); }).join('');
  };
  document.documentElement.style.setProperty('--bg', bg);
  document.documentElement.style.setProperty('--surface', adj(bg, 14));
  document.documentElement.style.setProperty('--surface2', adj(bg, 22));
  document.documentElement.style.setProperty('--border', adj(bg, 35));
}

function setCurrency(symbol) {
  const s = S();
  s.currency = symbol;
  localStorage.setItem('pos_settings', JSON.stringify(s));
}

window.applyCustomColor = function (val) { setThemeColor(val); };

window.resetTheme = function () {
  setThemeColor('#f59e0b');
  setBgColor('#1a1008');
  document.querySelectorAll('.swatch').forEach(function (s) { s.classList.toggle('active', s.dataset.color === '#f59e0b'); });
  document.querySelectorAll('.bg-swatch').forEach(function (s) { s.classList.toggle('active', s.dataset.bg === '#1a1008'); });
  showToast('Theme reset!', 'success');
};

window.applyCustomCurrency = function () {
  const val = document.getElementById('customCurrency').value.trim();
  if (!val) return;
  document.querySelectorAll('.curr-btn').forEach(function (b) { b.classList.remove('active'); });
  setCurrency(val);
  showToast('Currency updated!', 'success');
};

window.saveSettings = function () {
  const prev = S();
  const updated = Object.assign({}, prev, {
    name: document.getElementById('settingName').value || "Mommy's FoodHub",
    address: document.getElementById('settingAddress').value || '',
    contact: document.getElementById('settingContact').value || '',
    footer: document.getElementById('settingFooter').value || 'Thank you for dining with us! 🙏'
  });
  localStorage.setItem('pos_settings', JSON.stringify(updated));
  showToast('Settings saved!', 'success');
};

function loadSettingsForm() {
  const s = S();
  if (s.name) document.getElementById('settingName').value = s.name;
  if (s.address) document.getElementById('settingAddress').value = s.address;
  if (s.contact) document.getElementById('settingContact').value = s.contact;
  if (s.footer) document.getElementById('settingFooter').value = s.footer;
  document.querySelectorAll('.swatch[data-color]').forEach(function (sw) {
    sw.classList.toggle('active', sw.dataset.color === (s.themeColor || '#f59e0b'));
    sw.onclick = function () {
      document.querySelectorAll('.swatch').forEach(function (x) { x.classList.remove('active'); });
      sw.classList.add('active');
      setThemeColor(sw.dataset.color);
    };
  });
  document.querySelectorAll('.bg-swatch').forEach(function (sw) {
    sw.classList.toggle('active', sw.dataset.bg === (s.bgColor || '#1a1008'));
    sw.onclick = function () {
      document.querySelectorAll('.bg-swatch').forEach(function (x) { x.classList.remove('active'); });
      sw.classList.add('active');
      setBgColor(sw.dataset.bg);
    };
  });
  document.querySelectorAll('.curr-btn').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.symbol === (s.currency || '₱'));
    btn.onclick = function () {
      document.querySelectorAll('.curr-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      setCurrency(btn.dataset.symbol);
    };
  });
}

window.changePassword = async function () {
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
  ['curPass','newPass','confirmPass'].forEach(function (id) { document.getElementById(id).value = ''; });
  showToast('Password updated!', 'success');
};

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

window.openAccountModal = function () {
  if (!currentUser) return;
  document.getElementById('accountAvatar').textContent = currentUser.Name.charAt(0).toUpperCase();
  document.getElementById('accountName').textContent = currentUser.Name;
  document.getElementById('accountMeta').textContent = currentUser.Position || 'Staff';
  document.getElementById('accountUsername').textContent = currentUser.Username || '—';
  document.getElementById('accountId').textContent = '#' + currentUser.EmployeeID;
  document.getElementById('accountAccess').textContent = currentUser.AccessLevel;
  const shiftEl = document.getElementById('accountShift');
  if (activeAttendanceId) {
    shiftEl.textContent = '✅ Checked In';
    shiftEl.style.color = 'var(--green)';
  } else {
    shiftEl.textContent = '⏹ Not Checked In';
    shiftEl.style.color = 'var(--text-muted)';
  }
  document.getElementById('accountModal').classList.add('open');
};
window.closeAccountModal = function () { document.getElementById('accountModal').classList.remove('open'); };

window.doLogout = async function () {
  if (activeAttendanceId) {
    await sb.from('Attendance').update({ CheckOut: new Date().toISOString() }).eq('AttendanceID', activeAttendanceId);
    activeAttendanceId = null;
  }
  currentUser = null;
  clearTimeout(employeeCheckoutPollTimer);
  closeAccountModal();
  document.getElementById('app').style.display = 'none';
  const ls = document.getElementById('loginScreen');
  ls.style.display = 'flex';
  setTimeout(function () { ls.style.opacity = '1'; }, 10);
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
};

function startEmployeeCheckoutPoll() {
  if (isAdmin() || !activeAttendanceId) return;
  const poll = async function () {
    const { data } = await sb.from('Attendance').select('CheckOut').eq('AttendanceID', activeAttendanceId).single();
    if (data?.CheckOut) {
      clearTimeout(employeeCheckoutPollTimer);
      doLogout();
      return;
    }
    employeeCheckoutPollTimer = setTimeout(poll, 3000);
  };
  employeeCheckoutPollTimer = setTimeout(poll, 3000);
}

async function checkOpenAttendance() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await sb.from('Attendance')
    .select('*')
    .eq('EmployeeID', currentUser.EmployeeID)
    .is('CheckOut', null)
    .gte('CheckIn', today + 'T00:00:00')
    .maybeSingle();
  if (data) {
    activeAttendanceId = data.AttendanceID;
    updateShiftBadge(data.CheckIn, true);
  } else {
    activeAttendanceId = null;
    updateShiftBadge(null, false);
  }
}

function updateOfflineBadge() {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  const el = document.getElementById('statOffline');
  if (el) el.textContent = pending.length;
}

window.syncOfflineOrders = async function () {
  const pending = JSON.parse(localStorage.getItem('offline_orders') || '[]');
  if (!pending.length) { showToast('No offline orders', ''); return; }
  if (!navigator.onLine) { showToast('Still offline!', 'error'); return; }
  let synced = 0;
  for (const o of pending) {
    const { data: row, error } = await sb.from('Order').insert([{
      EmployeeID: o.EmployeeID, OrderDateTime: o.saved_at, OrderType: o.OrderType,
      PaymentMethod: o.PaymentMethod, TotalAmount: o.TotalAmount, Status: 'Completed',
      Notes: o.Notes, DiscountCode: o.DiscountCode, DiscountAmount: o.DiscountAmount,
      GCashFee: o.GCashFee || null
    }]).select().single();
    if (!error && row) {
      await sb.from('OrderDetails').insert(o.items.map(function (i) { return {
        OrderID: row.OrderID, ProductID: i.id, SizeLabel: i.size || null,
        Quantity: i.quantity, Price: i.price, Subtotal: i.price * i.quantity
      }; }));
      for (const i of o.items) {
        const { data: ingData } = await sb.from('Ingredients').select('ItemID,UnitPerServing').eq('ProductID', i.id);
        if (ingData?.length) {
          for (const ing of ingData) {
            const { data: itemRow } = await sb.from('Item').select('UnitQuantity').eq('ItemID', ing.ItemID).single();
            const curr = parseFloat(itemRow?.UnitQuantity ?? 0) || 0;
            const deduct = (parseFloat(ing.UnitPerServing) || 0) * i.quantity;
            await sb.from('Item').update({ UnitQuantity: Math.max(0, curr - deduct) }).eq('ItemID', ing.ItemID);
            await sb.from('IngredientLog').insert([{ ItemID: ing.ItemID, OrderID: row.OrderID, ChangeAmt: -deduct, Reason: 'Order' }]);
          }
        }
      }
      synced++;
    }
  }
  if (synced) {
    localStorage.setItem('offline_orders', JSON.stringify(pending.slice(synced)));
    showToast('Synced ' + synced + ' order(s)!', 'success');
    updateOfflineBadge();
  }
};

async function refundOrderIngredients(orderId) {
  const { data: details } = await sb.from('OrderDetails').select('ProductID,Quantity').eq('OrderID', orderId);
  if (!details?.length) return;
  for (const d of details) {
    const { data: ings } = await sb.from('Ingredients').select('ItemID,UnitPerServing').eq('ProductID', d.ProductID);
    if (!ings?.length) continue;
    for (const ing of ings) {
      const { data: itemRow } = await sb.from('Item').select('UnitQuantity').eq('ItemID', ing.ItemID).single();
      const curr = parseFloat(itemRow?.UnitQuantity ?? 0) || 0;
      const addBack = (parseFloat(ing.UnitPerServing) || 0) * d.Quantity;
      await sb.from('Item').update({ UnitQuantity: curr + addBack }).eq('ItemID', ing.ItemID);
      await sb.from('IngredientLog').insert([{ ItemID: ing.ItemID, OrderID: orderId, ChangeAmt: addBack, Reason: 'Refund' }]);
    }
  }
}

document.getElementById('loginPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });