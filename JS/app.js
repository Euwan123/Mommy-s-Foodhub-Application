let pendingPollTimer = null;

window.doLogin = async function () {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  err.textContent = '';
  if (!u || !p) { err.textContent = 'Enter username and password.'; return; }
  const { data: emp, error } = await sb.from('Employee').select('*').eq('Username', u).eq('Password', p).single();
  if (error || !emp) { err.textContent = 'Invalid username or password.'; return; }
  const admin = emp.AccessLevel === 'Admin' || emp.AccessLevel === 'Manager';
  if (admin) {
    currentUser = emp;
    document.getElementById('loginScreen').style.opacity = '0';
    setTimeout(() => { document.getElementById('loginScreen').style.display = 'none'; showWelcome(emp); }, 300);
    return;
  }
  const { data: attRow, error: attErr } = await sb.from('Attendance').insert([{ EmployeeID: emp.EmployeeID, Status: 'Pending' }]).select().single();
  if (attErr || !attRow) { err.textContent = 'Could not request entry. Try again.'; return; }
  sessionStorage.setItem('pendingEmp', JSON.stringify(emp));
  sessionStorage.setItem('pendingAttId', String(attRow.AttendanceID));
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('waitingApprovalScreen').style.display = 'flex';
  startPendingApprovalPoll();
};

function startPendingApprovalPoll() {
  const poll = async () => {
    const attId = sessionStorage.getItem('pendingAttId');
    const empStr = sessionStorage.getItem('pendingEmp');
    if (!attId || !empStr) return;
    const { data: att } = await sb.from('Attendance').select('Status,CheckOut').eq('AttendanceID', attId).single();
    if (!att) { pendingPollTimer = setTimeout(poll, 2500); return; }
    if (att.Status === 'Approved' && !att.CheckOut) {
      sessionStorage.removeItem('pendingAttId');
      sessionStorage.removeItem('pendingEmp');
      const emp = JSON.parse(empStr);
      currentUser = emp;
      activeAttendanceId = parseInt(attId, 10);
      document.getElementById('waitingApprovalScreen').style.display = 'none';
      launchApp(emp);
      return;
    }
    if (att.CheckOut || att.Status === 'Rejected') {
      sessionStorage.removeItem('pendingAttId');
      sessionStorage.removeItem('pendingEmp');
      document.getElementById('waitingApprovalScreen').style.display = 'none';
      const ls = document.getElementById('loginScreen');
      ls.style.display = 'flex';
      setTimeout(() => { ls.style.opacity = '1'; }, 10);
      document.getElementById('loginError').textContent = att.Status === 'Rejected' ? 'Request rejected.' : 'You were checked out. Please log in again.';
      return;
    }
    pendingPollTimer = setTimeout(poll, 2500);
  };
  pendingPollTimer = setTimeout(poll, 2500);
}

function showWelcome(user) {
  const ws = document.getElementById('welcomeScreen');
  document.getElementById('welcomeName').textContent = 'Hey, ' + user.Name + '!';
  document.getElementById('welcomeRole').textContent = user.AccessLevel;
  ws.style.display = 'flex';
  setTimeout(() => ws.classList.add('show'), 10);
  setTimeout(() => {
    ws.classList.remove('show');
    setTimeout(() => { ws.style.display = 'none'; launchApp(user); }, 500);
  }, 2200);
}

async function launchApp(user) {
  document.getElementById('userName').textContent = user.Name;
  document.getElementById('userAvatar').textContent = user.Name.charAt(0).toUpperCase();
  const rt = document.getElementById('roleTag');
  rt.textContent = user.AccessLevel;
  rt.className = 'user-role ' + (isAdmin() ? 'admin' : 'cashier');
  document.getElementById('app').style.display = 'flex';
  applyTheme();
  buildTopbarNav();
  if (isAdmin() && !activeAttendanceId) {
    const { data: att } = await sb.from('Attendance').insert([{ EmployeeID: user.EmployeeID, Status: 'Approved' }]).select().single();
    if (att) { activeAttendanceId = att.AttendanceID; updateShiftBadge(att.CheckIn, true); }
  } else {
    await checkOpenAttendance();
  }
  await initPOS();
  document.querySelectorAll('#posView .tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-cashier')?.classList.add('active');
  document.getElementById('posView').classList.add('active');
  document.getElementById('adminView').classList.remove('active');
  document.getElementById('posBottomNav').style.display = '';
  document.getElementById('adminBottomNav').style.display = 'none';
  highlightNav('navCashier');
  if (!isAdmin()) startEmployeeCheckoutPoll();
}

