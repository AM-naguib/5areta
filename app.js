const STORAGE_KEY = '5areta-shop-v1';

const defaultState = {
  version: 2,
  settings: { openingVault: 0, lowStockThreshold: 3 },
  days: [
    {
      id: 'seed-2026-09-01',
      date: '2026-09-01',
      customers: 9,
      revenue: 1040,
      operating: 960,
      worker: 0,
      personal: 180,
      notes: 'بيانات 1/9 التي تم تسجيلها'
    }
  ],
  withdrawals: [],
  products: [],
  inventoryMovements: []
};

let state = loadState();
let deferredInstallPrompt = null;

const $ = (id) => document.getElementById(id);
const num = (value) => Number(value || 0);
const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const money = new Intl.NumberFormat('ar-EG', {
  style: 'currency',
  currency: 'EGP',
  maximumFractionDigits: 0
});

const numberFmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      version: 2,
      settings: {
        openingVault: num(parsed?.settings?.openingVault),
        lowStockThreshold: 3
      },
      days: Array.isArray(parsed.days) ? parsed.days : [],
      withdrawals: Array.isArray(parsed.withdrawals) ? parsed.withdrawals : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      inventoryMovements: Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements : []
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  if (window.__5ARETA_CLOUD_ACTIVE__ && typeof window.cloudSaveState === 'function') {
    window.cloudSaveState(state);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function dayMetrics(day) {
  const profit = round(num(day.revenue) - num(day.operating) - num(day.worker));
  const netToVault = round(profit - num(day.personal));
  return { profit, netToVault };
}

function currentVaultBalance() {
  const dayNet = state.days.reduce((sum, day) => sum + dayMetrics(day).netToVault, 0);
  const withdrawals = state.withdrawals.reduce((sum, item) => sum + num(item.amount), 0);
  return round(num(state.settings.openingVault) + dayNet - withdrawals);
}

function monthKeyFromDate(date) {
  return String(date || '').slice(0, 7);
}

function selectedMonth() {
  return $('monthFilter').value || '2026-09';
}

function monthlyData(month = selectedMonth()) {
  const days = state.days.filter((day) => monthKeyFromDate(day.date) === month);
  const withdrawals = state.withdrawals.filter((item) => monthKeyFromDate(item.date) === month);
  const totals = days.reduce((acc, day) => {
    const { profit, netToVault } = dayMetrics(day);
    acc.customers += num(day.customers);
    acc.revenue += num(day.revenue);
    acc.operating += num(day.operating);
    acc.worker += num(day.worker);
    acc.personal += num(day.personal);
    acc.profit += profit;
    acc.netToVault += netToVault;
    return acc;
  }, { customers:0, revenue:0, operating:0, worker:0, personal:0, profit:0, netToVault:0 });
  totals.withdrawals = withdrawals.reduce((sum, item) => sum + num(item.amount), 0);
  totals.avg = totals.customers ? totals.revenue / totals.customers : 0;
  return { days, withdrawals, totals };
}

function monthLabel(month) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1, 1);
  return new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(date);
}

function formatDate(date) {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  return new Intl.DateTimeFormat('ar-EG', { weekday:'short', day:'numeric', month:'short', year:'numeric' }).format(d);
}

function setSignedClass(el, value) {
  if (!el) return;
  el.classList.remove('positive', 'negative');
  if (value > 0) el.classList.add('positive');
  if (value < 0) el.classList.add('negative');
}

function renderDashboard() {
  const { totals } = monthlyData();
  $('monthTitle').textContent = monthLabel(selectedMonth());
  $('statProfit').textContent = money.format(totals.profit);
  $('statRevenue').textContent = money.format(totals.revenue);
  $('statCustomers').textContent = `${numberFmt.format(totals.customers)} زبون`;
  $('statVault').textContent = money.format(currentVaultBalance());
  $('statAvg').textContent = money.format(totals.avg);
  $('breakOperating').textContent = money.format(totals.operating);
  $('breakWorker').textContent = money.format(totals.worker);
  $('breakPersonal').textContent = money.format(totals.personal);
  $('breakVaultWithdrawals').textContent = money.format(totals.withdrawals);
  $('breakNet').textContent = money.format(totals.netToVault);
  setSignedClass($('statProfit'), totals.profit);
  setSignedClass($('breakNet'), totals.netToVault);
}

