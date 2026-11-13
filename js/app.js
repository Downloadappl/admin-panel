(function () {
  'use strict';

  // ===== Configuration =====
  const DEFAULT_API_BASE = 'https://apphub.khhjmwmmy.workers.dev';
  let API_BASE = (localStorage.getItem('apphub_api_base') || DEFAULT_API_BASE).replace(/\/$/, '');

  const state = {
    token: localStorage.getItem('apphub_admin_token') || '',
    admin: null,
    apps: [],
    categories: [],
    versions: [],
    settings: {},
    stats: null
  };

  // ===== Helpers =====
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtDate = (d) => d ? new Date(d).toLocaleString('ar-EG') : '—';
  const fmtSize = (bytes) => {
    const b = Number(bytes || 0);
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
    if (b < 1024*1024*1024) return (b/(1024*1024)).toFixed(1) + ' MB';
    return (b/(1024*1024*1024)).toFixed(2) + ' GB';
  };
  const toast = (msg, type = 'info') => {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.className = 'toast'; }, 3200);
  };

  async function api(path, opts = {}) {
    if (!API_BASE) throw new Error('لم يتم إعداد عنوان الخادم. افتح الإعدادات وأدخل الرابط.');
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const url = API_BASE.replace(/\/$/, '') + path;
    try {
      const res = await fetch(url, Object.assign({}, opts, { headers }));
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
      if (!res.ok) {
        const msg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
        const err = new Error(msg); err.status = res.status; err.data = data;
        throw err;
      }
      return data;
    } catch (e) {
      if (e.message === 'Failed to fetch') throw new Error('تعذر الاتصال بالخادم. تحقق من الرابط والاتصال.');
      throw e;
    }
  }

  // ===== View management =====
  function showView(name) {
    $$('.auth-screen, .app-shell, .panel-view').forEach(v => {
      if (v.classList.contains('panel-view')) {
        v.setAttribute('aria-hidden', v.id === name ? 'false' : 'true');
      }
    });
    // Auth screens
    ['configView', 'loginView'].forEach(id => {
      const el = $('#' + id);
      if (el) el.setAttribute('aria-hidden', el.id === name ? 'false' : 'true');
    });
    // App shell
    const shell = $('#appShell');
    if (shell) shell.setAttribute('aria-hidden', (name === 'configView' || name === 'loginView') ? 'true' : 'false');
    // Sidebar active
    $$('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === name));
  }

  async function checkAuth() {
    if (!API_BASE) { showView('configView'); return false; }
    if (!state.token) { showView('loginView'); return false; }
    try {
      const me = await api('/api/admin/me');
      state.admin = me;
      $('#userName').textContent = me.username || 'مدير';
      $('#userAvatar').textContent = (me.username || 'م').charAt(0).toUpperCase();
      $('#serverLabel').textContent = new URL(API_BASE).host;
      return true;
    } catch (e) {
      if (e.status === 401) {
        state.token = ''; state.admin = null;
        localStorage.removeItem('apphub_admin_token');
        showView('loginView');
      } else {
        showView('configView');
      }
      return false;
    }
  }

  async function login(username, password) {
    const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    state.token = data.token;
    state.admin = data.admin;
    localStorage.setItem('apphub_admin_token', state.token);
    $('#userName').textContent = (data.admin && data.admin.username) || 'مدير';
    $('#userAvatar').textContent = ((data.admin && data.admin.username) || 'م').charAt(0).toUpperCase();
    $('#serverLabel').textContent = new URL(API_BASE).host;
    await loadAll();
    showView('dashboardView');
  }

  function logout() {
    state.token = ''; state.admin = null;
    localStorage.removeItem('apphub_admin_token');
    showView('loginView');
  }

  // ===== Data loading =====
  async function loadAll() {
    try {
      await Promise.all([loadApps(), loadCategories(), loadStats(), loadSettings(), loadVersions()]);
      renderDashboard();
      renderApps();
      renderCategories();
      renderStats();
      renderSettings();
      renderVersions();
      populateVersionFilter();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function loadApps() {
    try { const d = await api('/api/admin/apps'); state.apps = (d && d.items) || d || []; }
    catch (e) { state.apps = []; console.warn(e); }
  }
  async function loadCategories() {
    try { const d = await api('/api/admin/categories'); state.categories = (d && d.items) || d || []; }
    catch (e) { state.categories = []; }
  }
  async function loadVersions(appId = '') {
    try { const q = appId ? ('?appId=' + encodeURIComponent(appId)) : ''; const d = await api('/api/admin/versions' + q); state.versions = (d && d.items) || d || []; }
    catch (e) { state.versions = []; }
  }
  async function loadStats() {
    try { state.stats = await api('/api/admin/stats'); }
    catch (e) { state.stats = null; }
  }
  async function loadSettings() {
    try { state.settings = await api('/api/settings'); }
    catch (e) { state.settings = {}; }
  }

  // ===== Rendering =====
  function renderDashboard() {
    const s = state.stats || {};
    const cards = [
      { label: 'إجمالي التطبيقات', value: s.totalApps ?? state.apps.length, icon: '📱' },
      { label: 'الألعاب', value: s.totalGames ?? state.apps.filter(a=>a.isGame).length, icon: '🎮' },
      { label: 'الأقسام', value: s.totalCategories ?? state.categories.length, icon: '🗂️' },
      { label: 'إجمالي التحميلات', value: s.totalDownloads ?? 0, icon: '⬇️' }
    ];
    $('#statsGrid').innerHTML = cards.map(c => `<div class="stat-card"><div class="stat-value">${esc(c.value)}</div><div class="stat-label">${esc(c.icon)} ${esc(c.label)}</div></div>`).join('');

    const latest = (s.latestApps && s.latestApps.length ? s.latestApps : [...state.apps].sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))).slice(0,5);
    const top = (s.topApps && s.topApps.length ? s.topApps : [...state.apps].sort((a,b)=>(b.downloadCount||0)-(a.downloadCount||0))).slice(0,5);
    $('#latestApps').innerHTML = miniTable(latest, ['name','versionName','updatedAt'], ['التطبيق','الإصدار','التحديث']);
    $('#topApps').innerHTML = miniTable(top, ['name','downloadCount','categoryName'], ['التطبيق','التحميلات','القسم']);
  }

  function miniTable(items, keys, headers) {
    if (!items || !items.length) return '<div class="empty-state">لا توجد بيانات</div>';
    return `<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${items.map(it=>`<tr>${keys.map(k=>`<td>${esc(k==='updatedAt'?fmtDate(it[k]):it[k])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function renderApps() {
    const rows = state.apps.map(a => `<tr>
      <td><strong>${esc(a.name)}</strong><br><small class="muted">${esc(a.id)}</small></td>
      <td>${esc(a.categoryName || a.categoryId || '—')}</td>
      <td>${esc(a.versionName || '—')}</td>
      <td>${fmtSize(a.sizeBytes)}</td>
      <td>${esc(a.downloadCount ?? 0)}</td>
      <td>
        ${a.isFeatured ? '<span class="badge badge-featured">مميز</span> ' : ''}
        ${a.isGame ? '<span class="badge badge-game">لعبة</span> ' : ''}
        ${a.published !== false ? '<span class="badge badge-published">منشور</span>' : '<span class="badge badge-hidden">مخفي</span>'}
      </td>
      <td class="actions">
        <button data-action="edit-app" data-id="${esc(a.id)}" title="تعديل">✏️</button>
        <button data-action="delete-app" data-id="${esc(a.id)}" class="delete" title="حذف">🗑️</button>
      </td>
    </tr>`).join('');
    $('#appsTable').innerHTML = rows
      ? `<table><thead><tr><th>التطبيق</th><th>القسم</th><th>الإصدار</th><th>الحجم</th><th>التحميلات</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty-state">لا توجد تطبيقات — اضغط "+ إضافة تطبيق" للبدء</div>';
  }

  function renderCategories() {
    const rows = [...state.categories].sort((a,b)=>(a.order||0)-(b.order||0)).map(c => `<tr>
      <td><strong>${esc(c.name)}</strong><br><small class="muted">${esc(c.id)}</small></td>
      <td>${esc(c.order ?? 0)}</td>
      <td>${c.published !== false ? '<span class="badge badge-published">منشور</span>' : '<span class="badge badge-hidden">مخفي</span>'}</td>
      <td class="actions">
        <button data-action="edit-cat" data-id="${esc(c.id)}" title="تعديل">✏️</button>
        <button data-action="delete-cat" data-id="${esc(c.id)}" class="delete" title="حذف">🗑️</button>
      </td>
    </tr>`).join('');
    $('#categoriesTable').innerHTML = rows
      ? `<table><thead><tr><th>القسم</th><th>الترتيب</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty-state">لا توجد أقسام</div>';
  }

  function renderVersions() {
    const rows = state.versions.map(v => {
      const app = state.apps.find(a => a.id === v.appId);
      return `<tr>
        <td>${esc((app && app.name) || v.appId || '—')}</td>
        <td>${esc(v.versionName || '—')}</td>
        <td>${esc(v.versionCode ?? '—')}</td>
        <td>${fmtSize(v.sizeBytes)}</td>
        <td><small class="muted">${esc(v.apkUrl || '—')}</small></td>
        <td>${fmtDate(v.createdAt)}</td>
      </tr>`;
    }).join('');
    $('#versionsTable').innerHTML = rows
      ? `<table><thead><tr><th>التطبيق</th><th>الإصدار</th><th>الكود</th><th>الحجم</th><th>رابط APK</th><th>التاريخ</th></tr></thead><tbody>${rows}</tbody></table>`
      : '<div class="empty-state">لا توجد إصدارات</div>';
  }

  function renderStats() {
    const s = state.stats || {};
    const cards = [
      { label: 'إجمالي التطبيقات', value: s.totalApps ?? state.apps.length },
      { label: 'الألعاب', value: s.totalGames ?? state.apps.filter(a=>a.isGame).length },
      { label: 'الأقسام', value: s.totalCategories ?? state.categories.length },
      { label: 'إجمالي التحميلات', value: s.totalDownloads ?? 0 }
    ];
    $('#statsGridDetail').innerHTML = cards.map(c => `<div class="stat-card"><div class="stat-value">${esc(c.value)}</div><div class="stat-label">${esc(c.label)}</div></div>`).join('');

    const top = (s.topApps && s.topApps.length ? s.topApps : [...state.apps].sort((a,b)=>(b.downloadCount||0)-(a.downloadCount||0))).slice(0,8);
    const latest = (s.latestApps && s.latestApps.length ? s.latestApps : [...state.apps].sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))).slice(0,8);
    $('#statsTopApps').innerHTML = miniTable(top, ['name','downloadCount','categoryName'], ['التطبيق','التحميلات','القسم']);
    $('#statsLatestApps').innerHTML = miniTable(latest, ['name','versionName','updatedAt'], ['التطبيق','الإصدار','التحديث']);
  }

  function renderSettings() {
    const s = state.settings || {};
    if ($('#storeName')) $('#storeName').value = s.storeName || '';
    if ($('#welcomeMessage')) $('#welcomeMessage').value = s.welcomeMessage || '';
    if ($('#storeDescription')) $('#storeDescription').value = s.storeDescription || '';
    if ($('#apiBaseSettings')) $('#apiBaseSettings').value = API_BASE;
  }

  function populateVersionFilter() {
    const sel = $('#versionAppFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— جميع التطبيقات —</option>' + state.apps.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
    sel.value = current;
  }

  // ===== Config screen (server URL) =====
  function showConfigScreen() {
    showView('configView');
    const input = $('#apiBaseInput');
    if (input) input.value = API_BASE;
    const hint = $('#configHint');
    if (hint) hint.textContent = API_BASE ? 'الخادم متصل حالياً بـ: ' + API_BASE : 'لم يتم إعداد عنوان الخادم بعد.';
  }
  function saveConfig() {
    const input = $('#apiBaseInput');
    if (!input) return;
    const val = input.value.trim();
    if (val) {
      API_BASE = val.replace(/\/$/, '');
      localStorage.setItem('apphub_api_base', API_BASE);
      toast('تم حفظ عنوان الخادم', 'success');
      checkAuth().then(ok => { if (ok) loadAll(); });
    } else {
      API_BASE = '';
      localStorage.removeItem('apphub_api_base');
      toast('تم مسح عنوان الخادم', 'info');
    }
  }

  // ===== Modal =====
  function openModal(title, fields, data = {}, onSubmit) {
    const tpl = $('#modalTpl');
    const backdrop = tpl.content.firstElementChild.cloneNode(true);
    backdrop.querySelector('#modalTitle').textContent = title;
    const form = backdrop.querySelector('#modalForm');
    form.innerHTML = fields.map(f => {
      const val = data[f.name] ?? f.default ?? '';
      if (f.type === 'textarea') return `<div class="field ${f.full?'full-width':''}"><label for="${f.name}">${esc(f.label)}</label><textarea id="${f.name}" name="${f.name}" rows="${f.rows||3}">${esc(val)}</textarea></div>`;
      if (f.type === 'select') return `<div class="field ${f.full?'full-width':''}"><label for="${f.name}">${esc(f.label)}</label><select id="${f.name}" name="${f.name}">${(f.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(val)===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>`;
      if (f.type === 'checkbox') return `<div class="field"><label class="check-label"><input type="checkbox" id="${f.name}" name="${f.name}" ${val?'checked':''}> ${esc(f.label)}</label></div>`;
      return `<div class="field ${f.full?'full-width':''}"><label for="${f.name}">${esc(f.label)}</label><input type="${f.type||'text'}" id="${f.name}" name="${f.name}" value="${esc(val)}" ${f.required?'required':''} ${f.step?`step="${f.step}"`:''} ${f.placeholder?`placeholder="${esc(f.placeholder)}"`:''}></div>`;
    }).join('');
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
    const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 180); };
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop || e.target.classList.contains('modal-close') || e.target.classList.contains('modal-cancel')) close();
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const out = {};
      fields.forEach(f => {
        if (f.type === 'checkbox') out[f.name] = form.querySelector(`[name="${f.name}"]`).checked;
        else if (f.type === 'number') out[f.name] = fd.get(f.name) === '' ? null : Number(fd.get(f.name));
        else if (f.type === 'json-array') out[f.name] = String(fd.get(f.name)||'').split(',').map(s=>s.trim()).filter(Boolean);
        else out[f.name] = fd.get(f.name);
      });
      try { await onSubmit(out); close(); }
      catch (err) { toast(err.message || 'فشل الحفظ', 'error'); }
    });
  }

  // ===== Fields =====
  function appFields() {
    const catOpts = state.categories.map(c => ({ value: c.id, label: c.name }));
    if (!catOpts.length) catOpts.push({ value: 'misc', label: 'تطبيقات متنوعة' });
    return [
      { name: 'name', label: 'اسم التطبيق', required: true, placeholder: 'مثال: StreamBox' },
      { name: 'id', label: 'المعرف (ID) — اختياري', placeholder: 'يُنشأ تلقائياً' },
      { name: 'shortDescription', label: 'وصف مختصر', full: true, placeholder: 'جملة قصيرة' },
      { name: 'fullDescription', label: 'وصف كامل', type: 'textarea', rows: 4, full: true },
      { name: 'categoryId', label: 'القسم', type: 'select', options: catOpts },
      { name: 'categoryName', label: 'اسم القسم (اختياري)' },
      { name: 'versionName', label: 'رقم الإصدار (Version Name)', placeholder: '1.0.0' },
      { name: 'versionCode', label: 'رمز الإصدار (Version Code)', type: 'number', placeholder: '1' },
      { name: 'sizeBytes', label: 'حجم APK (بايت)', type: 'number', placeholder: '0' },
      { name: 'developer', label: 'المطور' },
      { name: 'packageName', label: 'Package Name', placeholder: 'com.example.app' },
      { name: 'apkUrl', label: 'رابط APK المباشر (GitHub Releases، CDN، ...)', full: true, placeholder: 'https://...' },
      { name: 'iconUrl', label: 'رابط الأيقونة', full: true, placeholder: 'https://...' },
      { name: 'sha256', label: 'SHA-256 (اختياري)', full: true, placeholder: 'hex digest' },
      { name: 'minSdk', label: 'الحد الأدنى لـ Android (API)', type: 'number', default: 21 },
      { name: 'keywords', label: 'كلمات مفتاحية (مفصولة بفواصل)', type: 'json-array', full: true },
      { name: 'targetType', label: 'نوع الجهاز', type: 'select', options: [{value:'BOTH',label:'الهاتف والتلفزيون'},{value:'PHONE',label:'الهاتف'},{value:'TV',label:'التلفزيون'}] },
      { name: 'isFeatured', label: 'تطبيق مميز', type: 'checkbox' },
      { name: 'isGame', label: 'لعبة', type: 'checkbox' },
      { name: 'published', label: 'منشور', type: 'checkbox', default: true },
    ];
  }

  function catFields() {
    return [
      { name: 'name', label: 'اسم القسم', required: true },
      { name: 'id', label: 'المعرف (ID)' },
      { name: 'icon', label: 'رابط/اسم الأيقونة' },
      { name: 'order', label: 'الترتيب', type: 'number', default: 0 },
      { name: 'published', label: 'منشور', type: 'checkbox', default: true },
    ];
  }

  // ===== CRUD =====
  async function addOrEditApp(existing) {
    const isEdit = !!existing;
    const data = Object.assign({}, existing || {}, { keywords: (existing && existing.keywords || []).join(', ') });
    openModal(isEdit ? 'تعديل: ' + (existing.name || '') : 'إضافة تطبيق جديد', appFields(), data, async (out) => {
      if (out.categoryId) {
        const c = state.categories.find(x => x.id === out.categoryId);
        if (c && !out.categoryName) out.categoryName = c.name;
      }
      if (isEdit) {
        await api('/api/admin/apps/' + encodeURIComponent(existing.id), { method: 'PUT', body: JSON.stringify(out) });
        toast('تم تحديث التطبيق', 'success');
      } else {
        if (!out.id) delete out.id;
        await api('/api/admin/apps', { method: 'POST', body: JSON.stringify(out) });
        toast('تمت إضافة التطبيق', 'success');
      }
      await loadApps(); await loadVersions(); await loadStats();
      renderApps(); renderDashboard(); renderStats(); populateVersionFilter();
    });
  }

  async function deleteApp(id) {
    const app = state.apps.find(a => a.id === id);
    if (!confirm('هل تريد حذف "' + (app ? app.name : id) + '"؟ لا يمكن التراجع.')) return;
    try {
      await api('/api/admin/apps/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('تم الحذف', 'success');
      await loadApps(); await loadStats(); renderApps(); renderDashboard(); renderStats();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function addOrEditCategory(existing) {
    const isEdit = !!existing;
    openModal(isEdit ? 'تعديل القسم' : 'إضافة قسم جديد', catFields(), existing || {}, async (out) => {
      if (isEdit) {
        await api('/api/admin/categories/' + encodeURIComponent(existing.id), { method: 'PUT', body: JSON.stringify(out) });
        toast('تم تحديث القسم', 'success');
      } else {
        if (!out.id) delete out.id;
        await api('/api/admin/categories', { method: 'POST', body: JSON.stringify(out) });
        toast('تمت إضافة القسم', 'success');
      }
      await loadCategories(); renderCategories(); renderDashboard();
    });
  }

  async function deleteCategory(id) {
    const cat = state.categories.find(c => c.id === id);
    if (!confirm('هل تريد حذف قسم "' + (cat ? cat.name : id) + '"؟')) return;
    try {
      await api('/api/admin/categories/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('تم الحذف', 'success');
      await loadCategories(); renderCategories();
    } catch (e) { toast(e.message, 'error'); }
  }

  // ===== Events =====
  function bindEvents() {
    // Auth
    $('#loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = $('#username').value.trim();
      const p = $('#password').value;
      const errEl = $('#loginError');
      errEl.hidden = true;
      try { await login(u, p); }
      catch (err) {
        errEl.textContent = err.message || 'فشل تسجيل الدخول';
        errEl.hidden = false;
      }
    });
    $('#logoutBtn')?.addEventListener('click', logout);
    $('#openConfigFromLogin')?.addEventListener('click', showConfigScreen);
    $('#changeServerBtn')?.addEventListener('click', showConfigScreen);

    // Config
    $('#configForm')?.addEventListener('submit', (e) => { e.preventDefault(); saveConfig(); });

    // Navigation
    $$('.nav-item').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const view = a.dataset.view;
      showView(view);
      if (view === 'dashboardView') { loadStats().then(renderDashboard); }
      if (view === 'statsView') { loadStats().then(renderStats); }
      if (view === 'versionsView') { loadVersions($('#versionAppFilter').value).then(renderVersions); }
      if (view === 'settingsView') { loadSettings().then(renderSettings); }
    }));

    // Refresh
    $('#refreshBtn')?.addEventListener('click', loadAll);
    $('#refreshStatsBtn')?.addEventListener('click', () => { loadStats().then(renderStats); });

    // Apps
    $('#addAppBtn')?.addEventListener('click', () => addOrEditApp(null));
    $('#addCategoryBtn')?.addEventListener('click', () => addOrEditCategory(null));

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit-app') addOrEditApp(state.apps.find(a => a.id === id));
      if (action === 'delete-app') deleteApp(id);
      if (action === 'edit-cat') addOrEditCategory(state.categories.find(c => c.id === id));
      if (action === 'delete-cat') deleteCategory(id);
    });

    // Versions filter
    $('#versionAppFilter')?.addEventListener('change', async (e) => {
      await loadVersions(e.target.value);
      renderVersions();
    });

    // Settings form
    $('#settingsForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          storeName: $('#storeName').value,
          welcomeMessage: $('#welcomeMessage').value,
          storeDescription: $('#storeDescription').value
        };
        state.settings = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
        toast('تم حفظ الإعدادات', 'success');
        renderSettings();
      } catch (err) { toast(err.message, 'error'); }
    });

    // Server settings
    $('#serverSettingsForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = $('#apiBaseSettings').value.trim();
      if (val) {
        API_BASE = val.replace(/\/$/, '');
        localStorage.setItem('apphub_api_base', API_BASE);
        toast('تم حفظ رابط الخادم', 'success');
        checkAuth().then(ok => { if (ok) loadAll(); });
      }
    });
    $('#testConnectionBtn')?.addEventListener('click', async () => {
      const val = $('#apiBaseSettings').value.trim();
      const status = $('#connectionStatus');
      if (!val) { status.textContent = 'أدخل رابط الخادم أولاً'; return; }
      status.textContent = 'جارٍ الاختبار...';
      try {
        const res = await fetch(val.replace(/\/$/, '') + '/api/health');
        if (res.ok) { status.textContent = '✅ الاتصال ناجح'; status.style.color = 'var(--success)'; }
        else { status.textContent = '❌ فشل الاتصال: HTTP ' + res.status; status.style.color = 'var(--danger)'; }
      } catch (e) {
        status.textContent = '❌ تعذر الاتصال: ' + e.message; status.style.color = 'var(--danger)';
      }
    });
  }

  // ===== Init =====
  async function init() {
    bindEvents();
    if (await checkAuth()) {
      await loadAll();
      showView('dashboardView');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