function buildTopbarNav() {
  const nav = document.getElementById('topbarNav');
  nav.innerHTML = `
    <button class="nav-btn active" id="navCashier" onclick="goToCashier(this)">🧾 Cashier</button>
    <button class="nav-btn" id="navKitchen" onclick="goToKitchen(this)">🍳 Kitchen Board</button>
    <button class="nav-btn" id="navIngredients" onclick="openSectionView('inventory',this)">📦 Ingredients</button>
    <button class="nav-btn" id="navPromosMain" onclick="openSectionView('promos',this)">🏷 Promos</button>
    <button class="nav-btn" id="navSettingsMain" onclick="openSectionView('settings',this)">⚙️ Settings</button>
    <button class="nav-btn" id="navAdminPanel" onclick="openAdminPanel(this)">🛠 Admin Panel</button>
  `;
}

function highlightNav(id) {
  document.querySelectorAll('#topbarNav .nav-btn').forEach(b => b.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

window.goToCashier = function (btn) {
  adminPanelMode = false;
  switchToPOS();
  highlightNav('navCashier');
  showTab('cashier', null);
};

window.goToKitchen = function (btn) {
  adminPanelMode = false;
  switchToPOS();
  highlightNav('navKitchen');
  showTab('kitchen', null);
};

window.switchToPOS = function () {
  currentViewMode = 'pos';
  document.getElementById('posView').classList.add('active');
  document.getElementById('adminView').classList.remove('active');
  document.getElementById('posBottomNav').style.display = '';
  document.getElementById('adminBottomNav').style.display = 'none';
};

window.switchToAdmin = function () {
  currentViewMode = 'admin';
  document.getElementById('posView').classList.remove('active');
  document.getElementById('adminView').classList.add('active');
  document.getElementById('posBottomNav').style.display = 'none';
  document.getElementById('adminBottomNav').style.display = '';
  loadAdminData();
  const tabs = document.getElementById('adminTabs');
  if (tabs) tabs.style.display = adminPanelMode ? '' : 'none';
};

window.openAdminPanel = function (btn) {
  if (!isAdmin() && !adminOverride) {
    const code = prompt('Enter admin code:');
    if (code !== 'admin123') { showToast('Incorrect admin code', 'error'); return; }
    adminOverride = true;
  }
  adminPanelMode = true;
  highlightNav('navAdminPanel');
  switchToAdmin();
  showAdminTab('reports', null);
  const tabs = document.getElementById('adminTabs');
  if (tabs) tabs.style.display = '';
  loadReports();
};

window.openSectionView = function (section, btn) {
  adminPanelMode = false;
  switchToAdmin();
  const tabs = document.getElementById('adminTabs');
  if (tabs) tabs.style.display = 'none';
  document.querySelectorAll('#adminView .page').forEach(p => p.style.display = 'none');
  if (btn) highlightNav(btn.id);
  const tab = document.getElementById('atab-' + section);
  if (!tab) return;
  tab.style.display = 'block';
  if (section === 'inventory') loadInventory();
  if (section === 'promos') { loadAdminPromos().then(renderPromosTable); }
  if (section === 'settings') { loadSettingsForm(); applyTheme(); }
};

let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('installBtn');
  const st = document.getElementById('installStatus');
  if (btn) btn.style.display = 'block';
  if (st) st.style.display = 'none';
});

window.installApp = function () {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = 'none';
  });
};

window.addEventListener('appinstalled', () => {
  const btn = document.getElementById('installBtn');
  const st = document.getElementById('installStatus');
  if (btn) btn.style.display = 'none';
  if (st) { st.style.display = 'block'; st.textContent = '✅ Installed!'; }
});

window.addEventListener('online', () => {
  document.getElementById('offlineBanner').classList.remove('show');
  syncOfflineOrders();
});
window.addEventListener('offline', () => { document.getElementById('offlineBanner').classList.add('show'); });
if (!navigator.onLine) document.getElementById('offlineBanner').classList.add('show');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'));
}