function renderRecords() {
  const list = $('recordsList');
  const days = [...state.days].sort((a,b) => b.date.localeCompare(a.date));
  if (!days.length) {
    list.innerHTML = `<div class="empty-state"><strong>لسه مفيش أيام مسجلة</strong><span>ابدأ من الرئيسية وسجّل أول يوم.</span></div>`;
    return;
  }
  list.innerHTML = days.map((day) => {
    const { profit, netToVault } = dayMetrics(day);
    const consumption = num(window.inventoryConsumptionForDate?.(day.date));
    const afterProducts = round(profit - consumption);
    return `
      <article class="record-card">
        <div class="record-top">
          <div class="record-date"><strong>${escapeHtml(formatDate(day.date))}</strong><span>${numberFmt.format(num(day.customers))} زبون</span></div>
          <div class="record-profit"><strong class="${profit < 0 ? 'negative' : 'positive'}">${money.format(profit)}</strong><span>ربح قبل المنتجات</span></div>
        </div>
        <div class="record-grid">
          <div><span>الإيراد</span><strong>${money.format(num(day.revenue))}</strong></div>
          <div><span>التشغيل</span><strong>${money.format(num(day.operating))}</strong></div>
          <div><span>الصنايعي</span><strong>${money.format(num(day.worker))}</strong></div>
          <div><span>استهلاك منتجات</span><strong>${money.format(consumption)}</strong></div>
          <div><span>بعد المنتجات</span><strong class="${afterProducts < 0 ? 'negative' : 'positive'}">${money.format(afterProducts)}</strong></div>
          <div><span>شخصي</span><strong>${money.format(num(day.personal))}</strong></div>
          <div><span>للخزنة</span><strong class="${netToVault < 0 ? 'negative' : 'positive'}">${money.format(netToVault)}</strong></div>
        </div>
        <div class="record-footer">
          <span class="record-notes">${escapeHtml(day.notes || 'بدون ملاحظات')}</span>
          <div class="record-actions">
            <button class="mini-btn" data-edit-day="${day.id}">تعديل</button>
            <button class="mini-btn danger-text" data-delete-day="${day.id}">حذف</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function renderVault() {
  const balance = currentVaultBalance();
  $('vaultHeaderBalance').textContent = money.format(balance);
  $('openingBalance').value = state.settings.openingVault || '';
  setSignedClass($('vaultHeaderBalance'), balance);

  const list = $('withdrawalsList');
  const items = [...state.withdrawals].sort((a,b) => b.date.localeCompare(a.date));
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><strong>مفيش سحوبات من الخزنة</strong><span>السحب الشخصي من دخل اليوم مكانه في التسجيل اليومي.</span></div>`;
    return;
  }
  list.innerHTML = items.map(item => `
    <article class="record-card">
      <div class="record-top">
        <div class="record-date"><strong>${escapeHtml(item.reason)}</strong><span>${escapeHtml(formatDate(item.date))}</span></div>
        <div class="record-profit"><strong class="negative">-${money.format(num(item.amount))}</strong><span>سحب من الخزنة</span></div>
      </div>
      <div class="record-footer">
        <span class="record-notes">${escapeHtml(item.notes || 'بدون ملاحظات')}</span>
        <div class="record-actions">
          <button class="mini-btn" data-edit-withdrawal="${item.id}">تعديل</button>
          <button class="mini-btn danger-text" data-delete-withdrawal="${item.id}">حذف</button>
        </div>
      </div>
    </article>`).join('');
}

function renderAll() {
  renderDashboard();
  renderRecords();
  renderVault();
  window.renderInventory?.();
  window.renderInventoryDashboard?.();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
  }[char]));
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function confirmAction(title, text) {
  return new Promise((resolve) => {
    const sheet = $('confirmSheet');
    $('confirmTitle').textContent = title;
    $('confirmText').textContent = text;
    sheet.hidden = false;
    const handler = (event) => {
      const action = event.target.closest('[data-confirm]')?.dataset.confirm;
      if (!action) return;
      sheet.removeEventListener('click', handler);
      sheet.hidden = true;
      resolve(action === 'ok');
    };
    sheet.addEventListener('click', handler);
  });
}

