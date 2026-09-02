(() => {
  const LOW_STOCK_THRESHOLD = 3;
  const INVENTORY_SAFETY_KEY = '5areta-inventory-safety-v1';
  let safetyMerged = false;

  const nowIso = () => new Date().toISOString();

  function safeImageSrc(value) {
    const text = String(value || '');
    if (/^data:image\/(?:png|jpe?g|webp);base64,/i.test(text)) return text;
    if (/^https:\/\/rsabmbljhjsfvadhrsti\.supabase\.co\/storage\/v1\/object\/sign\/product-images\//i.test(text)) return text;
    return '';
  }

  function normalizeProduct(product = {}) {
    const createdAt = product.createdAt || nowIso();
    return {
      id: product.id || uid(),
      name: String(product.name || 'منتج'),
      quantity: Math.max(0, Math.trunc(num(product.quantity))),
      currentCost: Math.max(0, round(num(product.currentCost ?? product.purchasePrice))),
      sellingPrice: Math.max(0, round(num(product.sellingPrice))),
      imageData: safeImageSrc(product.imageData),
      imagePath: String(product.imagePath || ''),
      createdAt,
      updatedAt: product.updatedAt || createdAt
    };
  }

  function safetySnapshot() {
    return {
      version: 1,
      savedAt: nowIso(),
      products: state.products.map((product) => ({ ...normalizeProduct(product), imageData: '' })),
      inventoryMovements: state.inventoryMovements.map((movement) => ({ ...movement }))
    };
  }

  function readSafetySnapshot() {
    try {
      const parsed = JSON.parse(localStorage.getItem(INVENTORY_SAFETY_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.products) || !Array.isArray(parsed.inventoryMovements)) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function saveSafetySnapshot() {
    if (window.__5ARETA_CLOUD_ACTIVE__) return true;
    try {
      localStorage.setItem(INVENTORY_SAFETY_KEY, JSON.stringify(safetySnapshot()));
      return true;
    } catch {
      return false;
    }
  }

  function mergeSafetySnapshot() {
    if (safetyMerged) return;
    safetyMerged = true;
    const safety = readSafetySnapshot();
    if (!safety) return;

    const mainById = new Map(state.products.map((product) => {
      const normalized = normalizeProduct(product);
      return [normalized.id, normalized];
    }));

    safety.products.forEach((raw) => {
      const safeProduct = normalizeProduct(raw);
      const mainProduct = mainById.get(safeProduct.id);
      if (!mainProduct) {
        mainById.set(safeProduct.id, safeProduct);
        return;
      }
      const mainTime = Date.parse(mainProduct.updatedAt || mainProduct.createdAt || 0) || 0;
      const safeTime = Date.parse(safeProduct.updatedAt || safeProduct.createdAt || 0) || 0;
      if (safeTime >= mainTime) {
        mainById.set(safeProduct.id, { ...safeProduct, imageData: mainProduct.imageData || '' });
      }
    });

    const movementById = new Map(state.inventoryMovements.map((movement) => [movement.id, movement]));
    safety.inventoryMovements.forEach((movement) => {
      if (movement?.id && !movementById.has(movement.id)) movementById.set(movement.id, movement);
    });

    state.products = [...mainById.values()];
    state.inventoryMovements = [...movementById.values()];
  }

  function ensureInventoryState() {
    if (!Array.isArray(state.products)) state.products = [];
    if (!Array.isArray(state.inventoryMovements)) state.inventoryMovements = [];
    state.settings = state.settings || {};
    state.settings.lowStockThreshold = LOW_STOCK_THRESHOLD;
    state.products = state.products.map(normalizeProduct);
    mergeSafetySnapshot();
    state.products = state.products.map(normalizeProduct);
  }

  function verifyMainStorage(productId = null) {
    if (window.__5ARETA_CLOUD_ACTIVE__) return true;
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.products)) return false;
      if (!productId) return true;
      return parsed.products.some((product) => product.id === productId);
    } catch {
      return false;
    }
  }

  function persistInventory(product = null) {
    const safetySaved = saveSafetySnapshot();
    let imageDropped = false;

    try {
      saveState();
      if (!verifyMainStorage(product?.id || null)) throw new Error('verify');
      return { ok: true, imageDropped: false, safetyOnly: false };
    } catch {
      if (product?.imageData) {
        product.imageData = '';
        imageDropped = true;
        saveSafetySnapshot();
        try {
          saveState();
          if (!verifyMainStorage(product.id)) throw new Error('verify');
          return { ok: true, imageDropped: true, safetyOnly: false };
        } catch {}
      }
    }

    if (safetySaved) return { ok: true, imageDropped, safetyOnly: true };
    return { ok: false, imageDropped, safetyOnly: false };
  }

  function touchProduct(product) {
    product.updatedAt = nowIso();
  }

  function productById(productId) {
    return state.products.find((product) => product.id === productId);
  }

  function productMovements(productId) {
    return state.inventoryMovements
      .filter((movement) => movement.productId === productId)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function productSalesMetrics(productId = null) {
    return state.inventoryMovements
      .filter((movement) => movement.type === 'sale' && (!productId || movement.productId === productId))
      .reduce((acc, movement) => {
        acc.cash += num(movement.revenue);
        acc.cost += num(movement.totalCost);
        acc.profit += num(movement.profit);
        acc.quantity += num(movement.quantity);
        return acc;
      }, { cash: 0, cost: 0, profit: 0, quantity: 0 });
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
    if ($('statProfitAfterProducts')) {
      $('statProfitAfterProducts').textContent = money.format(after);
      setSignedClass($('statProfitAfterProducts'), after);
    }
    if ($('breakProductConsumption')) $('breakProductConsumption').textContent = money.format(consumption);
  };

  function stockBadge(product) {
    if (product.quantity <= 0) return '<span class="stock-badge out">خلص</span>';
    if (product.quantity <= LOW_STOCK_THRESHOLD) return '<span class="stock-badge low">قرب يخلص</span>';
    return '<span class="stock-badge">متوفر</span>';
  }

  function productImage(product) {
    const src = safeImageSrc(product.imageData);
    return src
      ? `<img class="product-image" src="${src}" alt="${escapeHtml(product.name)}" />`
      : '<span class="product-image-placeholder" aria-hidden="true">5</span>';
  }

  window.renderInventory = () => {
    ensureInventoryState();
    saveSafetySnapshot();
    const grid = $('productsGrid');
    if (!grid) return;

    const sales = productSalesMetrics();
    const units = state.products.reduce((sum, product) => sum + num(product.quantity), 0);
    $('inventoryProductsCount').textContent = numberFmt.format(state.products.length);
    $('inventoryUnitsCount').textContent = numberFmt.format(units);
    $('inventorySalesCash').textContent = money.format(sales.cash);
    $('inventorySalesProfit').textContent = money.format(sales.profit);
    setSignedClass($('inventorySalesProfit'), sales.profit);

    const low = state.products.filter((product) => product.quantity <= LOW_STOCK_THRESHOLD);
    const alert = $('lowStockAlert');
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
      grid.innerHTML = '<div class="empty-state"><strong>المخزن فاضي لسه</strong><span>اضغط «+ منتج جديد» وسجّل أول كريم أو زيت.</span></div>';
      return;
    }

    const products = [...state.products].sort((a, b) => {
      const lowDiff = Number(a.quantity > LOW_STOCK_THRESHOLD) - Number(b.quantity > LOW_STOCK_THRESHOLD);
      return lowDiff || String(a.name).localeCompare(String(b.name), 'ar');
    });

    grid.innerHTML = products.map((product) => {
      const expectedProfit = round(product.sellingPrice - product.currentCost);
      const out = product.quantity <= 0;
      return `<article class="product-card">
        <button class="product-open" type="button" data-open-product="${product.id}">
          <div class="product-image-wrap">${productImage(product)}</div>
          <div class="product-main">
            <div class="product-name-row"><h3>${escapeHtml(product.name)}</h3>${stockBadge(product)}</div>
            <div class="product-qty"><strong>${numberFmt.format(product.quantity)}</strong><span>قطعة في المخزن</span></div>
            <div class="product-price-row">
              <div class="product-price-box"><span>آخر شراء</span><strong>${money.format(product.currentCost)}</strong></div>
              <div class="product-price-box"><span>سعر البيع</span><strong>${money.format(product.sellingPrice)}</strong></div>
            </div>
            <div class="product-price-box"><span>ربح متوقع للقطعة</span><strong class="${expectedProfit < 0 ? 'negative' : 'positive'}">${money.format(expectedProfit)}</strong></div>
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
    return `<div class="sheet-summary"><strong>${escapeHtml(product.name)}</strong> • الموجود ${numberFmt.format(product.quantity)} قطعة • آخر شراء ${money.format(product.currentCost)} • البيع ${money.format(product.sellingPrice)}</div>`;
  }

  function openAddProduct() {
    openSheet('إضافة منتج جديد', `<form id="createProductForm" class="entry-form">
      <label class="field field-wide"><span>اسم المنتج</span><input id="newProductName" type="text" maxlength="80" required placeholder="مثلاً: كريم شعر" /></label>
      <label class="field field-wide"><span>صورة المنتج <em>اختياري</em></span><input id="newProductImage" type="file" accept="image/*" data-image-input="newProductImagePreview" /><div id="newProductImagePreview" class="image-preview">اختار صورة — الصورة اختيارية ومش هتمنع حفظ المنتج</div></label>
      <label class="field"><span>العدد</span><input id="newProductQty" type="number" min="0" step="1" inputmode="numeric" required placeholder="0" /></label>
      <label class="field"><span>سعر شراء القطعة</span><div class="money-input"><input id="newProductCost" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="0" /><b>ج.م</b></div></label>
      <label class="field"><span>سعر البيع المحفوظ</span><div class="money-input"><input id="newProductSellingPrice" type="number" min="0" step="0.01" inputmode="decimal" required placeholder="0" /><b>ج.م</b></div></label>
      <label class="field"><span>تاريخ الشراء</span><input id="newProductDate" type="date" required value="${isoToday()}" /></label>
      <div class="form-actions field-wide"><button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button><button class="btn primary" type="submit">حفظ المنتج</button></div>
    </form>`, 'منتج جديد');
  }

  function openRestock(product) {
    openSheet('إضافة مخزون', `${productSummary(product)}<form id="restockProductForm" class="entry-form" data-product-id="${product.id}">
      <label class="field"><span>العدد الجديد</span><input id="restockQty" type="number" min="1" step="1" inputmode="numeric" required placeholder="1" /></label>
      <label class="field"><span>سعر شراء القطعة الجديد</span><div class="money-input"><input id="restockCost" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.currentCost}" /><b>ج.م</b></div></label>
      <label class="field field-wide"><span>تاريخ الشراء</span><input id="restockDate" type="date" required value="${isoToday()}" /></label>
      <div class="inline-note field-wide">سعر البيع المحفوظ هيفضل زي ما هو.</div>
      <div class="form-actions field-wide"><button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button><button class="btn primary" type="submit">إضافة للمخزون</button></div>
    </form>`, 'شراء جديد');
  }

  function openSale(product) {
    openSheet('بيع منتج', `${productSummary(product)}<form id="sellProductForm" class="entry-form" data-product-id="${product.id}">
      <label class="field"><span>العدد المباع</span><input id="saleQty" type="number" min="1" max="${product.quantity}" step="1" inputmode="numeric" required value="1" /></label>
      <label class="field"><span>سعر بيع القطعة</span><div class="money-input"><input id="salePrice" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.sellingPrice}" /><b>ج.م</b></div></label>
      <label class="field field-wide"><span>تاريخ البيع</span><input id="saleDate" type="date" required value="${isoToday()}" /></label>
      <div id="salePreview" class="sheet-summary field-wide"></div>
      <div class="form-actions field-wide"><button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button><button class="btn primary" type="submit">تسجيل البيع</button></div>
    </form>`, 'مبيعات المنتجات');
    updateSalePreview(product);
  }

  function updateSalePreview(product) {
    if (!$('salePreview')) return;
    const qty = Math.max(0, Math.trunc(num($('saleQty')?.value)));
    const unitPrice = Math.max(0, num($('salePrice')?.value));
    const revenue = round(qty * unitPrice);
    const cost = round(qty * product.currentCost);
    const profit = round(revenue - cost);
    $('salePreview').innerHTML = `إجمالي البيع <strong>${money.format(revenue)}</strong> • التكلفة <strong>${money.format(cost)}</strong> • الربح <strong class="${profit < 0 ? 'negative' : 'positive'}">${money.format(profit)}</strong>`;
  }

  function openConsumption(product) {
    openSheet('تشغيل المحل', `${productSummary(product)}<form id="consumeProductForm" class="entry-form" data-product-id="${product.id}">
      <label class="field"><span>العدد المستخدم</span><input id="consumeQty" type="number" min="1" max="${product.quantity}" step="1" inputmode="numeric" required value="1" /></label>
      <label class="field"><span>تاريخ الاستخدام</span><input id="consumeDate" type="date" required value="${isoToday()}" /></label>
      <div id="consumePreview" class="sheet-summary field-wide"></div>
      <div class="form-actions field-wide"><button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button><button class="btn primary" type="submit">تسجيل التشغيل</button></div>
    </form>`, 'استهلاك منتجات');
    updateConsumptionPreview(product);
  }

  function updateConsumptionPreview(product) {
    if (!$('consumePreview')) return;
    const qty = Math.max(0, Math.trunc(num($('consumeQty')?.value)));
    const cost = round(qty * product.currentCost);
    $('consumePreview').innerHTML = `هيتخصم ${numberFmt.format(qty)} قطعة ويتسجل <strong>${money.format(cost)}</strong> تحت «استهلاك منتجات».`;
  }

  function openEditPrice(product) {
    openSheet('تعديل سعر البيع', `${productSummary(product)}<form id="editProductPriceForm" class="entry-form" data-product-id="${product.id}">
      <label class="field field-wide"><span>سعر البيع الجديد</span><div class="money-input"><input id="quickSellingPrice" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.sellingPrice}" /><b>ج.م</b></div></label>
      <div class="form-actions field-wide"><button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button><button class="btn primary" type="submit">حفظ السعر</button></div>
    </form>`, 'تعديل سريع');
  }

  function movementCard(movement) {
    const labels = { purchase: 'إضافة مخزون', sale: 'بيع', consumption: 'تشغيل المحل' };
    const sign = movement.type === 'purchase' ? '+' : '−';
    let value = `${sign}${numberFmt.format(num(movement.quantity))} قطعة`;
    let detail = `تكلفة القطعة ${money.format(num(movement.unitCost))}`;
    let sub = money.format(num(movement.totalCost));
    if (movement.type === 'sale') {
      value = money.format(num(movement.revenue));
      detail = `بيع القطعة ${money.format(num(movement.unitPrice))} • تكلفتها ${money.format(num(movement.unitCost))}`;
      sub = `ربح ${money.format(num(movement.profit))}`;
    }
    return `<div class="movement-item"><div class="movement-info"><strong>${labels[movement.type] || 'حركة مخزون'}</strong><span>${escapeHtml(formatDate(movement.date))}</span><span>${detail}</span></div><div class="movement-value"><strong>${value}</strong><span>${sub}</span></div></div>`;
  }

  function openDetails(product) {
    const sales = productSalesMetrics(product.id);
    const expected = round(product.sellingPrice - product.currentCost);
    const movements = productMovements(product.id);
    openSheet(product.name, `<div class="product-detail-hero"><div class="product-image-wrap">${productImage(product)}</div><div class="product-detail-meta"><h4>${escapeHtml(product.name)}</h4><p>${numberFmt.format(product.quantity)} قطعة في المخزن</p>${stockBadge(product)}</div></div>
      <div class="detail-stats">
        <div class="detail-stat"><span>آخر سعر شراء</span><strong>${money.format(product.currentCost)}</strong></div>
        <div class="detail-stat"><span>سعر البيع</span><strong>${money.format(product.sellingPrice)}</strong></div>
        <div class="detail-stat"><span>ربح متوقع للقطعة</span><strong class="${expected < 0 ? 'negative' : 'positive'}">${money.format(expected)}</strong></div>
        <div class="detail-stat"><span>كاش مبيعات المنتج</span><strong>${money.format(sales.cash)}</strong></div>
        <div class="detail-stat"><span>إجمالي ربح المنتج</span><strong class="${sales.profit < 0 ? 'negative' : 'positive'}">${money.format(sales.profit)}</strong></div>
        <div class="detail-stat"><span>القطع المباعة</span><strong>${numberFmt.format(sales.quantity)}</strong></div>
      </div>
      <div class="detail-actions"><button class="btn secondary" type="button" data-product-action="edit-full" data-product-id="${product.id}">تعديل بيانات المنتج</button><button class="btn ghost" type="button" data-product-action="restock" data-product-id="${product.id}">إضافة مخزون</button></div>
      <h4 class="movement-title">كل حركات المنتج</h4><div class="movement-list">${movements.length ? movements.map(movementCard).join('') : '<div class="empty-state"><strong>مفيش حركات لسه</strong><span>أي شراء أو بيع أو تشغيل هيتسجل هنا.</span></div>'}</div>`, 'تفاصيل المنتج');
  }

  function openFullEdit(product) {
    openSheet('تعديل بيانات المنتج', `<form id="editProductForm" class="entry-form" data-product-id="${product.id}">
      <label class="field field-wide"><span>اسم المنتج</span><input id="editProductName" type="text" maxlength="80" required value="${escapeHtml(product.name)}" /></label>
      <label class="field field-wide"><span>صورة جديدة <em>اختياري</em></span><input id="editProductImage" type="file" accept="image/*" data-image-input="editProductImagePreview" /><div id="editProductImagePreview" class="image-preview">${product.imageData ? `<img src="${safeImageSrc(product.imageData)}" alt="" />` : 'مفيش صورة حالية'}</div></label>
      <label class="field field-wide"><span>سعر البيع المحفوظ</span><div class="money-input"><input id="editProductSellingPrice" type="number" min="0" step="0.01" inputmode="decimal" required value="${product.sellingPrice}" /><b>ج.م</b></div></label>
      <div class="sheet-summary field-wide">آخر سعر شراء الحالي ${money.format(product.currentCost)}. تغييره من «إضافة مخزون».</div>
      <div class="form-actions field-wide"><button class="btn secondary" type="button" data-product-sheet-close>إلغاء</button><button class="btn primary" type="submit">حفظ التعديل</button></div>
    </form>`, 'تعديل كامل');
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
      const maxSide = 360;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
      let data = canvas.toDataURL('image/webp', 0.66);
      if (!data.startsWith('data:image/webp')) data = canvas.toDataURL('image/jpeg', 0.66);
      return data;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function addMovement(payload) {
    state.inventoryMovements.push({ id: uid(), createdAt: nowIso(), ...payload });
  }

  function finishPersist(result, normalMessage) {
    if (!result.ok) {
      showToast('تعذر حفظ المنتج على الجهاز. جرّب مساحة تخزين المتصفح.');
      return false;
    }
    closeSheet();
    renderAll();
    if (result.safetyOnly) showToast('تم حفظ بيانات المخزن في نسخة الأمان المحلية');
    else if (result.imageDropped) showToast('تم الحفظ بدون الصورة عشان مساحة الجهاز');
    else showToast(normalMessage);
    return true;
  }

  $('addProductBtn')?.addEventListener('click', openAddProduct);

  document.addEventListener('input', (event) => {
    if (event.target.id === 'saleQty' || event.target.id === 'salePrice') {
      const product = productById(event.target.closest('#sellProductForm')?.dataset.productId);
      if (product) updateSalePreview(product);
    }
    if (event.target.id === 'consumeQty') {
      const product = productById(event.target.closest('#consumeProductForm')?.dataset.productId);
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
      preview.innerHTML = input._compressedImage ? `<img src="${input._compressedImage}" alt="معاينة الصورة" />` : 'تعذر قراءة الصورة';
    } catch {
      input._compressedImage = '';
      preview.textContent = 'الصورة مش هتتحفظ، لكن المنتج نفسه هيتحفظ';
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-product-sheet-close]')) return closeSheet();
    const openId = event.target.closest('[data-open-product]')?.dataset.openProduct;
    if (openId) {
      const product = productById(openId);
      if (product) openDetails(product);
      return;
    }
    const button = event.target.closest('[data-product-action]');
    if (!button) return;
    const product = productById(button.dataset.productId);
    if (!product) return;
    if (button.dataset.productAction === 'sale') return product.quantity > 0 ? openSale(product) : showToast('المنتج خلص من المخزن');
    if (button.dataset.productAction === 'consume') return product.quantity > 0 ? openConsumption(product) : showToast('المنتج خلص من المخزن');
    if (button.dataset.productAction === 'restock') return openRestock(product);
    if (button.dataset.productAction === 'edit-price') return openEditPrice(product);
    if (button.dataset.productAction === 'edit-full') return openFullEdit(product);
  });

  document.addEventListener('submit', (event) => {
    if (event.target.id === 'createProductForm') {
      event.preventDefault();
      const name = $('newProductName').value.trim();
      const quantity = Math.trunc(num($('newProductQty').value));
      const currentCost = num($('newProductCost').value);
      const sellingPrice = num($('newProductSellingPrice').value);
      const date = $('newProductDate').value;
      if (!name) return showToast('اكتب اسم المنتج');
      if (quantity < 0 || currentCost < 0 || sellingPrice < 0 || !date) return showToast('راجع العدد والأسعار والتاريخ');

      const createdAt = nowIso();
      const product = normalizeProduct({ id: uid(), name, quantity, currentCost, sellingPrice, imageData: $('newProductImage')._compressedImage || '', createdAt, updatedAt: createdAt });
      state.products.push(product);
      if (quantity > 0) addMovement({ productId: product.id, type: 'purchase', date, quantity, unitCost: product.currentCost, totalCost: round(quantity * product.currentCost) });
      finishPersist(persistInventory(product), 'تم إضافة المنتج وحفظه');
      return;
    }

    const product = productById(event.target.dataset.productId);
    if (!product) return;

    if (event.target.id === 'restockProductForm') {
      event.preventDefault();
      const quantity = Math.trunc(num($('restockQty').value));
      const unitCost = num($('restockCost').value);
      const date = $('restockDate').value;
      if (quantity <= 0 || unitCost < 0 || !date) return showToast('راجع العدد وسعر الشراء والتاريخ');
      product.quantity += quantity;
      product.currentCost = round(unitCost);
      touchProduct(product);
      addMovement({ productId: product.id, type: 'purchase', date, quantity, unitCost: product.currentCost, totalCost: round(quantity * product.currentCost) });
      finishPersist(persistInventory(product), 'تمت إضافة المخزون وحفظه');
      return;
    }

    if (event.target.id === 'sellProductForm') {
      event.preventDefault();
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
      touchProduct(product);
      addMovement({ productId: product.id, type: 'sale', date, quantity, unitCost, unitPrice: round(unitPrice), totalCost, revenue, profit });
      finishPersist(persistInventory(product), `تم تسجيل البيع • الربح ${money.format(profit)}`);
      return;
    }

    if (event.target.id === 'consumeProductForm') {
      event.preventDefault();
      const quantity = Math.trunc(num($('consumeQty').value));
      const date = $('consumeDate').value;
      if (quantity <= 0 || quantity > product.quantity) return showToast('العدد المستخدم أكبر من الموجود أو غير صحيح');
      if (!date) return showToast('اختار التاريخ');
      const unitCost = round(product.currentCost);
      const totalCost = round(quantity * unitCost);
      product.quantity -= quantity;
      touchProduct(product);
      addMovement({ productId: product.id, type: 'consumption', date, quantity, unitCost, totalCost });
      finishPersist(persistInventory(product), `تم تسجيل الاستهلاك ${money.format(totalCost)}`);
      return;
    }

    if (event.target.id === 'editProductPriceForm') {
      event.preventDefault();
      const price = num($('quickSellingPrice').value);
      if (price < 0) return showToast('اكتب سعر صحيح');
      product.sellingPrice = round(price);
      touchProduct(product);
      finishPersist(persistInventory(product), 'تم تعديل سعر البيع وحفظه');
      return;
    }

    if (event.target.id === 'editProductForm') {
      event.preventDefault();
      const name = $('editProductName').value.trim();
      const sellingPrice = num($('editProductSellingPrice').value);
      if (!name || sellingPrice < 0) return showToast('راجع اسم المنتج وسعر البيع');
      product.name = name;
      product.sellingPrice = round(sellingPrice);
      const newImage = $('editProductImage')._compressedImage || '';
      if (newImage) product.imageData = newImage;
      touchProduct(product);
      finishPersist(persistInventory(product), 'تم تعديل بيانات المنتج وحفظها');
    }
  });

  ensureInventoryState();
  renderAll();
})();