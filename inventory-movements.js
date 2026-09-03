(() => {
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (!nativeValue?.get || !nativeValue?.set) return;

  function latinDigits(value) {
    return String(value ?? '')
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .trim();
  }

  function validIso(year, month, day) {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return '';
    const check = new Date(Date.UTC(y, m - 1, d));
    if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return '';
    return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function toIso(value) {
    const text = latinDigits(value);
    if (!text) return '';
    let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
    if (match) return validIso(match[1], match[2], match[3]);
    match = /^(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{4})$/.exec(text);
    if (match) return validIso(match[3], match[2], match[1]);
    match = /^(\d{2})(\d{2})(\d{4})$/.exec(text);
    if (match) return validIso(match[3], match[2], match[1]);
    return '';
  }

  function toDisplay(value) {
    const iso = toIso(value);
    if (!iso) return '';
    const [year, month, day] = iso.split('-');
    return `${day}/${month}/${year}`;
  }

  function enhanceDateInput(input) {
    if (!(input instanceof HTMLInputElement) || input.dataset.dmyDate === '1' || input.type !== 'date') return;
    const initialValue = nativeValue.get.call(input);
    const initialDefault = input.defaultValue;
    input.type = 'text';
    input.dataset.dmyDate = '1';
    input.inputMode = 'numeric';
    input.placeholder = 'DD/MM/YYYY';
    input.autocomplete = 'off';
    input.dir = 'ltr';
    input.style.textAlign = 'left';
    Object.defineProperty(input, 'value', {
      configurable: true,
      enumerable: true,
      get() { return toIso(nativeValue.get.call(this)); },
      set(value) { nativeValue.set.call(this, toDisplay(value) || latinDigits(value)); }
    });
    nativeValue.set.call(input, toDisplay(initialValue) || latinDigits(initialValue));
    if (initialDefault) input.defaultValue = toDisplay(initialDefault) || latinDigits(initialDefault);
    const normalize = () => {
      const formatted = toDisplay(nativeValue.get.call(input));
      if (formatted) nativeValue.set.call(input, formatted);
    };
    input.addEventListener('blur', normalize);
    input.addEventListener('change', normalize);
  }

  function enhanceDateInputs(root = document) {
    if (root instanceof HTMLInputElement) enhanceDateInput(root);
    root.querySelectorAll?.('input[type="date"]').forEach(enhanceDateInput);
  }

  window.dateToIso = toIso;
  window.formatDateNumeric = toDisplay;
  window.enhanceDateInputs = enhanceDateInputs;
  const previousFormatDate = window.formatDate;
  window.formatDate = (value) => toDisplay(value) || (typeof previousFormatDate === 'function' ? previousFormatDate(value) : String(value || ''));
  const previousDownloadBlob = window.downloadBlob;
  if (typeof previousDownloadBlob === 'function') {
    window.downloadBlob = (blob, filename) => {
      if (!(blob instanceof Blob) || !String(blob.type || '').includes('text/csv')) return previousDownloadBlob(blob, filename);
      blob.text()
        .then((text) => text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3/$2/$1'))
        .then((text) => previousDownloadBlob(new Blob([text], { type: blob.type }), filename))
        .catch(() => previousDownloadBlob(blob, filename));
    };
  }
  enhanceDateInputs(document);
  const observer = new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) enhanceDateInputs(node);
  })));
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();