function resetDayForm() {
  $('dayForm').reset();
  $('editingDayId').value = '';
  $('dayDate').value = isoToday();
  $('cancelEditBtn').hidden = true;
  $('saveDayBtn').textContent = 'حفظ اليوم';
  updateLiveCalc();
}

function updateLiveCalc() {
  const profit = num($('revenue').value) - num($('operating').value) - num($('worker').value);
  const net = profit - num($('personal').value);
  $('liveProfit').textContent = money.format(profit);
  $('liveNet').textContent = money.format(net);
  setSignedClass($('liveProfit'), profit);
  setSignedClass($('liveNet'), net);
}

function isoToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0,10);
}

function switchView(name) {
  document.querySelectorAll('.view').forEach(view => view.classList.toggle('active', view.dataset.view === name));
  document.querySelectorAll('.nav-item').forEach(btn => btn.classList.toggle('active', btn.dataset.target === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('dayForm').addEventListener('input', updateLiveCalc);
$('dayForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const payload = {
    id: $('editingDayId').value || uid(),
    date: $('dayDate').value,
    customers: num($('customers').value),
    revenue: num($('revenue').value),
    operating: num($('operating').value),
    worker: num($('worker').value),
    personal: num($('personal').value),
    notes: $('dayNotes').value.trim()
  };
  if (!payload.date) return showToast('اختار التاريخ');
  if ([payload.customers, payload.revenue, payload.operating, payload.worker, payload.personal].some(v => v < 0)) return showToast('الأرقام لازم تكون صفر أو أكبر');

  const existingIndex = state.days.findIndex(day => day.id === payload.id);
  if (existingIndex >= 0) state.days[existingIndex] = payload;
  else state.days.push(payload);

  saveState();
  $('monthFilter').value = monthKeyFromDate(payload.date);
  resetDayForm();
  renderAll();
  showToast(existingIndex >= 0 ? 'تم تعديل اليوم' : 'تم حفظ اليوم');
});

$('cancelEditBtn').addEventListener('click', resetDayForm);
$('monthFilter').addEventListener('change', renderAll);

document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.target)));

document.addEventListener('click', async (event) => {
  const editDay = event.target.closest('[data-edit-day]')?.dataset.editDay;
  const deleteDay = event.target.closest('[data-delete-day]')?.dataset.deleteDay;
  const editWithdrawal = event.target.closest('[data-edit-withdrawal]')?.dataset.editWithdrawal;
  const deleteWithdrawal = event.target.closest('[data-delete-withdrawal]')?.dataset.deleteWithdrawal;

  if (editDay) {
    const day = state.days.find(item => item.id === editDay);
    if (!day) return;
    $('editingDayId').value = day.id;
    $('dayDate').value = day.date;
    $('customers').value = day.customers || '';
    $('revenue').value = day.revenue || '';
    $('operating').value = day.operating || '';
    $('worker').value = day.worker || '';
    $('personal').value = day.personal || '';
    $('dayNotes').value = day.notes || '';
    $('cancelEditBtn').hidden = false;
    $('saveDayBtn').textContent = 'حفظ التعديل';
    updateLiveCalc();
    switchView('dashboard');
    document.querySelector('.quick-entry').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  if (deleteDay) {
    const ok = await confirmAction('حذف اليوم؟', 'هيتم حذف بيانات اليوم من الحسابات ورصيد الخزنة. حركات المنتجات المسجلة في نفس التاريخ هتفضل موجودة.');
    if (!ok) return;
    state.days = state.days.filter(item => item.id !== deleteDay);
    saveState(); renderAll(); showToast('تم حذف اليوم');
  }

  if (editWithdrawal) {
    const item = state.withdrawals.find(row => row.id === editWithdrawal);
    if (!item) return;
    $('editingWithdrawalId').value = item.id;
    $('withdrawalDate').value = item.date;
    $('withdrawalAmount').value = item.amount;
    $('withdrawalReason').value = item.reason;
    $('withdrawalNotes').value = item.notes || '';
    $('cancelWithdrawalEditBtn').hidden = false;
    switchView('vault');
  }

  if (deleteWithdrawal) {
    const ok = await confirmAction('حذف حركة الخزنة؟', 'الرصيد الحالي هيتحدث تلقائيًا بعد الحذف.');
    if (!ok) return;
    state.withdrawals = state.withdrawals.filter(item => item.id !== deleteWithdrawal);
    saveState(); renderAll(); showToast('تم حذف السحب');
  }
});

$('openingBalanceForm').addEventListener('submit', (event) => {
  event.preventDefault();
  state.settings.openingVault = num($('openingBalance').value);
  saveState(); renderAll(); showToast('تم حفظ الرصيد الافتتاحي');
});

function resetWithdrawalForm() {
  $('withdrawalForm').reset();
  $('editingWithdrawalId').value = '';
  $('withdrawalDate').value = isoToday();
  $('cancelWithdrawalEditBtn').hidden = true;
}

$('withdrawalForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const payload = {
    id: $('editingWithdrawalId').value || uid(),
    date: $('withdrawalDate').value,
    amount: num($('withdrawalAmount').value),
    reason: $('withdrawalReason').value,
    notes: $('withdrawalNotes').value.trim()
  };
  if (!payload.date || payload.amount <= 0) return showToast('اكتب تاريخ ومبلغ صحيح');
  const existingIndex = state.withdrawals.findIndex(item => item.id === payload.id);
  if (existingIndex >= 0) state.withdrawals[existingIndex] = payload;
  else state.withdrawals.push(payload);
  saveState(); resetWithdrawalForm(); renderAll(); showToast(existingIndex >= 0 ? 'تم تعديل السحب' : 'تم تسجيل السحب');
});
$('cancelWithdrawalEditBtn').addEventListener('click', resetWithdrawalForm);

