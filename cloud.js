(() => {
  const SUPABASE_URL = 'https://rsabmbljhjsfvadhrsti.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mJ1inYR92B_lks91qFqXOw_hFGnExBD';
  const LEGACY_KEY = '5areta-shop-v1';
  const INVENTORY_SAFETY_KEY = '5areta-inventory-safety-v1';
  const PENDING_KEY = '5areta-cloud-pending-v1';
  const BASE_KEY = '5areta-cloud-base-v1';
  const MIGRATION_KEY = 'initial_migration_completed';
  const POLL_MS = 12000;

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

  let syncTimer = null;
  let polling = null;
  let syncing = false;
  let loadingRemote = false;
  let lastSyncedState = null;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const n = (v) => Number(v || 0);
  const nowIso = () => new Date().toISOString();

  function showGate(title = 'جاري الاتصال ببيانات المحل', text = 'ثواني ونجهز كل حاجة...') {
    let gate = document.getElementById('cloudGate');
    if (!gate) {
      gate = document.createElement('div');
      gate.id = 'cloudGate';
      gate.innerHTML = `
        <style>
          #cloudGate{position:fixed;inset:0;z-index:99999;background:rgba(8,12,18,.92);backdrop-filter:blur(10px);display:grid;place-items:center;padding:20px;direction:rtl;font-family:inherit}
          #cloudGateCard{width:min(420px,100%);background:#151c26;border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:24px;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.45)}
          #cloudGateCard h2{margin:0 0 8px;font-size:22px} #cloudGateCard p{margin:0;color:#aeb8c6;line-height:1.7}
          #cloudPinForm{margin-top:20px;display:grid;gap:12px} #cloudPin{width:100%;box-sizing:border-box;text-align:center;letter-spacing:10px;font-size:28px;font-weight:800;padding:14px;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#0e141d;color:#fff;outline:none}
          #cloudPin:focus{border-color:#d7b56d} #cloudPinBtn{border:0;border-radius:14px;padding:14px;font:inherit;font-weight:800;background:#d7b56d;color:#17120a;cursor:pointer}
          #cloudGateError{min-height:22px;color:#ff8d8d;font-size:14px}
          #cloudSpinner{width:34px;height:34px;border:3px solid rgba(255,255,255,.15);border-top-color:#d7b56d;border-radius:50%;animation:cloudSpin .8s linear infinite;margin-bottom:16px}
          @keyframes cloudSpin{to{transform:rotate(360deg)}}
        </style>
        <div id="cloudGateCard">
          <div id="cloudSpinner"></div>
          <h2 id="cloudGateTitle"></h2>
          <p id="cloudGateText"></p>
          <div id="cloudGateSlot"></div>
        </div>`;
      document.body.appendChild(gate);
    }
    document.getElementById('cloudGateTitle').textContent = title;
    document.getElementById('cloudGateText').textContent = text;
    document.getElementById('cloudGateSlot').innerHTML = '';
    document.getElementById('cloudSpinner').hidden = false;
    gate.hidden = false;
  }

  function hideGate() {
    const gate = document.getElementById('cloudGate');
    if (gate) gate.hidden = true;
  }

  function showPinGate() {
    showGate('كود المحل', 'الجهاز ده جديد. اكتب كود المحل مرة واحدة بس.');
    document.getElementById('cloudSpinner').hidden = true;
    const slot = document.getElementById('cloudGateSlot');
    slot.innerHTML = `
      <form id="cloudPinForm">
        <input id="cloudPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="••••••" aria-label="كود المحل" />
        <button id="cloudPinBtn" type="submit">فتح المحل</button>
        <div id="cloudGateError" role="alert"></div>
      </form>`;
    setTimeout(() => document.getElementById('cloudPin')?.focus(), 80);
    return new Promise((resolve, reject) => {
      document.getElementById('cloudPinForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const pin = document.getElementById('cloudPin').value.trim();
        const errorEl = document.getElementById('cloudGateError');
        if (!/^\d{6}$/.test(pin)) {
          errorEl.textContent = 'اكتب 6 أرقام.';
          return;
        }
        const btn = document.getElementById('cloudPinBtn');
        btn.disabled = true;
        btn.textContent = 'جاري التحقق...';
        errorEl.textContent = '';
        try {
          const { data, error } = await client.functions.invoke('verify-device', { body: { pin } });
          if (error) {
            const message = data?.error || error?.context?.body?.error || '';
            if (message === 'too_many_attempts') errorEl.textContent = 'محاولات كتير. استنى 15 دقيقة وجرب تاني.';
            else if (message === 'wrong_pin') errorEl.textContent = `الكود مش صحيح${data?.remaining != null ? ` — باقي ${data.remaining} محاولات` : ''}.`;
            else errorEl.textContent = 'تعذر التحقق من الكود. جرّب تاني.';
            return;
          }
          if (!data?.ok) {
            errorEl.textContent = 'تعذر اعتماد الجهاز.';
            return;
          }
          resolve(true);
        } catch (err) {
          errorEl.textContent = navigator.onLine ? 'حصل خطأ في الاتصال.' : 'مفيش إنترنت. محتاجين نتصل أول مرة لاعتماد الجهاز.';
        } finally {
          btn.disabled = false;
          btn.textContent = 'فتح المحل';
        }
      });
    });
  }

  async function ensureSessionAndApproval() {
    let { data: { session } } = await client.auth.getSession();
    if (!session) {
      const { data, error } = await client.auth.signInAnonymously();
      if (error) throw new Error('anonymous_auth:' + error.message);
      session = data.session;
    }
    const userId = session?.user?.id;
    if (!userId) throw new Error('missing_user');

    const { data, error } = await client
      .from('authorized_devices')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      await showPinGate();
    }
    return session;
  }

  function dataUrlToBlob(dataUrl) {
    const match = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl || '');
    if (!match) return null;
    const bytes = atob(match[2]);
    const array = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
    return new Blob([array], { type: match[1] });
  }

  function extForMime(mime) {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    return 'jpg';
  }

  async function uploadImageIfNeeded(product) {
    const imageData = String(product.imageData || '');
    if (!imageData.startsWith('data:image/')) return product.imagePath || '';
    const blob = dataUrlToBlob(imageData);
    if (!blob) return product.imagePath || '';
    const path = `${product.id}/${Date.now()}.${extForMime(blob.type)}`;
    const { error } = await client.storage.from('product-images').upload(path, blob, {
      contentType: blob.type,
      upsert: false,
      cacheControl: '3600'
    });
    if (error) throw error;
    product.imagePath = path;
    return path;
  }

  async function signedImage(path) {
    if (!path) return '';
    const { data, error } = await client.storage.from('product-images').createSignedUrl(path, 60 * 60 * 24 * 7);
    return error ? '' : (data?.signedUrl || '');
  }

  function dayToDb(d) {
    return {
      id: String(d.id),
      date: d.date,
      customers: Math.max(0, Math.trunc(n(d.customers))),
      revenue: n(d.revenue),
      operating: n(d.operating),
      worker: n(d.worker),
      personal: n(d.personal),
      notes: String(d.notes || ''),
      updated_at: nowIso()
    };
  }

  function withdrawalToDb(w) {
    return {
      id: String(w.id),
      date: w.date,
      amount: n(w.amount),
      reason: String(w.reason || ''),
      notes: String(w.notes || ''),
      updated_at: nowIso()
    };
  }

  async function productToDb(p) {
    const imagePath = await uploadImageIfNeeded(p);
    return {
      id: String(p.id),
      name: String(p.name || 'منتج'),
      quantity: Math.max(0, Math.trunc(n(p.quantity))),
      current_cost: n(p.currentCost),
      selling_price: n(p.sellingPrice),
      image_path: imagePath,
      created_at: p.createdAt || nowIso(),
      updated_at: p.updatedAt || nowIso()
    };
  }

  function movementToDb(m) {
    return {
      id: String(m.id),
      product_id: String(m.productId),
      type: m.type,
      date: m.date,
      quantity: Math.max(1, Math.trunc(n(m.quantity))),
      unit_cost: n(m.unitCost),
      unit_price: m.unitPrice == null ? null : n(m.unitPrice),
      total_cost: n(m.totalCost),
      revenue: m.revenue == null ? null : n(m.revenue),
      profit: m.profit == null ? null : n(m.profit),
      created_at: m.createdAt || nowIso(),
      updated_at: nowIso()
    };
  }

  function entityMap(items) {
    return new Map((items || []).map((item) => [String(item.id), item]));
  }

  function same(a, b) {
    if (a === b) return true;
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }

  function changedItems(current, base) {
    const baseMap = entityMap(base);
    return (current || []).filter((item) => !same(item, baseMap.get(String(item.id))));
  }

  function deletedIds(current, base) {
    const currentIds = new Set((current || []).map((item) => String(item.id)));
    return (base || []).map((item) => String(item.id)).filter((id) => !currentIds.has(id));
  }

  async function upsertMany(table, rows) {
    if (!rows.length) return;
    const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function deleteMany(table, ids) {
    if (!ids.length) return;
    const { error } = await client.from(table).delete().in('id', ids);
    if (error) throw error;
  }

  async function syncSnapshot(snapshot, base = lastSyncedState) {
    if (syncing || !window.__5ARETA_CLOUD_ACTIVE__ || !navigator.onLine) return false;
    syncing = true;
    try {
      const before = base || { settings: {}, days: [], withdrawals: [], products: [], inventoryMovements: [] };

      if (!same(snapshot.settings, before.settings)) {
        const { error } = await client.from('app_settings').upsert({
          id: 1,
          opening_vault: n(snapshot.settings?.openingVault),
          low_stock_threshold: 3,
          updated_at: nowIso()
        });
        if (error) throw error;
      }

      const changedProducts = changedItems(snapshot.products, before.products);
      const productRows = [];
      for (const product of changedProducts) productRows.push(await productToDb(product));
      await upsertMany('products', productRows);
      await deleteMany('products', deletedIds(snapshot.products, before.products));

      await upsertMany('days', changedItems(snapshot.days, before.days).map(dayToDb));
      await deleteMany('days', deletedIds(snapshot.days, before.days));

      await upsertMany('withdrawals', changedItems(snapshot.withdrawals, before.withdrawals).map(withdrawalToDb));
      await deleteMany('withdrawals', deletedIds(snapshot.withdrawals, before.withdrawals));

      await upsertMany('inventory_movements', changedItems(snapshot.inventoryMovements, before.inventoryMovements).map(movementToDb));
      await deleteMany('inventory_movements', deletedIds(snapshot.inventoryMovements, before.inventoryMovements));

      lastSyncedState = clone(snapshot);
      localStorage.setItem(BASE_KEY, JSON.stringify(lastSyncedState));
      localStorage.removeItem(PENDING_KEY);
      return true;
    } catch (error) {
      console.error('Cloud sync failed', error);
      return false;
    } finally {
      syncing = false;
    }
  }

  window.cloudSaveState = (nextState) => {
    const snapshot = clone(nextState || state);
    try { localStorage.setItem(PENDING_KEY, JSON.stringify(snapshot)); } catch {}
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => syncSnapshot(snapshot), 180);
  };

  async function fetchCloudState() {
    const [settingsRes, daysRes, withdrawalsRes, productsRes, movementsRes] = await Promise.all([
      client.from('app_settings').select('*').eq('id', 1).single(),
      client.from('days').select('*').order('date', { ascending: true }),
      client.from('withdrawals').select('*').order('date', { ascending: true }),
      client.from('products').select('*').order('created_at', { ascending: true }),
      client.from('inventory_movements').select('*').order('created_at', { ascending: true })
    ]);

    for (const res of [settingsRes, daysRes, withdrawalsRes, productsRes, movementsRes]) {
      if (res.error) throw res.error;
    }

    const products = [];
    for (const p of productsRes.data || []) {
      products.push({
        id: p.id,
        name: p.name,
        quantity: n(p.quantity),
        currentCost: n(p.current_cost),
        sellingPrice: n(p.selling_price),
        imagePath: p.image_path || '',
        imageData: await signedImage(p.image_path),
        createdAt: p.created_at,
        updatedAt: p.updated_at
      });
    }

    return {
      version: 3,
      settings: {
        openingVault: n(settingsRes.data?.opening_vault),
        lowStockThreshold: 3
      },
      days: (daysRes.data || []).map((d) => ({
        id: d.id, date: d.date, customers: n(d.customers), revenue: n(d.revenue),
        operating: n(d.operating), worker: n(d.worker), personal: n(d.personal), notes: d.notes || ''
      })),
      withdrawals: (withdrawalsRes.data || []).map((w) => ({
        id: w.id, date: w.date, amount: n(w.amount), reason: w.reason || '', notes: w.notes || ''
      })),
      products,
      inventoryMovements: (movementsRes.data || []).map((m) => ({
        id: m.id, productId: m.product_id, type: m.type, date: m.date,
        quantity: n(m.quantity), unitCost: n(m.unit_cost),
        unitPrice: m.unit_price == null ? undefined : n(m.unit_price),
        totalCost: n(m.total_cost),
        revenue: m.revenue == null ? undefined : n(m.revenue),
        profit: m.profit == null ? undefined : n(m.profit),
        createdAt: m.created_at
      }))
    };
  }

  function applyDiffOntoRemote(remote, pending, base) {
    const result = clone(remote);
    if (!base) return clone(pending);

    if (!same(pending.settings, base.settings)) result.settings = clone(pending.settings);

    for (const key of ['days', 'withdrawals', 'products', 'inventoryMovements']) {
      const resultMap = entityMap(result[key]);
      const baseMap = entityMap(base[key]);
      const pendingMap = entityMap(pending[key]);

      for (const [id, item] of pendingMap) {
        if (!same(item, baseMap.get(id))) resultMap.set(id, clone(item));
      }
      for (const id of baseMap.keys()) {
        if (!pendingMap.has(id)) resultMap.delete(id);
      }
      result[key] = [...resultMap.values()];
    }
    return result;
  }

  async function migrateLegacyIfNeeded() {
    const { data: meta, error } = await client.from('app_meta').select('value').eq('key', MIGRATION_KEY).maybeSingle();
    if (error) throw error;
    if (meta) return false;

    const hasLegacy = !!localStorage.getItem(LEGACY_KEY);
    if (!hasLegacy) {
      await client.from('app_meta').upsert({ key: MIGRATION_KEY, value: { at: nowIso(), source: 'empty' }, updated_at: nowIso() });
      return false;
    }

    showGate('بننقل بياناتك للسحابة', 'سيب الصفحة مفتوحة لحد ما نتأكد إن كل حاجة وصلت.');
    const snapshot = clone(state);

    const { error: settingsError } = await client.from('app_settings').upsert({
      id: 1, opening_vault: n(snapshot.settings?.openingVault), low_stock_threshold: 3, updated_at: nowIso()
    });
    if (settingsError) throw settingsError;

    const productRows = [];
    for (const product of snapshot.products || []) productRows.push(await productToDb(product));
    await upsertMany('products', productRows);
    await upsertMany('days', (snapshot.days || []).map(dayToDb));
    await upsertMany('withdrawals', (snapshot.withdrawals || []).map(withdrawalToDb));
    await upsertMany('inventory_movements', (snapshot.inventoryMovements || []).map(movementToDb));

    const verification = await Promise.all([
      client.from('days').select('id', { count: 'exact', head: true }),
      client.from('withdrawals').select('id', { count: 'exact', head: true }),
      client.from('products').select('id', { count: 'exact', head: true }),
      client.from('inventory_movements').select('id', { count: 'exact', head: true })
    ]);
    if (verification.some((r) => r.error)) throw new Error('migration_verification_failed');
    const expected = [snapshot.days?.length || 0, snapshot.withdrawals?.length || 0, snapshot.products?.length || 0, snapshot.inventoryMovements?.length || 0];
    if (verification.some((r, i) => (r.count || 0) < expected[i])) throw new Error('migration_count_mismatch');

    const { error: metaError } = await client.from('app_meta').upsert({
      key: MIGRATION_KEY,
      value: { at: nowIso(), source: 'localStorage', counts: expected },
      updated_at: nowIso()
    });
    if (metaError) throw metaError;

    localStorage.removeItem(LEGACY_KEY);
    localStorage.removeItem(INVENTORY_SAFETY_KEY);
    return true;
  }

  async function reloadFromCloudIfClean() {
    if (loadingRemote || syncing || !navigator.onLine || localStorage.getItem(PENDING_KEY)) return;
    loadingRemote = true;
    try {
      const remote = await fetchCloudState();
      if (!same(remote, lastSyncedState)) {
        state = remote;
        lastSyncedState = clone(remote);
        localStorage.setItem(BASE_KEY, JSON.stringify(lastSyncedState));
        renderAll();
      }
    } catch (error) {
      console.warn('Background cloud refresh failed', error);
    } finally {
      loadingRemote = false;
    }
  }

  async function initializeCloud() {
    showGate();
    try {
      await ensureSessionAndApproval();
      await migrateLegacyIfNeeded();

      let remote = await fetchCloudState();
      let cachedBase = null;
      let pending = null;
      try { cachedBase = JSON.parse(localStorage.getItem(BASE_KEY) || 'null'); } catch {}
      try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null'); } catch {}

      lastSyncedState = clone(remote);
      state = pending ? applyDiffOntoRemote(remote, pending, cachedBase) : remote;
      window.__5ARETA_CLOUD_ACTIVE__ = true;

      localStorage.removeItem(LEGACY_KEY);
      localStorage.removeItem(INVENTORY_SAFETY_KEY);
      renderAll();
      localStorage.setItem(BASE_KEY, JSON.stringify(lastSyncedState));
      hideGate();

      if (pending) await syncSnapshot(clone(state), lastSyncedState);

      window.addEventListener('online', () => {
        const queued = localStorage.getItem(PENDING_KEY);
        if (queued) {
          try { syncSnapshot(JSON.parse(queued), lastSyncedState); } catch {}
        } else {
          reloadFromCloudIfClean();
        }
      });

      polling = setInterval(reloadFromCloudIfClean, POLL_MS);
    } catch (error) {
      console.error('Cloud initialization failed', error);
      showGate('تعذر الاتصال ببيانات المحل', navigator.onLine
        ? 'راجع إعداد Supabase أو جرّب إعادة تحميل الصفحة.'
        : 'أول تشغيل على الجهاز محتاج إنترنت. وصل النت واعمل إعادة تحميل.');
      document.getElementById('cloudSpinner').hidden = true;
    }
  }

  initializeCloud();
})();