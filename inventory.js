(() => {
  const LOW_STOCK_THRESHOLD = 3;

  function ensureInventoryState() {
    if (!Array.isArray(state.products)) state.products = [];
    if (!Array.isArray(state.inventoryMovements)) state.inventoryMovements = [];
    state.settings = state.settings || {};
    state.settings.lowStockThreshold = LOW_STOCK_THRESHOLD;

    state.products = state.products.map((product) => ({
      id: product.id || uid(),
      name: String(product.name || 'منتج'),
      quantity: Math.max(0, Math.trunc(num(product.quantity))),
      currentCost: Math.max(0, num(product.currentCost ?? product.purchasePrice)),
      sellingPrice: Math.max(0, num(product.sellingPrice)),
      imageData: safeImageSrc(product.imageData) || '',
      createdAt: product.createdAt || new Date().toISOString()
    }));
  }

  function safeImageSrc(value) {
    const text = String(value || '');
    return /^data:image\/(?:png|jpe?g|webp);base64,/i.test(text) ? text : '';
  }

  function productById(productId) {
    return state.products.find((product) => product.id === productId);
  }

  function productMovements(productId) {
    return state.inventoryMovements
      .filter((movement) => movement.productId === productId)
      .sort((a, b) => {
        const dateCompare = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCompare) return dateCompare;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      });
  }

  function productSalesMetrics(productId = null) {
    const sales = state.inventoryMovements.filter((movement) => {
      return movement.type === 'sale' && (!productId || movement.productId === productId);
    });
    return sales.reduce((acc, movement) => {
      acc.cash += num(movement.revenue);
      acc.cost += num(movement.totalCost);
      acc.profit += num(movement.profit);
      acc.quantity += num(movement.quantity);
      return acc;
    }, { cash:0, cost:0, profit:0, quantity:0 });
  }

  function monthlyConsumption(month) {
    return round(state.inventoryMovements
      .filter((movement) => movement.type === 'consumption' && monthKeyFromDate(movement.date) === month)
      .reduce((sum, movement) => sum + num(movement.totalCost), 0));
  }

  window.inventoryConsumptionForDate = (date) => round(state.inventoryMovements
    .filter((movement) => movement.type === 'consumption' && movement.date === date)
    .reduce((sum, movement) => sum + num(movement.totalCost), 0));

  window.renderInventoryDashboard = () => {
    const consumption = monthlyConsumption(selectedMonth());
    const before = monthlyData().totals.profit;
    const after = round(before - consumption);

    const afterEl = $('statProfitAfterProducts');
    const consumptionEl = $('breakProductConsumption');
    if (afterEl) {
      afterEl.textContent = money.format(after);
      setSignedClass(afterEl, after);
    }
    if (consumptionEl) consumptionEl.textContent = money.format(consumption);
  };

  function stockBadge(product) {
    if (product.quantity <= 0) return '<span class="stock-badge out">خلص</span>';
    if (product.quantity <= LOW_STOCK_THRESHOLD) return '<span class="stock-badge low">قرب يخلص</span>';
    return '<span class="stock-badge">متوفر</span>';
  }

  function productImage(product, className = 'product-image') {
    const src = safeImageSrc(product.imageData);
    if (src) return `<img class="${className}" src="${src}" alt="${escapeHtml(product.name)}" />`;
    return `<span class="product-image-placeholder" aria-hidden="true">5</span>`;
  }

  window.renderInventory = () => {
    ensureInventoryState();

    const countEl = $('inventoryProductsCount');
    const unitsEl = $('inventoryUnitsCount');
    const cashEl = $('inventorySalesCash');
    const profitEl = $('inventorySalesProfit');
    const grid = $('productsGrid');
    const alert = $('lowStockAlert');
    if (!grid) return;

    const sales = productSalesMetrics();
    const units = state.products.reduce((sum, product) => sum + num(product.quantity), 0);

    countEl.textContent = numberFmt.format(state.products.length);
    unitsEl.textContent = numberFmt.format(units);
    cashEl.textContent = money.format(sales.cash);
    profitEl.textContent = money.format(sales.profit);
    setSignedClass(profitEl, sales.profit);

    const low = state.products.filter((product) => product.quantity <= LOW_STOCK_THRESHOLD);
    if (low.length) {
      alert.hidden = false;
      const names = low.slice(0, 4).map((product) => escapeHtml(product.name)).join('، ');
      const extra = low.length > 4 ? ` + ${numberFmt.format(low.length - 4)} كمان` : '';
      alert.innerHTML = `⚠️ <strong>${numberFmt.format(low.length)} منتج</strong> عنده ${LOW_STOCK_THRESHOLD} قطع أو أقل: ${names}${extra}`;
    } else {
      alert.hidden = true;
      alert.textContent = '';
    }

    if (!state.products.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <strong>المخزن فاضي لسه</strong>
          <span>اضغط «+ منتج جديد» وسجّل أول كريم أو زيت.</span>
        </div>`;
      return;
    }

    const products = [...state.products].sort((a, b) => {
      const aLow = a.quantity <= LOW_STOCK_THRESHOLD ? 0 : 1;
      const bLow = b.quantity <= LOW_STOCK_THRESHOLD ? 0 : 1;
      if (aLow !== bLow) return aLow - bLow;
      return String(a.name).localeCompare(String(b.name), 'ar');
    });

    grid.innerHTML = products.map((product) => {
      const expectedProfit = round(num(product.sellingPrice) - num(product.currentCost));
      const out = product.quantity <= 0;
      return `
        <article class="product-card">
          <button class="product-open" type="button" data-open-product="${product.id}">
            <div class="product-image-wrap">${productImage(product)}</div>
            <div class="product-main">
              <div class="product-name-row">
                <h3>${escapeHtml(product.name)}</h3>
                ${stockBadge(product)}
              </div>
              <div class="product-qty">
                <strong>${numberFmt.format(product.quantity)}</strong>
                <span>قطعة في المخزن</span>
              </div>
              <div class="product-price-row">
                <div class="product-price-box"><span>آخر شراء</span><strong>${money.format(product.currentCost)}</strong></div>
                <div class="product-price-box"><span>سعر البيع</span><strong>${money.format(product.sellingPrice)}</strong></div>
              </div>
              <div class="product-price-box"><span>ربح متوقع للقطعة بالسعر الحالي</span><strong class="${expectedProfit < 0 ? 'negative' : 'positive'}">${money.format(expectedProfit)}</strong></div>
            </div>
          </button>
          <div class="product-actions">
            <button class="product-action-btn sell" type="button" data-product-action="sale" data-product-id="${product.id}" ${out ? 'disabled' : ''}>بيع</button>
            <button class="product-action-btn consume" type="button" data-product-action="consume" data-product-id="${product.id}" ${out ? 'disabled' : ''}>تشغيل</button>
            <button class="product-action-btn restock" type="button" data-product-action="restock" data-product-id="${product.id}">إضافة مخزون</button>
            <button class="product-action-btn price" type="button" data-product-action="edit-price" data-product-id="${product.id}">تعديل السعر</button>
          </div>
        </article>`;
    }).join('');
  };

  function openSheet(title, body, kicker = 'المخزن') {
    $('productSheetKicker').textContent = kicker;
    $('productSheetTitle').textContent = title;
    $('productSheetBody').innerHTML = body;
    $('productSheet').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeSheet() {
    $('productSheet').hidden = true;
    $('productSheetBody').innerHTML = '';
    document.body.style.overflow = '';
  }

  function productSummary(product) {
    return `<div class="sheet-summary"><strong>${escapeHtml(product.name)}</strong> • الموجود حاليًا ${numberFmt.format(product.quantity)} قطعة • آخر سعر شراء ${money.format(product.currentCost)} • سعر البيع المحفوظ ${money.format(product.sellingPrice)}</div>`;
  }

  function openAddProduct() {
    openSheet('إضافة منتج جديد', `
      <form id="createProductForm" class="entry-form">
        <label class="field field-wide">
          <span>اسم المنتج</span>
          <input id="newProductName" type="text" maxlength="80" required placeholder="مثلاً: كريم شعر" />
        </label>
        <label class="field field-wide">
          <span>صورة المنتج <em>اختياري</em></span>
          <input id="newProductImage" type="file" accept="image/*" data-image-input="newProductImagePreview" />
          <div id="newProductImagePreview" class="image-preview">اختار صورة — هتتصغر تلقائيًا عشان المساحة</div>
        </label>
        <label class="field">
          <span>العدد</span>
          <input id="newProductQty" type="number" min="0" step="1" inputmode="numeric" required placeholder="0" />
        </label>
        <label class="field">
          <span>سعر شراء القطعة</span>
          <div class="money-input"><input id="newProductCost" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="0" /><b>ج.م</b></div>
        </label>
        <label class="field">
          <span>سعر البيع المحفوظ</span>
          <div class="money-input"><input id="newProductSellingPrice" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="0" /><b>ج.م</b></div>
        </label>
        <label class="field">
          <span>تاريخ الشراء</span>
          <input id="newProductDate" type="date" required value="${isoToday()}" />
        </label>
        <div class="form-actions field-wide">
          <button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button>
          <button class="btn primary" type="submit">حفظ المنتج</button>
        </div>
      </form>
    `, 'منتج جديد');
  }

  function openRestock(product) {
    openSheet('إضافة مخزون', `
      ${productSummary(product)}
      <form id="restockProductForm" class="entry-form" data-product-id="${product.id}">
        <label class="field">
          <span>العدد الجديد</span>
          <input id="restockQty" type="number" min="1" step="1" inputmode="numeric" required placeholder="1" />
        </label>
        <label class="field">
          <span>سعر شراء القطعة الجديد</span>
          <div class="money-input"><input id="restockCost" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.currentCost}" /><b>ج.م</b></div>
        </label>
        <label class="field field-wide">
          <span>تاريخ الشراء</span>
          <input id="restockDate" type="date" required value="${isoToday()}" />
        </label>
        <div class="inline-note field-wide">سعر البيع المحفوظ هيفضل زي ما هو. سعر الشراء اللي هتكتبه هنا هو اللي هيبقى «آخر سعر شراء» للمنتج.</div>
        <div class="form-actions field-wide">
          <button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button>
          <button class="btn primary" type="submit">إضافة للمخزون</button>
        </div>
      </form>
    `, 'شراء جديد');
  }

  function openSale(product) {
    openSheet('بيع منتج', `
      ${productSummary(product)}
      <form id="sellProductForm" class="entry-form" data-product-id="${product.id}">
        <label class="field">
          <span>العدد المباع</span>
          <input id="saleQty" type="number" min="1" max="${product.quantity}" step="1" inputmode="numeric" required value="1" />
        </label>
        <label class="field">
          <span>سعر بيع القطعة</span>
          <div class="money-input"><input id="salePrice" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.sellingPrice}" /><b>ج.م</b></div>
        </label>
        <label class="field field-wide">
          <span>تاريخ البيع</span>
          <input id="saleDate" type="date" required value="${isoToday()}" />
        </label>
        <div id="salePreview" class="sheet-summary field-wide"></div>
        <div class="form-actions field-wide">
          <button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button>
          <button class="btn primary" type="submit">تسجيل البيع</button>
        </div>
      </form>
    `, 'مبيعات المنتجات');
    updateSalePreview(product);
  }

  function updateSalePreview(product) {
    const preview = $('salePreview');
    if (!preview) return;
    const qty = Math.max(0, Math.trunc(num($('saleQty')?.value)));
    const unitPrice = Math.max(0, num($('salePrice')?.value));
    const revenue = round(qty * unitPrice);
    const cost = round(qty * product.currentCost);
    const profit = round(revenue - cost);
    preview.innerHTML = `إجمالي البيع <strong>${money.format(revenue)}</strong> • تكلفة المخزون <strong>${money.format(cost)}</strong> • ربح البيع <strong class="${profit < 0 ? 'negative' : 'positive'}">${money.format(profit)}</strong>`;
  }

  function openConsumption(product) {
    openSheet('تشغيل المحل', `
      ${productSummary(product)}
      <form id="consumeProductForm" class="entry-form" data-product-id="${product.id}">
        <label class="field">
          <span>العدد المستخدم</span>
          <input id="consumeQty" type="number" min="1" max="${product.quantity}" step="1" inputmode="numeric" required value="1" />
        </label>
        <label class="field">
          <span>تاريخ الاستخدام</span>
          <input id="consumeDate" type="date" required value="${isoToday()}" />
        </label>
        <div id="consumePreview" class="sheet-summary field-wide"></div>
        <div class="form-actions field-wide">
          <button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button>
          <button class="btn primary" type="submit">تسجيل التشغيل</button>
        </div>
      </form>
    `, 'استهلاك منتجات');
    updateConsumptionPreview(product);
  }

  function updateConsumptionPreview(product) {
    const preview = $('consumePreview');
    if (!preview) return;
    const qty = Math.max(0, Math.trunc(num($('consumeQty')?.value)));
    const cost = round(qty * product.currentCost);
    preview.innerHTML = `هيتخصم ${numberFmt.format(qty)} قطعة من المخزن، ويتسجل <strong>${money.format(cost)}</strong> تحت «استهلاك منتجات».`;
  }

  function openEditPrice(product) {
    openSheet('تعديل سعر البيع', `
      ${productSummary(product)}
      <form id="editProductPriceForm" class="entry-form" data-product-id="${product.id}">
        <label class="field field-wide">
          <span>سعر البيع الجديد</span>
          <div class="money-input"><input id="quickSellingPrice" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.sellingPrice}" /><b>ج.م</b></div>
        </label>
        <div class="form-actions field-wide">
          <button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button>
          <button class="btn primary" type="submit">حفظ السعر</button>
        </div>
      </form>
    `, 'تعديل سريع');
  }

  function movementCard(movement) {
    const labels = {
      purchase: 'إضافة مخزون',
      sale: 'بيع',
      consumption: 'تشغيل المحل'
    };
    const qtySign = movement.type === 'purchase' ? '+' : '−';
    let detail = `تكلفة القطعة ${money.format(num(movement.unitCost))}`;
    let value = `${qtySign}${numberFmt.format(num(movement.quantity))} قطعة`;
    let sub = money.format(num(movement.totalCost));

    if (movement.type === 'sale') {
      detail = `بيع القطعة ${money.format(num(movement.unitPrice))} • تكلفة القطعة ${money.format(num(movement.unitCost))}`;
      value = money.format(num(movement.revenue));
      sub = `ربح ${money.format(num(movement.profit))}`;
    } else if (movement.type === 'consumption') {
      sub = `استهلاك ${money.format(num(movement.totalCost))}`;
    } else {
      sub = `شراء ${money.format(num(movement.totalCost))}`;
    }

    return `
      <div class="movement-item">
        <div class="movement-info">
          <strong>${labels[movement.type] || 'حركة مخزون'}</strong>
          <span>${escapeHtml(formatDate(movement.date))}</span>
          <span>${detail}</span>
        </div>
        <div class="movement-value">
          <strong>${value}</strong>
          <span>${sub}</span>
        </div>
      </div>`;
  }

  function openDetails(product) {
    const sales = productSalesMetrics(product.id);
    const movements = productMovements(product.id);
    const expected = round(product.sellingPrice - product.currentCost);
    const movementHtml = movements.length
      ? movements.map(movementCard).join('')
      : '<div class="empty-state"><strong>مفيش حركات لسه</strong><span>أي شراء أو بيع أو تشغيل هيتسجل هنا.</span></div>';

    openSheet(product.name, `
      <div class="product-detail-hero">
        <div class="product-image-wrap">${productImage(product)}</div>
        <div class="product-detail-meta">
          <h4>${escapeHtml(product.name)}</h4>
          <p>${numberFmt.format(product.quantity)} قطعة في المخزن</p>
          ${stockBadge(product)}
        </div>
      </div>
      <div class="detail-stats">
        <div class="detail-stat"><span>آخر سعر شراء</span><strong>${money.format(product.currentCost)}</strong></div>
        <div class="detail-stat"><span>سعر البيع المحفوظ</span><strong>${money.format(product.sellingPrice)}</strong></div>
        <div class="detail-stat"><span>ربح متوقع للقطعة</span><strong class="${expected < 0 ? 'negative' : 'positive'}">${money.format(expected)}</strong></div>
        <div class="detail-stat"><span>إجمالي كاش مبيعات المنتج</span><strong>${money.format(sales.cash)}</strong></div>
        <div class="detail-stat"><span>إجمالي ربح المنتج</span><strong class="${sales.profit < 0 ? 'negative' : 'positive'}">${money.format(sales.profit)}</strong></div>
        <div class="detail-stat"><span>القطع المباعة</span><strong>${numberFmt.format(sales.quantity)}</strong></div>
      </div>
      <div class="detail-actions">
        <button class="btn secondary" type="button" data-product-action="edit-full" data-product-id="${product.id}">تعديل بيانات المنتج</button>
        <button class="btn ghost" type="button" data-product-action="restock" data-product-id="${product.id}">إضافة مخزون</button>
      </div>
      <h4 class="movement-title">كل حركات المنتج</h4>
      <div class="movement-list">${movementHtml}</div>
    `, 'تفاصيل المنتج');
  }

  function openFullEdit(product) {
    openSheet('تعديل بيانات المنتج', `
      <form id="editProductForm" class="entry-form" data-product-id="${product.id}">
        <label class="field field-wide">
          <span>اسم المنتج</span>
          <input id="editProductName" type="text" maxlength="80" required value="${escapeHtml(product.name)}" />
        </label>
        <label class="field field-wide">
          <span>صورة جديدة <em>اختياري — سيبها فاضية للاحتفاظ بالصورة الحالية</em></span>
          <input id="editProductImage" type="file" accept="image/*" data-image-input="editProductImagePreview" />
          <div id="editProductImagePreview" class="image-preview">${product.imageData ? `<img src="${safeImageSrc(product.imageData)}" alt="" />` : 'مفيش صورة حالية'}</div>
        </label>
        <label class="field field-wide">
          <span>سعر البيع المحفوظ</span>
          <div class="money-input"><input id="editProductSellingPrice" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.sellingPrice}" /><b>ج.م</b></div>
        </label>
        <div class="sheet-summary field-wide">آخر سعر شراء الحالي هو <strong>${money.format(product.currentCost)}</strong>. تغييره بيكون من «إضافة مخزون» وقت الشراء الجديد.</div>
        <div class="form-actions field-wide">
          <button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button>
          <button class="btn primary" type="submit">حفظ التعديل</button>
        </div>
      </form>
    `, 'تعديل كامل');
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith('image/')) return '';
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      });

      const maxSide = 420;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha:false });
      ctx.drawImage(image, 0, 0, width, height);
      let data = canvas.toDataURL('image/webp', .72);
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', .72);
      return data;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function persistStateWithImageFallback(product = null) {
    try {
      saveState();
      return true;
    } catch (error) {
      if (product?.imageData) {
        product.imageData = '';
        try {
          saveState();
          showToast('اتحفظ من غير الصورة لأن مساحة الجهاز مش كفاية');
          return true;
        } catch {}
      }
      showToast('مساحة التخزين على الجهاز مش كفاية');
      return false;
    }
  }

  function addMovement(payload) {
    state.inventoryMovements.push({
      id: uid(),
      createdAt: new Date().toISOString(),
      ...payload
    });
  }

  $('addProductBtn')?.addEventListener('click', openAddProduct);

  document.addEventListener('input', (event) => {
    if (event.target.id === 'saleQty' || event.target.id === 'salePrice') {
      const form = event.target.closest('#sellProductForm');
      const product = productById(form?.dataset.productId);
      if (product) updateSalePreview(product);
    }
    if (event.target.id === 'consumeQty') {
      const form = event.target.closest('#consumeProductForm');
      const product = productById(form?.dataset.productId);
      if (product) updateConsumptionPreview(product);
    }
  });

  document.addEventListener('change', async (event) => {
    const input = event.target.closest('[data-image-input]');
    if (!input) return;
    const file = input.files?.[0];
    const preview = $(input.dataset.imageInput);
    if (!file || !preview) return;
    preview.textContent = 'جاري تجهيز الصورة...';
    try {
      input._compressedImage = await compressImage(file);
      preview.innerHTML = input._compressedImage
        ? `<img src="${input._compressedImage}" alt="معاينة الصورة" />`
        : 'تعذر قراءة الصورة';
    } catch {
      input._compressedImage = '';
      preview.textContent = 'تعذر قراءة الصورة';
      showToast('الصورة دي مش صالحة');
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-product-sheet-close]')) {
      closeSheet();
      return;
    }

    const openProductId = event.target.closest('[data-open-product]')?.dataset.openProduct;
    if (openProductId) {
      const product = productById(openProductId);
      if (product) openDetails(product);
      return;
    }

    const actionButton = event.target.closest('[data-product-action]');
    if (!actionButton) return;
    const product = productById(actionButton.dataset.productId);
    if (!product) return;

    switch (actionButton.dataset.productAction) {
      case 'sale':
        if (product.quantity <= 0) return showToast('المنتج خلص من المخزن');
        openSale(product);
        break;
      case 'consume':
        if (product.quantity <= 0) return showToast('المنتج خلص من المخزن');
        openConsumption(product);
        break;
      case 'restock':
        openRestock(product);
        break;
      case 'edit-price':
        openEditPrice(product);
        break;
      case 'edit-full':
        openFullEdit(product);
        break;
    }
  });

  document.addEventListener('submit', async (event) => {
    if (event.target.id === 'createProductForm') {
      event.preventDefault();
      const name = $('newProductName').value.trim();
      const quantity = Math.trunc(num($('newProductQty').value));
      const currentCost = num($('newProductCost').value);
      const sellingPrice = num($('newProductSellingPrice').value);
      const date = $('newProductDate').value;
      const imageData = $('newProductImage')._compressedImage || '';

      if (!name) return showToast('اكتب اسم المنتج');
      if (quantity < 0 || currentCost < 0 || sellingPrice < 0 || !date) return showToast('راجع العدد والأسعار والتاريخ');

      const product = {
        id: uid(),
        name,
        quantity,
        currentCost: round(currentCost),
        sellingPrice: round(sellingPrice),
        imageData,
        createdAt: new Date().toISOString()
      };
      state.products.push(product);

      if (quantity > 0) {
        addMovement({
          productId: product.id,
          type: 'purchase',
          date,
          quantity,
          unitCost: product.currentCost,
          totalCost: round(quantity * product.currentCost)
        });
      }

      if (!persistStateWithImageFallback(product)) return;
      closeSheet();
      renderAll();
      showToast('تم إضافة المنتج');
      return;
    }

    if (event.target.id === 'restockProductForm') {
      event.preventDefault();
      const product = productById(event.target.dataset.productId);
      if (!product) return;
      const quantity = Math.trunc(num($('restockQty').value));
      const unitCost = num($('restockCost').value);
      const date = $('restockDate').value;
      if (quantity <= 0 || unitCost < 0 || !date) return showToast('راجع العدد وسعر الشراء والتاريخ');

      product.quantity += quantity;
      product.currentCost = round(unitCost);
      addMovement({
        productId: product.id,
        type: 'purchase',
        date,
        quantity,
        unitCost: product.currentCost,
        totalCost: round(quantity * product.currentCost)
      });

      if (!persistStateWithImageFallback()) return;
      closeSheet();
      renderAll();
      showToast('تمت إضافة المخزون');
      return;
    }

    if (event.target.id === 'sellProductForm') {
      event.preventDefault();
      const product = productById(event.target.dataset.productId);
      if (!product) return;
      const quantity = Math.trunc(num($('saleQty').value));
      const unitPrice = num($('salePrice').value);
      const date = $('saleDate').value;
      if (quantity <= 0 || quantity > product.quantity) return showToast('العدد المباع أكبر من الموجود أو غير صحيح');
      if (unitPrice < 0 || !date) return showToast('راجع سعر البيع والتاريخ');

      const unitCost = round(product.currentCost);
      const revenue = round(quantity * unitPrice);
      const totalCost = round(quantity * unitCost);
      const profit = round(revenue - totalCost);
      product.quantity -= quantity;

      addMovement({
        productId: product.id,
        type: 'sale',
        date,
        quantity,
        unitCost,
        unitPrice: round(unitPrice),
        totalCost,
        revenue,
        profit
      });

      if (!persistStateWithImageFallback()) return;
      closeSheet();
      renderAll();
      showToast(`تم تسجيل البيع • الربح ${money.format(profit)}`);
      return;
    }

    if (event.target.id === 'consumeProductForm') {
      event.preventDefault();
      const product = productById(event.target.dataset.productId);
      if (!product) return;
      const quantity = Math.trunc(num($('consumeQty').value));
      const date = $('consumeDate').value;
      if (quantity <= 0 || quantity > product.quantity) return showToast('العدد المستخدم أكبر من الموجود أو غير صحيح');
      if (!date) return showToast('اختار التاريخ');

      const unitCost = round(product.currentCost);
      const totalCost = round(quantity * unitCost);
      product.quantity -= quantity;

      addMovement({
        productId: product.id,
        type: 'consumption',
        date,
        quantity,
        unitCost,
        totalCost
      });

      if (!persistStateWithImageFallback()) return;
      closeSheet();
      renderAll();
      showToast(`تم تسجيل استهلاك منتجات بقيمة ${money.format(totalCost)}`);
      return;
    }

    if (event.target.id === 'editProductPriceForm') {
      event.preventDefault();
      const product = productById(event.target.dataset.productId);
      if (!product) return;
      const price = num($('quickSellingPrice').value);
      if (price < 0) return showToast('اكتب سعر صحيح');
      product.sellingPrice = round(price);
      if (!persistStateWithImageFallback()) return;
      closeSheet();
      renderAll();
      showToast('تم تعديل سعر البيع');
      return;
    }

    if (event.target.id === 'editProductForm') {
      event.preventDefault();
      const product = productById(event.target.dataset.productId);
      if (!product) return;
      const name = $('editProductName').value.trim();
      const sellingPrice = num($('editProductSellingPrice').value);
      const newImage = $('editProductImage')._compressedImage || '';
      if (!name || sellingPrice < 0) return showToast('راجع اسم المنتج وسعر البيع');

      product.name = name;
      product.sellingPrice = round(sellingPrice);
      if (newImage) product.imageData = newImage;

      if (!persistStateWithImageFallback(product)) return;
      closeSheet();
      renderAll();
      showToast('تم تعديل بيانات المنتج');
    }
  });

  ensureInventoryState();
  renderAll();
})();