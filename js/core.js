/**
 * AppHub Admin Panel - Core Utilities & API Client
 */
(function (global) {
  'use strict';

  const DEFAULT_API_BASE = 'https://apphub.khhjmwmmy.workers.dev';

  const Core = {
    DEFAULT_API_BASE,

    getApiBase() {
      let b = localStorage.getItem('apphub_api_base');
      if (!b) return DEFAULT_API_BASE;
      return b.replace(/\/$/, '');
    },

    setApiBase(url) {
      if (!url) {
        localStorage.removeItem('apphub_api_base');
      } else {
        localStorage.setItem('apphub_api_base', url.trim().replace(/\/$/, ''));
      }
    },

    getToken() {
      return localStorage.getItem('apphub_admin_token') || '';
    },

    setToken(token) {
      if (token) localStorage.setItem('apphub_admin_token', token);
      else localStorage.removeItem('apphub_admin_token');
    },

    logout() {
      Core.setToken('');
      window.location.href = 'login.html';
    },

    esc(val) {
      return String(val ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
    },

    fmtDate(d) {
      if (!d) return '—';
      try {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch (_) {
        return '—';
      }
    },

    fmtSize(bytes) {
      const b = Number(bytes || 0);
      if (!b) return '—';
      if (b < 1024) return b + ' بايت';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' ك.ب';
      if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' م.ب';
      return (b / (1024 * 1024 * 1024)).toFixed(2) + ' ج.ب';
    },

    toast(msg, type = 'info') {
      let el = document.getElementById('toastNotice');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toastNotice';
        el.className = 'toast-notice';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.className = 'toast-notice show ' + type;
      clearTimeout(el._t);
      el._t = setTimeout(() => {
        el.className = 'toast-notice';
      }, 3500);
    },

    async api(path, opts = {}) {
      const apiBase = Core.getApiBase();
      if (!apiBase) {
        throw new Error('يرجى تحديد رابط الخادم أولاً');
      }

      const headers = Object.assign({
        'Content-Type': 'application/json'
      }, opts.headers || {});

      const token = Core.getToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      const url = apiBase + path;
      try {
        const res = await fetch(url, Object.assign({}, opts, { headers }));
        const text = await res.text();
        let data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (_) {
          data = text;
        }

        if (!res.ok) {
          if (res.status === 401 && !path.includes('/login')) {
            Core.setToken('');
            window.location.href = 'login.html';
            return;
          }
          const msg = (data && (data.error || data.message)) || ('خطأ في الطلب: ' + res.status);
          const err = new Error(msg);
          err.status = res.status;
          err.data = data;
          throw err;
        }
        return data;
      } catch (e) {
        if (e.message === 'Failed to fetch') {
          throw new Error('تعذر الاتصال بالخادم. تأكد من صحة الرابط واتصال الإنترنت.');
        }
        throw e;
      }
    },

    initIcons() {
      if (global.lucide && typeof global.lucide.createIcons === 'function') {
        global.lucide.createIcons();
      }
    },

    setupLayout(activePage) {
      // Toggle active link on sidebar and bottom nav
      document.querySelectorAll('.nav-link, .bottom-nav-item').forEach(el => {
        if (el.getAttribute('data-page') === activePage) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      // Mobile drawer open/close
      const mobileBtn = document.getElementById('mobileMenuToggle');
      const sidebar = document.getElementById('appSidebar');
      const overlay = document.getElementById('sidebarOverlay');

      if (mobileBtn && sidebar && overlay) {
        const openMenu = () => {
          sidebar.classList.add('open');
          overlay.classList.add('active');
        };
        const closeMenu = () => {
          sidebar.classList.remove('open');
          overlay.classList.remove('active');
        };

        mobileBtn.addEventListener('click', openMenu);
        overlay.addEventListener('click', closeMenu);

        // Close on nav item click on mobile
        document.querySelectorAll('.sidebar-nav a').forEach(a => {
          a.addEventListener('click', closeMenu);
        });
      }

      // Logout buttons
      document.querySelectorAll('.btn-logout').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
            Core.logout();
          }
        });
      });

      // Initialize icons
      Core.initIcons();
    },

    async checkAuth() {
      const apiBase = Core.getApiBase();
      if (!apiBase) {
        window.location.href = 'server.html';
        return false;
      }

      const token = Core.getToken();
      if (!token) {
        window.location.href = 'login.html';
        return false;
      }

      try {
        const me = await Core.api('/api/admin/me');
        const userNameEl = document.getElementById('userName');
        const userAvatarEl = document.getElementById('userAvatar');
        const serverLabelEl = document.getElementById('serverLabel');

        if (userNameEl) userNameEl.textContent = me.username || 'مدير النظام';
        if (userAvatarEl) userAvatarEl.textContent = (me.username || 'A').charAt(0).toUpperCase();
        if (serverLabelEl) {
          try {
            serverLabelEl.textContent = new URL(apiBase).host;
          } catch (_) {
            serverLabelEl.textContent = apiBase;
          }
        }
        Core.updateSubmissionsBadge();
        return true;
      } catch (err) {
        console.warn('Auth check failed:', err);
        Core.setToken('');
        window.location.href = 'login.html';
        return false;
      }
    },

    async updateSubmissionsBadge() {
      try {
        const stats = await Core.api('/api/admin/submissions/stats');
        const badge = document.getElementById('submissionsPendingBadge');
        if (badge) {
          if (stats && stats.pending > 0) {
            badge.textContent = stats.pending;
            badge.style.display = 'inline-block';
          } else {
            badge.style.display = 'none';
          }
        }
      } catch (_) {}
    },

    openModal({ title, fields, initialData = {}, onSubmit }) {
      const existing = document.getElementById('activeModal');
      if (existing) existing.remove();

      const backdrop = document.createElement('div');
      backdrop.id = 'activeModal';
      backdrop.className = 'modal-backdrop';

      let fieldsHtml = fields.map(f => {
        const val = initialData[f.name] ?? f.default ?? '';
        const isFull = f.full ? 'col-full' : '';
        const hintHtml = f.hint ? `<span class="field-hint" style="display:block;font-size:0.8rem;color:var(--text-muted);margin-top:4px;">${Core.esc(f.hint)}</span>` : '';

        if (f.type === 'textarea') {
          return `
            <div class="field ${isFull}">
              <label for="${f.name}">${Core.esc(f.label)}</label>
              <textarea id="${f.name}" name="${f.name}" rows="${f.rows || 3}" placeholder="${Core.esc(f.placeholder || '')}">${Core.esc(val)}</textarea>
              ${hintHtml}
              ${f.name === 'screenshots' ? `<div id="screenshotsPreview" style="display:flex;gap:10px;overflow-x:auto;padding-top:10px;min-height:20px;"></div>` : ''}
            </div>
          `;
        }

        if (f.type === 'select') {
          const opts = (f.options || []).map(o => `
            <option value="${Core.esc(o.value)}" ${String(val) === String(o.value) ? 'selected' : ''}>
              ${Core.esc(o.label)}
            </option>
          `).join('');
          return `
            <div class="field ${isFull}">
              <label for="${f.name}">${Core.esc(f.label)}</label>
              <select id="${f.name}" name="${f.name}">${opts}</select>
              ${hintHtml}
            </div>
          `;
        }

        if (f.type === 'checkbox') {
          return `
            <div class="field ${isFull}" style="display:flex;align-items:flex-end;min-height:50px;">
              <label class="check-label">
                <input type="checkbox" id="${f.name}" name="${f.name}" ${val ? 'checked' : ''}>
                <span>${Core.esc(f.label)}</span>
              </label>
            </div>
          `;
        }

        return `
          <div class="field ${isFull}">
            <label for="${f.name}">${Core.esc(f.label)}</label>
            <input type="${f.type || 'text'}" id="${f.name}" name="${f.name}" 
                   value="${Core.esc(val)}" 
                   placeholder="${Core.esc(f.placeholder || '')}"
                   ${f.required ? 'required' : ''} 
                   ${f.step ? `step="${f.step}"` : ''}>
            ${hintHtml}
            ${f.name === 'iconUrl' ? `<div id="iconPreview" style="margin-top:8px;display:flex;align-items:center;gap:10px;"><div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;overflow:hidden;"><img id="iconPreviewImg" src="${Core.esc(val)}" alt="" style="width:100%;height:100%;object-fit:cover;${val ? '' : 'display:none;'}" onerror="this.style.display='none'"></div><span style="font-size:0.75rem;color:var(--text-muted)">معاينة الأيقونة</span></div>` : ''}
          </div>
        `;
      }).join('');

      backdrop.innerHTML = `
        <div class="modal-container">
          <div class="modal-header">
            <h2>${Core.esc(title)}</h2>
            <button type="button" class="btn btn-ghost btn-icon btn-sm modal-close-btn" aria-label="إغلاق">
              <i data-lucide="x"></i>
            </button>
          </div>
          <form id="dynamicModalForm" class="modal-body">
            <div class="form-grid">
              ${fieldsHtml}
            </div>
          </form>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost modal-close-btn">إلغاء</button>
            <button type="submit" form="dynamicModalForm" class="btn btn-primary" id="modalSubmitBtn">
              <i data-lucide="check"></i>
              <span>حفظ</span>
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(backdrop);
      Core.initIcons();

      requestAnimationFrame(() => backdrop.classList.add('open'));

      const closeModal = () => {
        backdrop.classList.remove('open');
        setTimeout(() => backdrop.remove(), 240);
      };

      backdrop.querySelectorAll('.modal-close-btn').forEach(b => b.addEventListener('click', closeModal));
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });

      // Live Image Preview for iconUrl
      const iconInput = backdrop.querySelector('#iconUrl');
      const iconImg = backdrop.querySelector('#iconPreviewImg');
      if (iconInput && iconImg) {
        iconInput.addEventListener('input', () => {
          const u = iconInput.value.trim();
          if (u) {
            iconImg.src = u;
            iconImg.style.display = 'block';
          } else {
            iconImg.style.display = 'none';
          }
        });
      }

      // Live Screenshot Preview for screenshots
      const ssInput = backdrop.querySelector('#screenshots');
      const ssContainer = backdrop.querySelector('#screenshotsPreview');
      function updateSsPreviews() {
        if (!ssInput || !ssContainer) return;
        const urls = ssInput.value.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
        if (!urls.length) {
          ssContainer.innerHTML = '';
          return;
        }
        ssContainer.innerHTML = urls.map(u => `
          <div style="width:120px;height:70px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:rgba(0,0,0,0.3);flex-shrink:0;">
            <img src="${Core.esc(u)}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.style.display='none'">
          </div>
        `).join('');
      }
      if (ssInput && ssContainer) {
        ssInput.addEventListener('input', updateSsPreviews);
        updateSsPreviews();
      }

      const form = backdrop.querySelector('#dynamicModalForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = backdrop.querySelector('#modalSubmitBtn');
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>جارٍ الحفظ...</span>`;

        const fd = new FormData(form);
        const out = {};
        fields.forEach(f => {
          if (f.type === 'checkbox') {
            out[f.name] = form.querySelector(`[name="${f.name}"]`).checked;
          } else if (f.type === 'number') {
            const raw = fd.get(f.name);
            out[f.name] = raw === '' ? null : Number(raw);
          } else if (f.type === 'json-array' || f.name === 'screenshots' || f.name === 'keywords') {
            const raw = String(fd.get(f.name) || '');
            out[f.name] = raw.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
          } else {
            out[f.name] = fd.get(f.name);
          }
        });

        try {
          await onSubmit(out);
          closeModal();
        } catch (err) {
          Core.toast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<i data-lucide="check"></i><span>حفظ</span>`;
          Core.initIcons();
        }
      });
    }
  };

  global.Core = Core;
})(window);
