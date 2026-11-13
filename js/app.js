(function () {
  'use strict';

  const API_BASE = (window.APPHUB_API_BASE || localStorage.getItem('apphub_api_base') || '').replace(/\/$/, '') || '';
  const state = {
    token: localStorage.getItem('apphub_admin_token') || '',
    admin: null,
    apps: [],
    categories: [],
    versions: [],
    settings: {},
    stats: null
  };

  // Helpers
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
    let el = $('#toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);padding:10px 16px;border-radius:8px;background:#121821;color:#e6edf3;border:1px solid #2a3445;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.4);transition:opacity .2s'; document.body.appendChild(el); }
    el.textContent = msg;
    el.style.borderColor = type === 'error' ? '#f87171' : type === 'success' ? '#4ade80' : '#2a3445';
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  };

  async function api(path, opts = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const url = (API_BASE || '') + path;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || ('HTTP ' + res.status);
      const err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Auth
  function showView(name) {
    $$('.view').forEach(v => v.setAttribute('aria-hidden', v.id === name ? 'false' : 'true'));
    $$('.topnav a').forEach(a => a.classList.toggle('active', a.dataset.tab === name.replace('View','')));
    const loggedIn = !!state.token;
    $('#loginView').setAttribute('aria-hidden', loggedIn ? 'true' : 'false');
    $('.topbar').style.display = loggedIn ? 'flex' : 'none';
    $('.main').style.paddingTop = loggedIn ? '1.5rem' : '0';
  }

  async function checkAuth() {
    if (!state.token) { showView('loginView'); return false; }
    try {
      const me = await api('/api/admin/me');
      state.admin = me;
      $('#userName').textContent = me.username || 'مدير';
      $('.topbar').style.display = 'flex';
      return true;
    } catch (e) {
      state.token = ''; state.admin = null;
      localStorage.removeItem('apphub_admin_token');
      showView('loginView');
      return false;
    }
  }

  async function login(username, password) {
    const data = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    state.token = data.token;
    state.admin = data.admin;
    localStorage.setItem('apphub_admin_token', state.token);
    $('#userName').textContent = (data.admin && data.admin.username) || 'مدير';
    await loadAll();
    showView('dashboardView');
  }

  async function logout() {
    try { await api('/api/admin/logout', { method: 'POST' }); } catch (_) {}
    state.token = ''; state.admin = null;
    localStorage.removeItem('apphub_admin_token');
    showView('loginView');
  }

  // Data loading
  async function loadAll() {
    await Promise.all([loadApps(), loadCategories(), loadStats(), loadSettings(), loadVersions()]);
    renderDashboard();
    renderApps();
    renderCategories();
    renderStats();
    renderSettings();
    renderVersions();
    populateVersionFilter();
  }

  async function loadApps() {
    try { const d = await api('/api/admin/apps'); state.apps = (d && d.items) || d || []; } catch (e) { state.apps = []; console.warn(e); }
  }
  async function loadCategories() {
    try { const d = await api('/api/admin/categories'); state.categories = (d && d.items) || d || []; } catch (e) { state.categories = []; }
  }
  async function loadVersions(appId = '') {
    try { const q = appId ? ('?appId=' + encodeURIComponent(appId)) : ''; const d = await api('/api/admin/versions' + q); state.versions = (d && d.items) || d || []; } catch (e) { state.versions = []; }
  }
  async function loadStats() {
    try { state.stats = await api('/api/admin/stats'); } catch (e) { state.stats = null; }
  }
  async function loadSettings() {
    try { state.settings = await api('/api/settings'); } catch (e) { state.settings = {}; }
  }

  // Rendering
  function renderDashboard() {
    const s = state.stats || {};
    const cards = [
      { label: 'إجمالي التطبيقات', value: s.totalApps ?? state.apps.length },
      { label: 'الألعاب', value: s.totalGames ?? state.apps.filter(a=>a.isGame).length },
      { label: 'الأقسام', value: s.totalCategories ?? state.categories.length },
      { label: 'إجمالي التحميلات', value: s.totalDownloads ?? 0 }
    ];
    $('#statsGrid').innerHTML = cards.map(c => `<div class="stat-card"><div class="stat-value">${esc(c.value)}</div><div class="stat-label">${esc(c.label)}</div></div>`).join('');

    const latest = (s.latestApps && s.latestApps.length ? s.latestApps : [...state.apps].sort((a,b)=>new Date(b.updatedAt||0)-new Date(a.updatedAt||0))).slice(0,5);
    const top = (s.topApps && s.topApps.length ? s.topApps : [...state.apps].sort((a,b)=>(b.downloadCount||0)-(a.downloadCount||0))).slice(0,5);
    $('#latestApps').innerHTML = miniTable(latest, ['name','versionName','updatedAt'], ['التطبيق','الإصدار','التحديث']);
    $('#topApps').innerHTML = miniTable(top, ['name','downloadCount','categoryName'], ['التطبيق','التحميلات','القسم']);
  }

  function miniTable(items, keys, headers) {
    if (!items || !items.length) return '<p class="muted">لا توجد بيانات</p>';
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
    $('#appsTable').innerHTML = `<table><thead><tr><th>التطبيق</th><th>القسم</th><th>الإصدار</th><th>الحجم</th><th>التحميلات</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">لا توجد تطبيقات</td></tr>'}</tbody></table>`;
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
    $('#categoriesTable').innerHTML = `<table><thead><tr><th>القسم</th><th>الترتيب</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">لا توجد أقسام</td></tr>'}</tbody></table>`;
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
    $('#versionsTable').innerHTML = `<table><thead><tr><th>التطبيق</th><th>الإصدار</th><th>الكود</th><th>الحجم</th><th>رابط APK</th><th>التاريخ</th></tr></thead><tbody>${rows || '<tr><td colspan="6" class="muted">لا توجد إصدارات</td></tr>'}</tbody></table>`;
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
  }

  function renderSettings() {
    const s = state.settings || {};
    if ($('#storeName')) $('#storeName').value = s.storeName || '';
    if ($('#welcomeMessage')) $('#welcomeMessage').value = s.welcomeMessage || '';
    if ($('#storeDescription')) $('#storeDescription').value = s.storeDescription || '';
  }

  function populateVersionFilter() {
    const sel = $('#versionAppFilter');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— جميع التطبيقات —</option>' + state.apps.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('');
    sel.value = current;
  }

  // Modals & CRUD
  function openModal(title, fields, data = {}, onSubmit) {
    const tpl = $('#modalTpl');
    const backdrop = tpl.content.firstElementChild.cloneNode(true);
    backdrop.querySelector('#modalTitle').textContent = title;
    const form = backdrop.querySelector('#modalForm');
    form.innerHTML = fields.map(f => {
      const val = data[f.name] ?? f.default ?? '';
      if (f.type === 'textarea') return `<div class="field ${f.full?'full-width':''}"><label for="${f.name}">${esc(f.label)}</label><textarea id="${f.name}" name="${f.name}" rows="${f.rows||3}">${esc(val)}</textarea></div>`;
      if (f.type === 'select') return `<div class="field ${f.full?'full-width':''}"><label for="${f.name}">${esc(f.label)}</label><select id="${f.name}" name="${f.name}">${(f.options||[]).map(o=>`<option value="${esc(o.value)}" ${String(val)===String(o.value)?'selected':''}>${esc(o.label)}</option>`).join('')}</select></div>`;
      if (f.type === 'checkbox') return `<div class="field"><label><input type="checkbox" id="${f.name}" name="${f.name}" ${val?'checked':''} style="width:auto;margin-left:8px"> ${esc(f.label)}</label></div>`;
      return `<div class="field ${f.full?'full-width':''}"><label for="${f.name}">${esc(f.label)}</label><input type="${f.type||'text'}" id="${f.name}" name="${f.name}" value="${esc(val)}" ${f.required?'required':''} ${f.step?`step="${f.step}"`:''}></div>`;
    }).join('');
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
    const close = () => { backdrop.classList.remove('open'); setTimeout(() => backdrop.remove(), 180); };
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.classList.contains('modal-close') || e.target.classList.contains('modal-cancel')) close(); });
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
      try { await onSubmit(out); close(); } catch (err) { toast(err.message || 'فشل الحفظ', 'error'); }
    });
  }

  function appFields(categories) {
    const catOpts = (categories||state.categories).map(c => ({ value: c.id, label: c.name }));
    if (!catOpts.length) catOpts.push({ value: 'misc', label: 'تطبيقات متنوعة' });
    return [
      { name: 'name', label: 'اسم التطبيق', required: true },
      { name: 'id', label: 'المعرف (ID)', required: false },
      { name: 'shortDescription', label: 'وصف مختصر', full: true },
      { name: 'fullDescription', label: 'وصف كامل', type: 'textarea', rows: 4, full: true },
      { name: 'categoryId', label: 'القسم', type: 'select', options: catOpts },
      { name: 'categoryName', label: 'اسم القسم (اختياري)', },
      { name: 'versionName', label: 'رقم الإصدار (Version Name)', },
      { name: 'versionCode', label: 'رمز الإصدار (Version Code)', type: 'number' },
      { name: 'sizeBytes', label: 'حجم APK (بايت)', type: 'number' },
      { name: 'developer', label: 'المطور', },
      { name: 'packageName', label: 'Package Name', },
      { name: 'apkUrl', label: 'رابط APK المباشر', full: true },
      { name: 'iconUrl', label: 'رابط الأيقونة', full: true },
      { name: 'sha256', label: 'SHA-256 (اختياري)', full: true },
      { name: 'minSdk', label: 'الحد الأدنى لـ Android (API)', type: 'number', default: 21 },
      { name: 'keywords', label: 'كلمات مفتاحية (مفصولة بفواصل)', type: 'json-array', full: true },
      { name: 'targetType', label: 'نوع الجهاز', type: 'select', options: [{value:'BOTH',label:'الهاتف والتلفزيون'},{value:'PHONE',label:'الهاتف'},{value:'TV',label:'التلفزيون'}] },
      { name: 'isFeatured', label: 'تطبيق مميز', type: 'checkbox' },
      { name: 'isGame', label: 'لعبة', type: 'checkbox' },
      { name: 'published', label: 'منشور', type: 'checkbox', default: true },
    ];
  }

  async function addOrEditApp(existing) {
    const isEdit = !!existing;
    const data = Object.assign({}, existing || {}, { keywords: (existing && existing.keywords || []).join(', ') });
    openModal(isEdit ? 'تعديل التطبيق' : 'إضافة تطبيق', appFields(), data, async (out) => {
      // normalize
      if (out.categoryId) { const c = state.categories.find(x=>x.id===out.categoryId); if (c && !out.categoryName) out.categoryName = c.name; }
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
    if (!confirm('هل تريد حذف هذا التطبيق؟')) return;
    try {
      await api('/api/admin/apps/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('تم الحذف', 'success');
      await loadApps(); await loadStats(); renderApps(); renderDashboard(); renderStats();
    } catch (e) { toast(e.message, 'error'); }
  }

  function catFields() {
    return [
      { name: 'name', label: 'اسم القسم', required: true },
      { name: 'id', label: 'المعرف (ID)', },
      { name: 'icon', label: 'رابط/اسم الأيقونة', },
      { name: 'order', label: 'الترتيب', type: 'number', default: 0 },
      { name: 'published', label: 'منشور', type: 'checkbox', default: true },
    ];
  }

  async function addOrEditCategory(existing) {
    const isEdit = !!existing;
    openModal(isEdit ? 'تعديل القسم' : 'إضافة قسم', catFields(), existing || {}, async (out) => {
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
    if (!confirm('هل تريد حذف هذا القسم؟')) return;
    try {
      await api('/api/admin/categories/' + encodeURIComponent(id), { method: 'DELETE' });
      toast('تم الحذف', 'success');
      await loadCategories(); renderCategories();
    } catch (e) { toast(e.message, 'error'); }
  }

  // Events
  function bindEvents() {
    $('#loginForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = $('#username').value.trim();
      const p = $('#password').value;
      const errEl = $('#loginError');
      errEl.hidden = true;
      try { await login(u, p); } catch (err) { errEl.textContent = err.message || 'فشل تسجيل الدخول'; errEl.hidden = false; }
    });
    $('#logoutBtn')?.addEventListener('click', logout);

    $$('.topnav a').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = a.dataset.tab;
      showView(tab + 'View');
      if (tab === 'dashboard') { loadStats().then(()=>{renderDashboard();}); }
      if (tab === 'stats') { loadStats().then(()=>{renderStats();}); }
      if (tab === 'versions') { loadVersions($('#versionAppFilter').value).then(renderVersions); }
    }));

    $('#addAppBtn')?.addEventListener('click', () => addOrEditApp(null));
    $('#addCategoryBtn')?.addEventListener('click', () => addOrEditCategory(null));

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === 'edit-app') addOrEditApp(state.apps.find(a=>a.id===id));
      if (action === 'delete-app') deleteApp(id);
      if (action === 'edit-cat') addOrEditCategory(state.categories.find(c=>c.id===id));
      if (action === 'delete-cat') deleteCategory(id);
    });

    $('#versionAppFilter')?.addEventListener('change', async (e) => {
      await loadVersions(e.target.value);
      renderVersions();
    });

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
  }

  // Init
  async function init() {
    bindEvents();
    // If opened from /admin/ path, API is same origin
    if (await checkAuth()) {
      await loadAll();
      showView('dashboardView');
    } else {
      showView('loginView');
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