$('exportBackupBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
  downloadBlob(blob, `5areta-backup-${isoToday()}.json`);
  showToast('تم تجهيز النسخة الاحتياطية');
});

$('importBackupInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.days) || !Array.isArray(parsed.withdrawals)) throw new Error('invalid');
    const ok = await confirmAction('استيراد النسخة؟', 'البيانات الموجودة حاليًا هتستبدل ببيانات ملف الـ Backup.');
    if (!ok) return;
    state = {
      version: 2,
      settings: {
        openingVault: num(parsed?.settings?.openingVault),
        lowStockThreshold: 3
      },
      days: parsed.days,
      withdrawals: parsed.withdrawals,
      products: Array.isArray(parsed.products) ? parsed.products : [],
      inventoryMovements: Array.isArray(parsed.inventoryMovements) ? parsed.inventoryMovements : []
    };
    saveState(); renderAll(); resetDayForm(); resetWithdrawalForm(); showToast('تم استيراد البيانات');
  } catch {
    showToast('ملف الـ Backup غير صالح');
  } finally {
    event.target.value = '';
  }
});

$('exportCsvBtn').addEventListener('click', () => {
  const header = ['التاريخ','عدد الزباين','الإيراد','تشغيل المحل','الصنايعي','ربح قبل المنتجات','استهلاك منتجات','ربح بعد المنتجات','سحب شخصي من دخل اليوم','صافي الداخل للخزنة','ملاحظات'];
  const rows = [...state.days].sort((a,b) => a.date.localeCompare(b.date)).map(day => {
    const { profit, netToVault } = dayMetrics(day);
    const consumption = num(window.inventoryConsumptionForDate?.(day.date));
    return [day.date, day.customers, day.revenue, day.operating, day.worker, profit, consumption, round(profit - consumption), day.personal, netToVault, day.notes || ''];
  });
  const csv = '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
  downloadBlob(new Blob([csv], {type:'text/csv;charset=utf-8'}), `5areta-days-${isoToday()}.csv`);
});

function csvCell(value) {
  const text = String(value ?? '').replaceAll('"', '""');
  return `"${text}"`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

$('resetDataBtn').addEventListener('click', async () => {
  const ok = await confirmAction('مسح كل البيانات؟', 'الإجراء ده هيمسح الأيام والخزنة والمنتجات وحركات المخزن من الجهاز. نزّل Backup الأول لو محتاجها.');
  if (!ok) return;
  state = {
    version:2,
    settings:{openingVault:0, lowStockThreshold:3},
    days:[],
    withdrawals:[],
    products:[],
    inventoryMovements:[]
  };
  saveState(); renderAll(); resetDayForm(); resetWithdrawalForm(); showToast('تم مسح البيانات');
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  $('installBtn').hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}

$('dayDate').value = isoToday();
$('withdrawalDate').value = isoToday();
$('monthFilter').value = monthKeyFromDate(isoToday());
renderAll();
updateLiveCalc();