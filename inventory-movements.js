(() => {
  let activeRange = '7';

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

  function movementProduct(movement) {
    return state.products.find((product) => product.id === movement.productId);
  }

  function movementTypeLabel(type) {
    return ({ purchase: 'شراء / إضافة مخزون', sale: 'بيع', consumption: 'تشغيل' })[type] || 'حركة';
  }

  function movementTypeShort(type) {
    return ({ purchase: 'شراء', sale: 'بيع', consumption: 'تشغيل' })[type] || 'حركة';
  }

  function filteredMovements() {
    let from = '';
    let to = '';

    if (activeRange === '7') {
      from = dateDaysBack(7);
      to = localIso();
    } else if (activeRange === '30') {
      from = dateDaysBack(30);
      to = localIso();
    } else if (activeRange === 'custom') {
      from = $('movementFromDate')?.value || '';
      to = $('movementToDate')?.value || '';
    }

    return [...state.inventoryMovements]
      .filter((movement) => (!from || String(movement.date || '') >= from) && (!to || String(movement.date || '') <= to))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function movementCard(movement) {
    const product = movementProduct(movement);
    const name = product?.name || 'منتج غير موجود';
    const qty = numberFmt.format(num(movement.quantity));
    const type = movement.type;
    const sign = type === 'purchase' ? '+' : '−';

    let details = '';
    if (type === 'purchase') {
      details = `
        <div><span>سعر شراء القطعة</span><strong>${money.format(num(movement.unitCost))}</strong></div>
        <div><span>إجمالي الشراء</span><strong>${money.format(num(movement.totalCost))}</strong></div>`;
    } else if (type === 'sale') {
      details = `
        <div><span>سعر بيع القطعة</span><strong>${money.format(num(movement.unitPrice))}</strong></div>
        <div><span>إجمالي البيع</span><strong>${money.format(num(movement.revenue))}</strong></div>
        <div><span>تكلفة المخزون</span><strong>${money.format(num(movement.totalCost))}</strong></div>
        <div><span>ربح البيع</span><strong class="${num(movement.profit) < 0 ? 'negative' : 'positive'}">${money.format(num(movement.profit))}</strong></div>`;
    } else {
      details = `
        <div><span>تكلفة القطعة</span><strong>${money.format(num(movement.unitCost))}</strong></div>
        <div><span>تكلفة المخزون</span><strong>${money.format(num(movement.totalCost))}</strong></div>`;
    }

    const note = type === 'consumption'
      ? '<p class="im-note">التشغيل هنا للمخزن فقط ومش بيأثر على سجل المحل أو ربحه.</p>'
      : '';

    return `
      <article class="im-card im-${type}">
        <div class="im-card-head">
          <div class="im-card-title">
            <span class="im-type">${movementTypeShort(type)}</span>
            <strong>${escapeHtml(name)}</strong>
            <small>${escapeHtml(formatDate(movement.date))}</small>
          </div>
          <div class="im-qty ${type === 'purchase' ? 'positive' : ''}">${sign}${qty} قطعة</div>
        </div>
        <div class="im-details">${details}</div>
        ${note}
      </article>`;
  }

  function renderMovementSummary(movements) {
    const totals = movements.reduce((acc, movement) => {
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
    const list = $('inventoryMovementsList');
    if (!list) return;

    const movements = filteredMovements();
    renderMovementSummary(movements);
    $('movementResultCount').textContent = `${numberFmt.format(movements.length)} حركة`;

    if (!movements.length) {
      list.innerHTML = '<div class="empty-state"><strong>مفيش حركات في الفترة دي</strong><span>غيّر الفترة أو سجّل شراء أو بيع أو تشغيل من صفحة المخزن.</span></div>';
      return;
    }

    list.innerHTML = movements.map(movementCard).join('');
  };

  function updateRangeUi() {
    document.querySelectorAll('[data-im-range]').forEach((button) => {
      button.classList.toggle('active', button.dataset.imRange === activeRange);
    });
    const custom = $('movementCustomRange');
    if (custom) custom.hidden = activeRange !== 'custom';
    window.renderInventoryMovements();
  }

  function openMovements() {
    document.querySelectorAll('.view').forEach((view) => view.classList.toggle('active', view.dataset.view === 'inventory-movements'));
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.target === 'inventory'));
    window.renderInventoryMovements();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToInventory() {
    switchView('inventory');
  }

  function injectStyles() {
    if ($('inventoryMovementsStyles')) return;
    const style = document.createElement('style');
    style.id = 'inventoryMovementsStyles';
    style.textContent = `
      .inventory-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .inventory-movements-view .section-head{align-items:center}
      .im-filters{display:flex;gap:8px;overflow-x:auto;padding:2px 1px 10px;scrollbar-width:none}
      .im-filters::-webkit-scrollbar{display:none}
      .im-filter-chip{flex:0 0 auto;border:1px solid var(--line);background:var(--surface);color:var(--text);min-height:40px;padding:0 13px;border-radius:12px;font-weight:800;font-size:.76rem}
      .im-filter-chip.active{background:var(--brand);border-color:var(--brand);color:#fff}
      .im-custom-range[hidden]{display:none}
      .im-custom-range{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:12px;margin-bottom:12px}
      .im-custom-range label{display:flex;flex-direction:column;gap:6px;color:var(--muted);font-size:.72rem;font-weight:700}
      .im-custom-range input{width:100%;min-height:44px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--text);padding:0 10px;outline:none}
      .im-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}
      .im-summary-card{background:var(--surface);border:1px solid var(--line);border-radius:15px;padding:11px;min-width:0}
      .im-summary-card span{display:block;color:var(--muted);font-size:.65rem;margin-bottom:5px}
      .im-summary-card strong{font-size:.95rem}
      .im-list-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 2px 9px}
      .im-list-head h3{margin:0;font-size:1rem}.im-list-head span{color:var(--muted);font-size:.75rem}
      .im-list{display:grid;gap:10px}
      .im-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:14px;box-shadow:var(--shadow);border-right-width:4px}
      .im-card.im-purchase{border-right-color:#4f46e5}.im-card.im-sale{border-right-color:var(--success)}.im-card.im-consumption{border-right-color:#9ca3af}
      .im-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      .im-card-title{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:4px 8px;min-width:0}
      .im-card-title strong{font-size:.94rem;overflow-wrap:anywhere}.im-card-title small{grid-column:1/-1;color:var(--muted);font-size:.7rem}
      .im-type{display:inline-flex;width:max-content;border-radius:999px;padding:4px 7px;background:var(--brand-soft);font-size:.64rem;font-weight:900;color:var(--text)}
      .im-purchase .im-type{background:#eef2ff;color:#3730a3}.im-sale .im-type{background:var(--success-soft);color:var(--success)}.im-consumption .im-type{background:#f3f4f6;color:#4b5563}
      .im-qty{font-weight:900;white-space:nowrap;font-size:.9rem}
      .im-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}
      .im-details>div{background:var(--surface-2);border-radius:11px;padding:9px;min-width:0}
      .im-details span{display:block;color:var(--muted);font-size:.64rem;margin-bottom:3px}.im-details strong{display:block;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .im-note{margin:10px 0 0;padding:9px 10px;border-radius:10px;background:#f3f4f6;color:var(--muted);font-size:.7rem;line-height:1.55}
      @media(max-width:540px){.inventory-head{align-items:flex-start}.inventory-head-actions{display:grid;grid-template-columns:1fr 1fr;width:100%;grid-column:1/-1}.inventory-head{flex-wrap:wrap}.inventory-head-actions .btn{padding:0 10px}.im-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:380px){.im-custom-range{grid-template-columns:1fr}.im-details{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function createView() {
    if (document.querySelector('[data-view="inventory-movements"]')) return;

    const section = document.createElement('section');
    section.className = 'view inventory-movements-view';
    section.dataset.view = 'inventory-movements';
    section.innerHTML = `
      <div class="section-head">
        <div>
          <p class="section-kicker">المخزن والمنتجات</p>
          <h2>حركات المنتجات</h2>
        </div>
        <button class="btn ghost" type="button" id="backToInventoryBtn">رجوع للمخزن</button>
      </div>

      <div class="im-filters" aria-label="فلترة حركات المنتجات حسب التاريخ">
        <button class="im-filter-chip active" type="button" data-im-range="7">آخر 7 أيام</button>
        <button class="im-filter-chip" type="button" data-im-range="30">آخر 30 يوم</button>
        <button class="im-filter-chip" type="button" data-im-range="all">كل الحركات</button>
        <button class="im-filter-chip" type="button" data-im-range="custom">من تاريخ لتاريخ</button>
      </div>

      <div class="im-custom-range" id="movementCustomRange" hidden>
        <label>من تاريخ<input type="date" id="movementFromDate" /></label>
        <label>إلى تاريخ<input type="date" id="movementToDate" /></label>
      </div>

      <div class="im-summary">
        <article class="im-summary-card"><span>عدد الحركات</span><strong id="movementTotalCount">0</strong></article>
        <article class="im-summary-card"><span>قطع مشتراة</span><strong id="movementPurchaseQty">0</strong></article>
        <article class="im-summary-card"><span>قطع مباعة</span><strong id="movementSaleQty">0</strong></article>
        <article class="im-summary-card"><span>قطع تشغيل</span><strong id="movementConsumptionQty">0</strong></article>
      </div>

      <div class="im-list-head"><h3>الحركات</h3><span id="movementResultCount">0 حركة</span></div>
      <div class="im-list" id="inventoryMovementsList"></div>`;

    const vaultView = document.querySelector('[data-view="vault"]');
    if (vaultView) vaultView.before(section);
    else document.querySelector('main')?.appendChild(section);

    $('movementFromDate').value = dateDaysBack(30);
    $('movementToDate').value = localIso();
  }

  function addInventoryButton() {
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

  injectStyles();
  createView();
  addInventoryButton();

  $('openInventoryMovementsBtn')?.addEventListener('click', openMovements);
  $('backToInventoryBtn')?.addEventListener('click', backToInventory);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-im-range]');
    if (!button) return;
    activeRange = button.dataset.imRange;
    if (activeRange === 'custom') {
      if (!$('movementFromDate').value) $('movementFromDate').value = dateDaysBack(30);
      if (!$('movementToDate').value) $('movementToDate').value = localIso();
    }
    updateRangeUi();
  });

  $('movementFromDate')?.addEventListener('change', window.renderInventoryMovements);
  $('movementToDate')?.addEventListener('change', window.renderInventoryMovements);

  window.renderInventoryMovements();
})();