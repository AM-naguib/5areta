(() => {
  const SUPABASE_URL = 'https://rsabmbljhjsfvadhrsti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mJ1inYR92B_lks91qFqXOw_hFGnExBD';
  const STORAGE_KEY = '5areta-shop-v1';
  const PENDING_KEY = '5areta-cloud-pending-v1';
  const BASE_KEY = '5areta-cloud-base-v2';
  const LEGACY_BASE_KEY = '5areta-cloud-base-v1';
  const SITE_UNLOCKED_KEY = '5areta-site-unlocked-v1';
  const POLL_MS = 20000;

  function installDayDuplicateGuard() {
    document.addEventListener('submit', async (event) => {
      if (event.target?.id !== 'dayForm') return;
      if (typeof state === 'undefined' || !Array.isArray(state.days)) return;

      const editingId = document.getElementById('editingDayId')?.value || '';
      const date = document.getElementById('dayDate')?.value || '';
      if (!date) return;

      const duplicate = state.days.find((day) => day.date === date && day.id !== editingId);
      if (!duplicate) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const ok = typeof confirmAction === 'function'
        ? await confirmAction(
            'اليوم متسجل بالفعل',
            `في تسجيل موجود بالفعل بتاريخ ${date}. اضغط تأكيد عشان نفتح اليوم الموجود للتعديل بدل ما نعمل نسخة مكررة.`
          )
        : false;

      if (!ok) return;

      const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value ?? '';
      };

      setValue('editingDayId', duplicate.id);
      setValue('dayDate', duplicate.date);
      setValue('customers', duplicate.customers);
      setValue('revenue', duplicate.revenue);
      setValue('operating', duplicate.operating);
      setValue('worker', duplicate.worker);
      setValue('personal', duplicate.personal);
      setValue('dayNotes', duplicate.notes || '');

      const cancel = document.getElementById('cancelEditBtn');
      const save = document.getElementById('saveDayBtn');
      if (cancel) cancel.hidden = false;
      if (save) save.textContent = 'حفظ التعديل';

      if (typeof updateLiveCalc === 'function') updateLiveCalc();
      if (typeof switchView === 'function') switchView('dashboard');
      document.querySelector('.quick-entry')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof showToast === 'function') showToast('فتحت اليوم الموجود للتعديل');
    }, true);
  }

  installDayDuplicateGuard();

  if (!window.supabase?.createClient) {
    console.error('Supabase client failed to load');
    return;
  }

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    }
  });

  window.supabaseClient = client;

  let syncing = false;
  let refreshing = false;
  let syncTimer = null;
  let pollTimer = null;
  let lastBase = null;
  let localRevision = 0;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const n = (value) => Number(value || 0);
  const nowIso = () => new Date().toISOString();

  function notify(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
    else console.info(message);
  }

  function safeParse(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  function same(a, b) {
    if (a === b) return true;
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }

  function mapById(items) {
    return new Map((items || []).map((item) => [String(item.id), item]));
  }

  function readBase() {
    return safeParse(BASE_KEY) || safeParse(LEGACY_BASE_KEY);
  }

  function persistBase(base) {
    lastBase = clone(base);
    localStorage.setItem(BASE_KEY, JSON.stringify(lastBase));
    localStorage.removeItem(LEGACY_BASE_KEY);
  }

  function removeSiteGate() {
    document.getElementById('siteAccessGate')?.remove();
    document.documentElement.classList.remove('site-access-locked');
  }

  function showSiteGate(message = '') {
    document.documentElement.classList.add('site-access-locked');
    let gate = document.getElementById('siteAccessGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'siteAccessGate';
      gate.innerHTML = `
        <style>
          html.site-access-locked body > *:not(#siteAccessGate){visibility:hidden!important}
          #siteAccessGate{visibility:visible!important;position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;background:#0d1420;color:#fff;direction:rtl;font-family:inherit}
          #siteAccessCard{width:min(420px,100%);box-sizing:border-box;border-radius:28px;padding:30px 24px;background:#151e2d;border:1px solid rgba(255,255,255,.09);box-shadow:0 28px 90px rgba(0,0,0,.45);text-align:right}
          #siteAccessBrand{font-size:13px;font-weight:800;letter-spacing:.18em;color:#aab4c4;margin:0 0 14px}
          #siteAccessCard h2{margin:0 0 8px;font-size:30px;line-height:1.25}
          #siteAccessCard p{margin:0;color:#aeb8c7;line-height:1.7}
          #siteAccessForm{display:grid;gap:12px;margin-top:24px}
          #sitePassword{box-sizing:border-box;width:100%;padding:15px 16px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:#0d1420;color:#fff;font:inherit;font-size:20px;outline:none;text-align:center;direction:ltr}
          #sitePassword:focus{border-color:#d7b56d;box-shadow:0 0 0 3px rgba(215,181,109,.12)}
          #siteAccessButton{border:0;border-radius:16px;padding:15px 18px;background:#d7b56d;color:#17120a;font:inherit;font-weight:900;cursor:pointer}
          #siteAccessButton:disabled{opacity:.65;cursor:wait}
          #siteAccessError{min-height:22px;color:#ff9b9b;font-size:14px;text-align:center}
        </style>
        <div id="siteAccessCard">
          <p id="siteAccessBrand">5ARETA</p>
          <h2>دخول المحل</h2>
          <p>اكتب باسورد الموقع. على نفس المتصفح هيتحفظ اعتمادك ومش هنطلبه كل مرة.</p>
          <form id="siteAccessForm">
            <input id="sitePassword" type="password" autocomplete="current-password" maxlength="80" required placeholder="الباسورد" aria-label="باسورد الموقع" />
            <button id="siteAccessButton" type="submit">دخول</button>
            <div id="siteAccessError" role="alert"></div>
          </form>
        </div>`;
      document.body.appendChild(gate);
    }
    const error = document.getElementById('siteAccessError');
    if (error) error.textContent = message;
    setTimeout(() => document.getElementById('sitePassword')?.focus(), 80);
    return gate;
  }

  async function requestPassword() {
    showSiteGate();

    return new Promise((resolve) => {
      const form = document.getElementById('siteAccessForm');
      const input = document.getElementById('sitePassword');
      const button = document.getElementById('siteAccessButton');
      const errorEl = document.getElementById('siteAccessError');

      form.onsubmit = async (event) => {
        event.preventDefault();
        const password = String(input.value || '');
        if (!password) return;

        if (!navigator.onLine) {
          errorEl.textContent = 'محتاج إنترنت أول مرة عشان نتحقق من الباسورد.';
          return;
        }

        button.disabled = true;
        button.textContent = 'جاري الدخول...';
        errorEl.textContent = '';

        try {
          const { data, error } = await client.functions.invoke('unlock-site', {
            body: { password }
          });

          if (error || !data?.ok) {
            const status = error?.context?.status;
            if (status === 403) errorEl.textContent = 'الباسورد غلط.';
            else if (status === 429) errorEl.textContent = 'محاولات كتير. استنى 15 دقيقة وجرب تاني.';
            else errorEl.textContent = 'تعذر الدخول دلوقتي. جرّب تاني.';
            return;
          }

          localStorage.setItem(SITE_UNLOCKED_KEY, '1');
          input.value = '';
          removeSiteGate();
          resolve(true);
        } catch (error) {
          console.error('Site unlock failed', error);
          errorEl.textContent = 'تعذر الاتصال. جرّب تاني.';
        } finally {
          button.disabled = false;
          button.textContent = 'دخول';
        }
      };
    });
  }

  async function ensureApprovedSession() {
    const remembered = localStorage.getItem(SITE_UNLOCKED_KEY) === '1';
    let { data: { session } } = await client.auth.getSession();

    if (!session) {
      if (!navigator.onLine && remembered) return { allowed: true, cloudReady: false };
      const { data, error } = await client.auth.signInAnonymously();
      if (error) {
        if (remembered) return { allowed: true, cloudReady: false };
        throw error;
      }
      session = data.session;
    }

    const userId = session?.user?.id;
    if (!userId) {
      if (remembered) return { allowed: true, cloudReady: false };
      throw new Error('missing_session_user');
    }

    if (!navigator.onLine) {
      if (remembered) return { allowed: true, cloudReady: false };
      showSiteGate('محتاج إنترنت أول مرة عشان نتحقق من الباسورد.');
      return { allowed: false, cloudReady: false };
    }

    const { data, error } = await client
      .from('authorized_devices')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      if (remembered) return { allowed: true, cloudReady: false };
      throw error;
    }

    if (data) {
      localStorage.setItem(SITE_UNLOCKED_KEY, '1');
      removeSiteGate();
      return { allowed: true, cloudReady: true };
    }

    const unlocked = await requestPassword();
    return { allowed: !!unlocked, cloudReady: !!unlocked };
  }

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl || '');
    if (!match) return null;
    const bytes = atob(match[2]);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i);
    return new Blob([array], { type: match[1] });
  }

  function extForMime(mime) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  async function signedImage(path) {
    if (!path) return '';
    const { data, error } = await client.storage
      .from('product-images')
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    return error ? '' : (data?.signedUrl || '');
  }

  async function prepareProduct(product) {
    const copy = { ...product };
    const imageData = String(copy.imageData || '');

    if (imageData.startsWith('data:image/')) {
      const blob = dataUrlToBlob(imageData);
      if (blob) {
        const path = copy.imagePath || `${copy.id}/image.${extForMime(blob.type)}`;
        const { error } = await client.storage.from('product-images').upload(path, blob, {
          contentType: blob.type,
          upsert: true,
          cacheControl: '3600'
        });
        if (error) throw error;
        copy.imagePath = path;
        copy.imageData = await signedImage(path);
      }
    }

    return copy;
  }

  function dayToDb(day) {
    return {
      id: String(day.id),
      date: day.date,
      customers: Math.max(0, Math.trunc(n(day.customers))),
      revenue: n(day.revenue),
      operating: n(day.operating),
      worker: n(day.worker),
      personal: n(day.personal),
      notes: String(day.notes || ''),
      updated_at: nowIso()
    };
  }

  function withdrawalToDb(item) {
    return {
      id: String(item.id),
      date: item.date,
      amount: n(item.amount),
      reason: String(item.reason || ''),
      notes: String(item.notes || ''),
      updated_at: nowIso()
    };
  }

  function productToDb(product) {
    return {
      id: String(product.id),
      name: String(product.name || 'منتج'),
      quantity: Math.max(0, Math.trunc(n(product.quantity))),
      current_cost: n(product.currentCost),
      selling_price: n(product.sellingPrice),
      image_path: String(product.imagePath || ''),
      created_at: product.createdAt || nowIso(),
      updated_at: product.updatedAt || nowIso()
    };
  }

  function movementToDb(movement) {
    return {
      id: String(movement.id),
      product_id: String(movement.productId),
      type: movement.type,
      date: movement.date,
      quantity: Math.max(1, Math.trunc(n(movement.quantity))),
      unit_cost: n(movement.unitCost),
      unit_price: movement.unitPrice == null ? null : n(movement.unitPrice),
      total_cost: n(movement.totalCost),
      revenue: movement.revenue == null ? null : n(movement.revenue),
      profit: movement.profit == null ? null : n(movement.profit),
      created_at: movement.createdAt || nowIso(),
      updated_at: nowIso()
    };
  }

  function diffCollection(current, base, allowDeletes = true) {
    const currentMap = mapById(current);
    const baseMap = mapById(base);
    const upserts = [];

    for (const [id, item] of currentMap) {
      if (!same(item, baseMap.get(id))) upserts.push(item);
    }

    const deletes = [];
    if (allowDeletes) {
      for (const id of baseMap.keys()) {
        if (!currentMap.has(id)) deletes.push(id);
      }
    }

    return { upserts, deletes };
  }

  function buildDelta(snapshot, base, allowDeletes = true) {
    const previous = base || {
      settings: {},
      days: [],
      withdrawals: [],
      products: [],
      inventoryMovements: []
    };

    return {
      settingsChanged: !same(snapshot.settings || {}, previous.settings || {}),
      days: diffCollection(snapshot.days, previous.days, allowDeletes && !!base),
      withdrawals: diffCollection(snapshot.withdrawals, previous.withdrawals, allowDeletes && !!base),
      products: diffCollection(snapshot.products, previous.products, allowDeletes && !!base),
      inventoryMovements: diffCollection(
        snapshot.inventoryMovements,
        previous.inventoryMovements,
        allowDeletes && !!base
      )
    };
  }

  function hasDelta(delta) {
    return delta.settingsChanged ||
      delta.days.upserts.length || delta.days.deletes.length ||
      delta.withdrawals.upserts.length || delta.withdrawals.deletes.length ||
      delta.products.upserts.length || delta.products.deletes.length ||
      delta.inventoryMovements.upserts.length || delta.inventoryMovements.deletes.length;
  }

  async function upsertRows(table, rows) {
    if (!rows.length) return;
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function deleteRows(table, ids) {
    if (!ids.length) return;
    const { error } = await client.from(table).delete().in('id', ids);
    if (error) throw error;
  }

  async function applyDelta(delta, snapshot) {
    const working = clone(snapshot);

    if (delta.settingsChanged) {
      const { error } = await client.from('app_settings').upsert({
        id: 1,
        opening_vault: n(working.settings?.openingVault),
        low_stock_threshold: 3,
        updated_at: nowIso()
      });
      if (error) throw error;
    }

    const preparedProducts = [];
    for (const product of delta.products.upserts) {
      preparedProducts.push(await prepareProduct(product));
    }

    if (preparedProducts.length) {
      const preparedById = mapById(preparedProducts);
      working.products = (working.products || []).map((product) =>
        preparedById.get(String(product.id)) || product
      );
      await upsertRows('products', preparedProducts.map(productToDb));
    }

    await upsertRows('days', delta.days.upserts.map(dayToDb));
    await upsertRows('withdrawals', delta.withdrawals.upserts.map(withdrawalToDb));
    await upsertRows('inventory_movements', delta.inventoryMovements.upserts.map(movementToDb));

    await deleteRows('inventory_movements', delta.inventoryMovements.deletes);
    await deleteRows('days', delta.days.deletes);
    await deleteRows('withdrawals', delta.withdrawals.deletes);
    await deleteRows('products', delta.products.deletes);

    return working;
  }

  function applyLocalChanges(remote, local, base) {
    const result = clone(remote);
    const previous = base || null;

    if (!previous || !same(local.settings || {}, previous.settings || {})) {
      result.settings = clone(local.settings || result.settings);
    }

    for (const key of ['days', 'withdrawals', 'products', 'inventoryMovements']) {
      const resultMap = mapById(result[key]);
      const localMap = mapById(local[key]);
      const baseMap = mapById(previous?.[key]);

      if (!previous) {
        for (const [id, item] of localMap) resultMap.set(id, clone(item));
      } else {
        for (const [id, item] of localMap) {
          if (!same(item, baseMap.get(id))) resultMap.set(id, clone(item));
        }
        for (const id of baseMap.keys()) {
          if (!localMap.has(id)) resultMap.delete(id);
        }
      }

      result[key] = [...resultMap.values()];
    }

    return result;
  }

  async function fetchCloudState() {
    const [settingsRes, daysRes, withdrawalsRes, productsRes, movementsRes] = await Promise.all([
      client.from('app_settings').select('*').eq('id', 1).single(),
      client.from('days').select('*').order('date', { ascending: true }),
      client.from('withdrawals').select('*').order('date', { ascending: true }),
      client.from('products').select('*').order('created_at', { ascending: true }),
      client.from('inventory_movements').select('*').order('created_at', { ascending: true })
    ]);

    for (const result of [settingsRes, daysRes, withdrawalsRes, productsRes, movementsRes]) {
      if (result.error) throw result.error;
    }

    const products = [];
    for (const product of productsRes.data || []) {
      products.push({
        id: product.id,
        name: product.name,
        quantity: n(product.quantity),
        currentCost: n(product.current_cost),
        sellingPrice: n(product.selling_price),
        imagePath: product.image_path || '',
        imageData: await signedImage(product.image_path),
        createdAt: product.created_at,
        updatedAt: product.updated_at
      });
    }

    return {
      version: 3,
      settings: {
        openingVault: n(settingsRes.data?.opening_vault),
        lowStockThreshold: 3
      },
      days: (daysRes.data || []).map((day) => ({
        id: day.id,
        date: day.date,
        customers: n(day.customers),
        revenue: n(day.revenue),
        operating: n(day.operating),
        worker: n(day.worker),
        personal: n(day.personal),
        notes: day.notes || ''
      })),
      withdrawals: (withdrawalsRes.data || []).map((item) => ({
        id: item.id,
        date: item.date,
        amount: n(item.amount),
        reason: item.reason || '',
        notes: item.notes || ''
      })),
      products,
      inventoryMovements: (movementsRes.data || []).map((movement) => ({
        id: movement.id,
        productId: movement.product_id,
        type: movement.type,
        date: movement.date,
        quantity: n(movement.quantity),
        unitCost: n(movement.unit_cost),
        unitPrice: movement.unit_price == null ? undefined : n(movement.unit_price),
        totalCost: n(movement.total_cost),
        revenue: movement.revenue == null ? undefined : n(movement.revenue),
        profit: movement.profit == null ? undefined : n(movement.profit),
        createdAt: movement.created_at
      }))
    };
  }

  async function syncSnapshot(input, baseOverride = lastBase, options = {}) {
    if (syncing || !window.__5ARETA_CLOUD_ACTIVE__ || !navigator.onLine) return false;
    syncing = true;

    const startedRevision = localRevision;
    const snapshot = clone(input || state);
    const base = baseOverride ? clone(baseOverride) : null;
    const allowDeletes = options.allowDeletes !== false;

    try {
      const delta = buildDelta(snapshot, base, allowDeletes);

      if (hasDelta(delta)) {
        await applyDelta(delta, snapshot);
      }

      const remote = await fetchCloudState();
      persistBase(remote);

      if (localRevision === startedRevision) {
        state = remote;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        localStorage.removeItem(PENDING_KEY);
        renderAll();
      } else {
        const latest = safeParse(PENDING_KEY) || clone(state);
        clearTimeout(syncTimer);
        syncTimer = setTimeout(() => syncSnapshot(latest, lastBase), 0);
      }

      return true;
    } catch (error) {
      console.error('Cloud save failed', error);
      notify('اتحفظ على الجهاز، والسحابة هتحاول تاني لما الاتصال يستقر');
      return false;
    } finally {
      syncing = false;
    }
  }

  window.cloudSaveState = (nextState) => {
    const snapshot = clone(nextState || state);
    localRevision += 1;
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify(snapshot));
    } catch {}

    clearTimeout(syncTimer);
    if (navigator.onLine) {
      syncTimer = setTimeout(() => syncSnapshot(snapshot, lastBase), 120);
    }
  };

  async function refreshFromCloud() {
    if (refreshing || syncing || !window.__5ARETA_CLOUD_ACTIVE__ || !navigator.onLine) return;
    if (localStorage.getItem(PENDING_KEY)) return;

    refreshing = true;
    try {
      const remote = await fetchCloudState();
      persistBase(remote);
      state = remote;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
    } catch (error) {
      console.warn('Cloud refresh failed', error);
    } finally {
      refreshing = false;
    }
  }

  async function syncPendingAgainstLatestRemote() {
    const pending = safeParse(PENDING_KEY);
    if (!pending || !navigator.onLine) {
      if (!pending) await refreshFromCloud();
      return;
    }

    const previousBase = lastBase || readBase();
    const remote = await fetchCloudState();
    const merged = applyLocalChanges(remote, pending, previousBase);

    persistBase(remote);
    state = merged;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderAll();

    await syncSnapshot(merged, remote, { allowDeletes: !!previousBase });
  }

  async function startCloudWork() {
    window.__5ARETA_CLOUD_ACTIVE__ = true;

    const previousBase = readBase();
    lastBase = previousBase ? clone(previousBase) : null;
    const pending = safeParse(PENDING_KEY);

    if (navigator.onLine) {
      const remote = await fetchCloudState();

      if (pending) {
        const merged = applyLocalChanges(remote, pending, previousBase);
        persistBase(remote);
        state = merged;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
        await syncSnapshot(merged, remote, { allowDeletes: !!previousBase });
      } else {
        persistBase(remote);
        state = remote;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
      }
    } else if (pending) {
      state = pending;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      renderAll();
    }

    window.addEventListener('online', () => {
      syncPendingAgainstLatestRemote().catch((error) => {
        console.warn('Online sync failed', error);
      });
    });

    if (!pollTimer) pollTimer = setInterval(refreshFromCloud, POLL_MS);
  }

  async function initializeCloud() {
    try {
      const access = await ensureApprovedSession();
      if (!access.allowed) return;

      removeSiteGate();

      if (!access.cloudReady) {
        window.__5ARETA_CLOUD_ACTIVE__ = false;
        window.addEventListener('online', () => location.reload(), { once: true });
        return;
      }

      await startCloudWork();
    } catch (error) {
      console.error('Cloud initialization failed', error);
      if (localStorage.getItem(SITE_UNLOCKED_KEY) === '1') {
        removeSiteGate();
        window.__5ARETA_CLOUD_ACTIVE__ = false;
        window.addEventListener('online', () => location.reload(), { once: true });
        return;
      }
      showSiteGate('تعذر التحقق دلوقتي. راجع الإنترنت وجرب تاني.');
    }
  }

  initializeCloud();
})();