(() => {
  const FLAG_CACHE_KEY = '5areta-inventory-flags-v1';
  const FLAG_PENDING_KEY = '5areta-inventory-flags-pending-v1';
  let activeRange = '7';
  let inventoryScope = 'active';
  let searchText = '';
  let cloudFlagsLoaded = false;
  let flushingFlags = false;
  const cancelingIds = new Set();

  function readJson(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : structuredClone(fallback);
    } catch { return structuredClone(fallback); }
  }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
  function nowIso() { return new Date().toISOString(); }
  function localIso(date = new Date()) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  }
  function dateDaysBack(days) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - Math.max(0, days - 1));
    return localIso(date);
  }
  function canceledDateLabel(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  const flagState = readJson(FLAG_CACHE_KEY, { products: {}, movements: {} });
  flagState.products = flagState.products && typeof flagState.products === 'object' ? flagState.products : {};
  flagState.movements = flagState.movements && typeof flagState.movements === 'object' ? flagState.movements : {};

  function productById(productId) { return state.products.find((product) => product.id === productId); }
  function movementProduct(movement) { return productById(movement.productId); }
  function movementTypeShort(type) { return ({ purchase: 'شراء', sale: 'بيع', consumption: 'تشغيل' })[type] || 'حركة'; }
  function isCanceled(movement) { return movement?.canceled === true; }

  function bootstrapFlagsFromState() {
    (state.products || []).forEach((product) => {
      if (product.archived === true && !flagState.products[product.id]) flagState.products[product.id] = { archived: true, archivedAt: product.archivedAt || null };
    });
    (state.inventoryMovements || []).forEach((movement) => {
      if (movement.canceled === true && !flagState.movements[movement.id]) flagState.movements[movement.id] = { canceled: true, canceledAt: movement.canceledAt || null };
    });
    writeJson(FLAG_CACHE_KEY, flagState);
  }

  function applyFlagsToState() {
    bootstrapFlagsFromState();
    (state.products || []).forEach((product) => {
      const flag = flagState.products[product.id];
      product.archived = flag ? !!flag.archived : !!product.archived;
      product.archivedAt = flag?.archivedAt || product.archivedAt || null;
    });
    (state.inventoryMovements || []).forEach((movement) => {
      const flag = flagState.movements[movement.id];
      movement.canceled = flag ? !!flag.canceled : !!movement.canceled;
      movement.canceledAt = flag?.canceledAt || movement.canceledAt || null;
    });
  }

  function setProductFlag(productId, archived, archivedAt = null) {
    flagState.products[productId] = { archived: !!archived, archivedAt: archivedAt || null };
    writeJson(FLAG_CACHE_KEY, flagState);
  }
  function setMovementFlag(movementId, canceled, canceledAt = null) {
    flagState.movements[movementId] = { canceled: !!canceled, canceledAt: canceledAt || null };
    writeJson(FLAG_CACHE_KEY, flagState);
  }
  function queueProductFlag(productId, archived, archivedAt) {
    const pending = readJson(FLAG_PENDING_KEY, { products: {} });
    pending.products = pending.products || {};
    pending.products[productId] = { archived: !!archived, archivedAt: archivedAt || null };
    writeJson(FLAG_PENDING_KEY, pending);
  }

  async function flushProductFlags() {
    if (flushingFlags || !navigator.onLine || !window.__5ARETA_CLOUD_ACTIVE__ || !window.supabaseClient) return;
    const pending = readJson(FLAG_PENDING_KEY, { products: {} });
    const entries = Object.entries(pending.products || {});
    if (!entries.length) return;
    flushingFlags = true;
    try {
      for (const [productId, flag] of entries) {
        const { error } = await window.supabaseClient.from('products').update({ archived: !!flag.archived, archived_at: flag.archivedAt || null }).eq('id', productId);
        if (error) continue;
        delete pending.products[productId];
        writeJson(FLAG_PENDING_KEY, pending);
      }
    } catch (error) { console.warn('Inventory archive flag sync failed', error); }
    finally { flushingFlags = false; }
  }

  async function loadFlagsFromCloud() {
    if (cloudFlagsLoaded || !navigator.onLine || !window.__5ARETA_CLOUD_ACTIVE__ || !window.supabaseClient) return;
    try {
      const [productsRes, movementsRes] = await Promise.all([
        window.supabaseClient.from('products').select('id, archived, archived_at'),
        window.supabaseClient.from('inventory_movements').select('id, canceled, canceled_at')
      ]);
      if (productsRes.error || movementsRes.error) return;
      const pending = readJson(FLAG_PENDING_KEY, { products: {} });
      (productsRes.data || []).forEach((row) => {
        if (!pending.products?.[row.id]) flagState.products[row.id] = { archived: !!row.archived, archivedAt: row.archived_at || null };
      });
      (movementsRes.data || []).forEach((row) => {
        flagState.movements[row.id] = { canceled: !!row.canceled, canceledAt: row.canceled_at || null };
      });
      writeJson(FLAG_CACHE_KEY, flagState);
      cloudFlagsLoaded = true;
      applyFlagsToState();
      window.renderAll?.();
      flushProductFlags();
    } catch (error) { console.warn('Inventory flags load failed', error); }
  }

  function filteredMovements() {
    let from = '';
    let to = '';
    if (activeRange === '7') { from = dateDaysBack(7); to = localIso(); }
    else if (activeRange === '30') { from = dateDaysBack(30); to = localIso(); }
    else if (activeRange === 'custom') { from = $('movementFromDate')?.value || ''; to = $('movementToDate')?.value || ''; }
    return [...(state.inventoryMovements || [])]
      .filter((movement) => (!from || String(movement.date || '') >= from) && (!to || String(movement.date || '') <= to))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function movementDetails(movement) {
    if (movement.type === 'purchase') return `<div><span>سعر شراء القطعة</span><strong>${money.format(num(movement.unitCost))}</strong></div><div><span>إجمالي الشراء</span><strong>${money.format(num(movement.totalCost))}</strong></div>`;
    if (movement.type === 'sale') return `<div><span>سعر بيع القطعة</span><strong>${money.format(num(movement.unitPrice))}</strong></div><div><span>إجمالي البيع</span><strong>${money.format(num(movement.revenue))}</strong></div><div><span>تكلفة المخزون</span><strong>${money.format(num(movement.totalCost))}</strong></div><div><span>ربح البيع</span><strong class="${num(movement.profit) < 0 ? 'negative' : 'positive'}">${money.format(num(movement.profit))}</strong></div>`;
    return `<div><span>تكلفة القطعة</span><strong>${money.format(num(movement.unitCost))}</strong></div><div><span>تكلفة المخزون</span><strong>${money.format(num(movement.totalCost))}</strong></div>`;
  }

  function movementCard(movement) {
    const name = movementProduct(movement)?.name || 'منتج غير موجود';
    const canceled = isCanceled(movement);
    const cancelLabel = canceledDateLabel(movement.canceledAt);
    return `<article class="im-card im-${movement.type} ${canceled ? 'im-canceled' : ''}" data-movement-id="${escapeHtml(movement.id)}">
      <div class="im-card-head"><div class="im-card-title"><span class="im-type">${movementTypeShort(movement.type)}</span>${canceled ? '<span class="im-canceled-badge">ملغية</span>' : ''}<strong>${escapeHtml(name)}</strong><small>${escapeHtml(window.formatDateNumeric?.(movement.date) || formatDate(movement.date))}</small></div><div class="im-qty ${movement.type === 'purchase' ? 'positive' : ''}">${movement.type === 'purchase' ? '+' : '−'}${numberFmt.format(num(movement.quantity))} قطعة</div></div>
      <div class="im-details">${movementDetails(movement)}</div>
      ${movement.type === 'consumption' ? '<p class="im-note">التشغيل هنا للمخزن فقط ومش بيأثر على سجل المحل أو ربحه.</p>' : ''}
      <div class="im-card-footer">${canceled ? `<span>تم إلغاء الحركة${cancelLabel ? ` بتاريخ ${cancelLabel}` : ''}، وتأثيرها مش داخل في إجماليات المنتجات.</span>` : `<button class="mini-btn danger-text" type="button" data-cancel-movement="${escapeHtml(movement.id)}">إلغاء الحركة</button>`}</div>
    </article>`;
  }

  function renderMovementSummary(movements) {
    const totals = movements.filter((movement) => !isCanceled(movement)).reduce((acc, movement) => {
      acc.count += 1;
      acc[movement.type] = (acc[movement.type] || 0) + num(movement.quantity);
      return acc;
    }, { count: 0, purchase: 0, sale: 0, consumption: 0 });
    $('movementTotalCount').textContent = numberFmt.format(totals.count);
    $('movementPurchaseQty').textContent = numberFmt.format(totals.purchase);
    $('movementSaleQty').textContent = numberFmt.format(totals.sale);
    $('movementConsumptionQty').textContent = numberFmt.format(totals.consumption);
  }

  window.renderInventoryMovements = () => {
    applyFlagsToState();
    const list = $('inventoryMovementsList');
    if (!list) return;
    const movements = filteredMovements();
    const canceledCount = movements.filter(isCanceled).length;
    renderMovementSummary(movements);
    $('movementResultCount').textContent = canceledCount ? `${numberFmt.format(movements.length)} حركة • ${numberFmt.format(canceledCount)} ملغية` : `${numberFmt.format(movements.length)} حركة`;
    list.innerHTML = movements.length ? movements.map(movementCard).join('') : '<div class="empty-state"><strong>مفيش حركات في الفترة دي</strong><span>غيّر الفترة أو سجّل شراء أو بيع أو تشغيل من صفحة المخزن.</span></div>';
  };

  function updateRangeUi() {
    document.querySelectorAll('[data-im-range]').forEach((button) => button.classList.toggle('active', button.dataset.imRange === activeRange));
    if ($('movementCustomRange')) $('movementCustomRange').hidden = activeRange !== 'custom';
    window.renderInventoryMovements();
  }
  function openMovements() {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === 'inventory-movements'));
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.target === 'inventory'));
    window.renderInventoryMovements();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function backToInventory() { switchView('inventory'); }

  function createMovementView() {
    if (document.querySelector('[data-view="inventory-movements"]')) return;
    const section = document.createElement('section');
    section.className = 'view inventory-movements-view';
    section.dataset.view = 'inventory-movements';
    section.innerHTML = `<div class="section-head"><div><p class="section-kicker">المخزن والمنتجات</p><h2>حركات المنتجات</h2></div><button class="btn ghost" type="button" id="backToInventoryBtn">رجوع للمخزن</button></div>
      <div class="im-filters" aria-label="فلترة حركات المنتجات حسب التاريخ"><button class="im-filter-chip active" type="button" data-im-range="7">آخر 7 أيام</button><button class="im-filter-chip" type="button" data-im-range="30">آخر 30 يوم</button><button class="im-filter-chip" type="button" data-im-range="all">كل الحركات</button><button class="im-filter-chip" type="button" data-im-range="custom">من تاريخ لتاريخ</button></div>
      <div class="im-custom-range" id="movementCustomRange" hidden><label>من تاريخ<input type="date" id="movementFromDate" /></label><label>إلى تاريخ<input type="date" id="movementToDate" /></label></div>
      <div class="im-summary"><article class="im-summary-card"><span>الحركات الفعلية</span><strong id="movementTotalCount">0</strong></article><article class="im-summary-card"><span>قطع مشتراة</span><strong id="movementPurchaseQty">0</strong></article><article class="im-summary-card"><span>قطع مباعة</span><strong id="movementSaleQty">0</strong></article><article class="im-summary-card"><span>قطع تشغيل</span><strong id="movementConsumptionQty">0</strong></article></div>
      <div class="im-list-head"><h3>الحركات</h3><span id="movementResultCount">0 حركة</span></div><div class="im-list" id="inventoryMovementsList"></div>`;
    const vaultView = document.querySelector('[data-view="vault"]');
    if (vaultView) vaultView.before(section); else document.querySelector('main')?.appendChild(section);
    window.enhanceDateInputs?.(section);
    $('movementFromDate').value = dateDaysBack(30);
    $('movementToDate').value = localIso();
  }

  function addInventoryHeaderButton() {
    const head = document.querySelector('[data-view="inventory"] .inventory-head');
    const addButton = $('addProductBtn');
    if (!head || !addButton || $('openInventoryMovementsBtn')) return;
    const actions = document.createElement('div');
    actions.className = 'inventory-head-actions';
    const movementsButton = document.createElement('button');
    movementsButton.className = 'btn ghost';
    movementsButton.type = 'button';
    movementsButton.id = 'openInventoryMovementsBtn';
    movementsButton.textContent = 'حركات المنتجات';
    addButton.before(actions);
    actions.append(movementsButton, addButton);
  }

  function injectInventoryToolbar() {
    const panel = document.querySelector('[data-view="inventory"] .inventory-panel');
    if (!panel || $('inventorySearchToolbar')) return;
    const toolbar = document.createElement('div');
    toolbar.id = 'inventorySearchToolbar';
    toolbar.className = 'inventory-search-toolbar';
    toolbar.innerHTML = `<div class="inventory-search-box"><span aria-hidden="true">⌕</span><input id="productSearchInput" type="search" autocomplete="off" placeholder="ابحث باسم المنتج" aria-label="بحث باسم المنتج" /></div><div class="inventory-scope-tabs"><button type="button" class="inventory-scope-btn active" data-product-scope="active">المخزن</button><button type="button" class="inventory-scope-btn" data-product-scope="archived">المؤرشف <b id="archivedProductsCount">0</b></button></div>`;
    panel.before(toolbar);
  }

  function activeSalesMetrics(productId = null) {
    return (state.inventoryMovements || []).filter((movement) => movement.type === 'sale' && !isCanceled(movement) && (!productId || movement.productId === productId)).reduce((acc, movement) => {
      acc.cash += num(movement.revenue); acc.profit += num(movement.profit); acc.quantity += num(movement.quantity); return acc;
    }, { cash: 0, profit: 0, quantity: 0 });
  }

  function decorateInventory() {
    applyFlagsToState();
    injectInventoryToolbar();
    const activeProducts = (state.products || []).filter((product) => !product.archived);
    const archivedProducts = (state.products || []).filter((product) => product.archived);
    const sales = activeSalesMetrics();
    if ($('inventoryProductsCount')) $('inventoryProductsCount').textContent = numberFmt.format(activeProducts.length);
    if ($('inventoryUnitsCount')) $('inventoryUnitsCount').textContent = numberFmt.format(activeProducts.reduce((sum, product) => sum + num(product.quantity), 0));
    if ($('inventorySalesCash')) $('inventorySalesCash').textContent = money.format(sales.cash);
    if ($('inventorySalesProfit')) { $('inventorySalesProfit').textContent = money.format(sales.profit); setSignedClass($('inventorySalesProfit'), sales.profit); }
    if ($('archivedProductsCount')) $('archivedProductsCount').textContent = numberFmt.format(archivedProducts.length);

    const low = activeProducts.filter((product) => product.quantity <= 3);
    const alert = $('lowStockAlert');
    if (alert) {
      if (low.length) {
        alert.hidden = false;
        const names = low.slice(0, 4).map((product) => escapeHtml(product.name)).join('، ');
        alert.innerHTML = `⚠️ <strong>${numberFmt.format(low.length)} منتج</strong> عنده 3 قطع أو أقل: ${names}${low.length > 4 ? ` + ${numberFmt.format(low.length - 4)} كمان` : ''}`;
      } else { alert.hidden = true; alert.textContent = ''; }
    }

    document.querySelectorAll('[data-product-scope]').forEach((button) => button.classList.toggle('active', button.dataset.productScope === inventoryScope));
    const grid = $('productsGrid');
    if (!grid) return;
    grid.querySelector('.inventory-filter-empty')?.remove();
    const query = searchText.trim().toLocaleLowerCase('ar');
    let visibleCount = 0;
    grid.querySelectorAll('.product-card').forEach((card) => {
      const product = productById(card.querySelector('[data-open-product]')?.dataset.openProduct);
      if (!product) return;
      const visible = (inventoryScope === 'archived' ? product.archived : !product.archived) && (!query || String(product.name || '').toLocaleLowerCase('ar').includes(query));
      card.hidden = !visible;
      if (!visible) return;
      visibleCount += 1;
      card.classList.toggle('product-card-archived', !!product.archived);
      const actions = card.querySelector('.product-actions');
      if (product.archived && actions) actions.innerHTML = `<button class="product-action-btn restock" type="button" data-restore-product="${escapeHtml(product.id)}">إرجاع للمخزن</button>`;
    });
    if (!visibleCount) {
      const empty = document.createElement('div');
      empty.className = 'empty-state inventory-filter-empty';
      empty.innerHTML = inventoryScope === 'archived' ? `<strong>${query ? 'مفيش منتج مؤرشف بالاسم ده' : 'مفيش منتجات مؤرشفة'}</strong><span>لما تأرشف منتج هيفضل تاريخه محفوظ وهتلاقيه هنا.</span>` : `<strong>${query ? 'مفيش منتج بالاسم ده' : 'المخزن فاضي لسه'}</strong><span>${query ? 'جرّب اسم تاني.' : 'اضغط «+ منتج جديد» وسجّل أول منتج.'}</span>`;
      grid.appendChild(empty);
    }
  }

  function sortedProductMovements(productId) {
    return (state.inventoryMovements || []).filter((movement) => movement.productId === productId).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function decorateProductSheet() {
    applyFlagsToState();
    const sheet = $('productSheet');
    const body = $('productSheetBody');
    if (!sheet || sheet.hidden || !body) return;
    const product = productById(body.querySelector('[data-product-id]')?.dataset.productId);
    if (!product) return;
    const detailsActions = body.querySelector('.detail-actions');
    if (detailsActions) {
      let archiveButton = body.querySelector('[data-archive-product], [data-restore-product]');
      if (!archiveButton) { archiveButton = document.createElement('button'); archiveButton.type = 'button'; detailsActions.appendChild(archiveButton); }
      archiveButton.className = product.archived ? 'btn secondary' : 'btn danger';
      archiveButton.textContent = product.archived ? 'إرجاع للمخزن' : 'أرشفة المنتج';
      if (product.archived) {
        archiveButton.dataset.restoreProduct = product.id; delete archiveButton.dataset.archiveProduct;
        detailsActions.querySelector('[data-product-action="restock"]')?.setAttribute('hidden', '');
      } else { archiveButton.dataset.archiveProduct = product.id; delete archiveButton.dataset.restoreProduct; }
      if (product.archived && !body.querySelector('.archived-product-note')) {
        const note = document.createElement('div'); note.className = 'inline-note archived-product-note'; note.textContent = 'المنتج مؤرشف: تاريخه وحركاته محفوظين، لكنه مخفي من قائمة المخزن الأساسية.'; detailsActions.before(note);
      }
    }
    const sales = activeSalesMetrics(product.id);
    body.querySelectorAll('.detail-stat').forEach((stat) => {
      const label = stat.querySelector('span')?.textContent?.trim(); const value = stat.querySelector('strong'); if (!value) return;
      if (label === 'كاش مبيعات المنتج') value.textContent = money.format(sales.cash);
      if (label === 'إجمالي ربح المنتج') { value.textContent = money.format(sales.profit); setSignedClass(value, sales.profit); }
      if (label === 'القطع المباعة') value.textContent = numberFmt.format(sales.quantity);
    });
    const movements = sortedProductMovements(product.id);
    body.querySelectorAll('.movement-list .movement-item').forEach((item, index) => {
      const movement = movements[index]; if (!movement) return;
      item.classList.toggle('movement-item-canceled', isCanceled(movement));
      item.querySelector('.movement-cancel-control')?.remove();
      const control = document.createElement('div'); control.className = 'movement-cancel-control';
      control.innerHTML = isCanceled(movement) ? '<span class="im-canceled-badge">ملغية</span>' : `<button class="mini-btn danger-text" type="button" data-cancel-movement="${escapeHtml(movement.id)}">إلغاء الحركة</button>`;
      item.appendChild(control);
    });
  }

  function closeProductSheet() {
    if ($('productSheet')) $('productSheet').hidden = true;
    if ($('productSheetBody')) $('productSheetBody').innerHTML = '';
    document.body.style.overflow = '';
  }

  async function setArchived(productId, archived) {
    const product = productById(productId); if (!product) return;
    if (archived) {
      const quantityNote = num(product.quantity) > 0 ? ` عندك ${numberFmt.format(product.quantity)} قطعة لسه مسجلة؛ العدد هيفضل محفوظ في المؤرشف.` : '';
      if (!await confirmAction('أرشفة المنتج؟', `المنتج هيختفي من قائمة المخزن الأساسية، لكن كل تاريخه وحركاته هيفضلوا محفوظين.${quantityNote}`)) return;
    }
    const archivedAt = archived ? nowIso() : null;
    product.archived = archived; product.archivedAt = archivedAt;
    setProductFlag(product.id, archived, archivedAt); queueProductFlag(product.id, archived, archivedAt);
    saveState(); closeProductSheet(); window.renderAll?.(); flushProductFlags();
    showToast(archived ? 'تمت أرشفة المنتج' : 'رجع المنتج للمخزن');
  }

  function cancellationMessage(movement, product) {
    const qty = numberFmt.format(num(movement.quantity));
    if (movement.type === 'purchase') return `هيتم خصم ${qty} قطعة من ${product?.name || 'المنتج'}، والحركة هتفضل موجودة ومكتوب عليها «ملغية». لو جزء من الكمية اتصرف بعد الشراء، الإلغاء هيتمنع لحماية المخزون.`;
    return `هيتم رجوع ${qty} قطعة للمخزون، والحركة هتفضل موجودة ومكتوب عليها «ملغية».`;
  }

  async function cancelMovement(movementId) {
    if (cancelingIds.has(movementId)) return;
    applyFlagsToState();
    const movement = (state.inventoryMovements || []).find((item) => item.id === movementId);
    if (!movement || isCanceled(movement)) return;
    const product = productById(movement.productId);
    if (!product) return showToast('المنتج المرتبط بالحركة مش موجود');
    if (!navigator.onLine || !window.__5ARETA_CLOUD_ACTIVE__ || !window.supabaseClient) return showToast('إلغاء الحركة محتاج إنترنت عشان يتصحح المخزون بأمان');
    if (!await confirmAction('إلغاء الحركة؟', cancellationMessage(movement, product))) return;
    cancelingIds.add(movementId);
    try {
      const { data, error } = await window.supabaseClient.rpc('cancel_inventory_movement', { p_movement_id: movementId });
      if (error || !data?.ok) {
        const message = String(error?.message || '');
        if (message.includes('purchase_quantity_already_used')) showToast('مينفعش تلغي الشراء لأن جزء من الكمية اتصرف. صحّح الحركات الأحدث الأول.');
        else if (message.includes('movement_not_found')) showToast('الحركة مش موجودة على السحابة');
        else { console.error('Cancel inventory movement failed', error); showToast('تعذر إلغاء الحركة دلوقتي'); }
        return;
      }
      movement.canceled = true; movement.canceledAt = data.canceled_at || nowIso();
      setMovementFlag(movement.id, true, movement.canceledAt);
      product.quantity = Math.max(0, Math.trunc(num(data.quantity)));
      product.currentCost = Math.max(0, num(data.current_cost));
      product.updatedAt = nowIso();
      saveState(); closeProductSheet(); window.renderAll?.(); showToast('تم إلغاء الحركة وتصحيح كمية المخزون');
    } catch (error) { console.error('Cancel inventory movement failed', error); showToast('تعذر إلغاء الحركة دلوقتي'); }
    finally { cancelingIds.delete(movementId); }
  }

  function injectStyles() {
    if ($('inventoryMovementsStyles')) return;
    const style = document.createElement('style'); style.id = 'inventoryMovementsStyles';
    style.textContent = `.inventory-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.inventory-movements-view .section-head{align-items:center}.im-filters{display:flex;gap:8px;overflow-x:auto;padding:2px 1px 10px;scrollbar-width:none}.im-filters::-webkit-scrollbar{display:none}.im-filter-chip{flex:0 0 auto;border:1px solid var(--line);background:var(--surface);color:var(--text);min-height:40px;padding:0 13px;border-radius:12px;font-weight:800;font-size:.76rem}.im-filter-chip.active{background:var(--brand);border-color:var(--brand);color:#fff}.im-custom-range[hidden]{display:none}.im-custom-range{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px;margin-bottom:12px}.im-custom-range label{display:flex;flex-direction:column;gap:6px;color:var(--muted);font-size:.72rem;font-weight:700}.im-custom-range input{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--text);padding:0 10px;outline:none}.im-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}.im-summary-card{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:11px;min-width:0}.im-summary-card span{display:block;color:var(--muted);font-size:.65rem;margin-bottom:5px}.im-summary-card strong{font-size:.95rem}.im-list-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 2px 9px}.im-list-head h3{margin:0;font-size:1rem}.im-list-head span{color:var(--muted);font-size:.75rem}.im-list{display:grid;gap:10px}.im-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:var(--shadow);border-right-width:4px}.im-card.im-purchase{border-right-color:#4f46e5}.im-card.im-sale{border-right-color:var(--success)}.im-card.im-consumption{border-right-color:#9ca3af}.im-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.im-card-title{display:grid;grid-template-columns:auto auto 1fr;align-items:center;gap:4px 7px;min-width:0}.im-card-title strong{font-size:.94rem;overflow-wrap:anywhere}.im-card-title small{grid-column:1/-1;color:var(--muted);font-size:.7rem}.im-type{display:inline-flex;width:max-content;border-radius:999px;padding:4px 7px;background:var(--brand-soft);font-size:.64rem;font-weight:900;color:var(--text)}.im-purchase .im-type{background:#eef2ff;color:#3730a3}.im-sale .im-type{background:var(--success-soft);color:var(--success)}.im-consumption .im-type{background:#f3f4f6;color:#4b5563}.im-qty{font-weight:900;white-space:nowrap;font-size:.9rem}.im-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}.im-details>div{background:var(--surface-2);border-radius:11px;padding:9px;min-width:0}.im-details span{display:block;color:var(--muted);font-size:.64rem;margin-bottom:3px}.im-details strong{display:block;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.im-note{margin:10px 0 0;padding:9px 10px;border-radius:10px;background:#f3f4f6;color:var(--muted);font-size:.7rem;line-height:1.55}.im-card-footer{display:flex;align-items:center;justify-content:flex-end;margin-top:11px}.im-card-footer>span{width:100%;color:var(--muted);font-size:.7rem;line-height:1.5}.im-canceled{opacity:.65;border-right-color:#9ca3af!important}.im-canceled .im-details,.im-canceled .im-qty{text-decoration:line-through}.im-canceled-badge{display:inline-flex;width:max-content;border-radius:999px;padding:4px 7px;background:#f3f4f6;color:#6b7280;font-size:.63rem;font-weight:900}.inventory-search-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;margin:0 0 12px}.inventory-search-box{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:0 12px}.inventory-search-box input{width:100%;min-height:46px;border:0;background:transparent;color:var(--text);font:inherit;outline:none}.inventory-search-box span{color:var(--muted);font-size:1.15rem}.inventory-scope-tabs{display:flex;background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:4px;gap:3px}.inventory-scope-btn{border:0;background:transparent;color:var(--muted);font:inherit;font-size:.74rem;font-weight:900;border-radius:11px;padding:0 11px;min-height:38px;white-space:nowrap}.inventory-scope-btn.active{background:var(--brand);color:#fff}.inventory-scope-btn b{font-size:.67rem}.product-card-archived{opacity:.78}.archived-product-note{margin:10px 0}.movement-item-canceled{opacity:.58}.movement-item-canceled .movement-info,.movement-item-canceled .movement-value{text-decoration:line-through}.movement-cancel-control{display:flex;align-items:center;justify-content:flex-end;margin-top:7px;grid-column:1/-1}@media(max-width:540px){.inventory-head{align-items:flex-start}.inventory-head-actions{display:grid;grid-template-columns:1fr 1fr;width:100%;grid-column:1/-1}.inventory-head{flex-wrap:wrap}.inventory-head-actions .btn{padding:0 10px}.im-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.inventory-search-toolbar{grid-template-columns:1fr}.inventory-scope-tabs{width:100%}.inventory-scope-btn{flex:1}}@media(max-width:380px){.im-custom-range{grid-template-columns:1fr}.im-details{grid-template-columns:1fr 1fr}}`;
    document.head.appendChild(style);
  }

  createMovementView(); addInventoryHeaderButton(); injectInventoryToolbar(); injectStyles(); applyFlagsToState();
  const baseRenderAll = window.renderAll;
  if (typeof baseRenderAll === 'function') window.renderAll = function (...args) {
    applyFlagsToState(); const result = baseRenderAll.apply(this, args); decorateInventory(); window.renderInventoryMovements?.(); queueMicrotask(decorateProductSheet); return result;
  };
  $('openInventoryMovementsBtn')?.addEventListener('click', openMovements);
  $('backToInventoryBtn')?.addEventListener('click', backToInventory);
  document.addEventListener('input', (event) => { if (event.target.id === 'productSearchInput') { searchText = event.target.value || ''; decorateInventory(); } });
  document.addEventListener('change', (event) => { if (event.target.id === 'movementFromDate' || event.target.id === 'movementToDate') window.renderInventoryMovements(); });
  document.addEventListener('click', async (event) => {
    const rangeButton = event.target.closest('[data-im-range]');
    if (rangeButton) { activeRange = rangeButton.dataset.imRange; if (activeRange === 'custom') { if (!$('movementFromDate').value) $('movementFromDate').value = dateDaysBack(30); if (!$('movementToDate').value) $('movementToDate').value = localIso(); } updateRangeUi(); return; }
    const scopeButton = event.target.closest('[data-product-scope]');
    if (scopeButton) { inventoryScope = scopeButton.dataset.productScope === 'archived' ? 'archived' : 'active'; decorateInventory(); return; }
    const cancelId = event.target.closest('[data-cancel-movement]')?.dataset.cancelMovement; if (cancelId) { await cancelMovement(cancelId); return; }
    const archiveId = event.target.closest('[data-archive-product]')?.dataset.archiveProduct; if (archiveId) { await setArchived(archiveId, true); return; }
    const restoreId = event.target.closest('[data-restore-product]')?.dataset.restoreProduct; if (restoreId) await setArchived(restoreId, false);
  });
  const sheetObserver = new MutationObserver(() => queueMicrotask(decorateProductSheet));
  if ($('productSheetBody')) sheetObserver.observe($('productSheetBody'), { childList: true, subtree: true });
  window.addEventListener('online', () => { flushProductFlags(); cloudFlagsLoaded = false; setTimeout(loadFlagsFromCloud, 400); });
  setInterval(() => { loadFlagsFromCloud(); flushProductFlags(); }, 2500);
  window.enhanceDateInputs?.(document); window.renderAll?.(); loadFlagsFromCloud();
})();