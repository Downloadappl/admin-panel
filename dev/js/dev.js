/**
 * AppLand Developers Client Library (Passwordless & Standalone)
 */
(function (global) {
  'use strict';

  const DEV_NAME_KEY = 'appland_dev_name';
  const DEV_ID_KEY = 'appland_dev_id';
  const DEV_MY_SUBS_KEY = 'appland_dev_my_subs';

  const Dev = {
    getBaseUrl() {
      const stored = localStorage.getItem('appland_api_base');
      if (stored) return stored.replace(/\/$/, '');
      if (window.location.origin && !window.location.origin.includes('file:')) {
        return window.location.origin;
      }
      return 'https://apphub.khhjmwmmy.workers.dev';
    },

    setBaseUrl(url) {
      if (url) localStorage.setItem('appland_api_base', url.trim().replace(/\/$/, ''));
      else localStorage.removeItem('appland_api_base');
    },

    // Developer Name in localStorage
    getDevName() {
      return (localStorage.getItem(DEV_NAME_KEY) || '').trim();
    },

    setDevName(name) {
      const clean = String(name || '').trim();
      if (clean) localStorage.setItem(DEV_NAME_KEY, clean);
      else localStorage.removeItem(DEV_NAME_KEY);
      return clean;
    },

    // Persistent client device ID for developer
    getDevId() {
      let id = localStorage.getItem(DEV_ID_KEY);
      if (!id) {
        id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(DEV_ID_KEY, id);
      }
      return id;
    },

    // Submissions recorded locally
    getMySubmissions() {
      try {
        return JSON.parse(localStorage.getItem(DEV_MY_SUBS_KEY) || '[]');
      } catch (_) {
        return [];
      }
    },

    recordMySubmission(subId) {
      if (!subId) return;
      const subs = Dev.getMySubmissions();
      if (!subs.includes(subId)) {
        subs.unshift(subId);
        localStorage.setItem(DEV_MY_SUBS_KEY, JSON.stringify(subs.slice(0, 100)));
      }
    },

    esc(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    toast(msg, type = 'info') {
      let t = document.getElementById('devToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'devToast';
        t.className = 'toast-msg';
        document.body.appendChild(t);
      }
      t.textContent = msg;
      t.className = `toast-msg show ${type}`;
      clearTimeout(t._timer);
      t._timer = setTimeout(() => {
        t.className = 'toast-msg';
      }, 3500);
    },

    fmtDate(isoStr) {
      if (!isoStr) return '—';
      try {
        const d = new Date(isoStr);
        return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch (_) {
        return '—';
      }
    },

    fmtBytes(bytes) {
      const b = Number(bytes || 0);
      if (!b) return '—';
      if (b < 1024) return b + ' بايت';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' ك.ب';
      if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' م.ب';
      return (b / (1024 * 1024 * 1024)).toFixed(2) + ' ج.ب';
    },

    statusBadge(status) {
      const map = {
        'pending': { label: 'قيد المراجعة', cls: 'badge-pending' },
        'in_review': { label: 'تحت الفحص', cls: 'badge-in_review' },
        'changes_requested': { label: 'مطلوب تعديل', cls: 'badge-changes_requested' },
        'approved': { label: 'مقبول ومنشور', cls: 'badge-approved' },
        'rejected': { label: 'مرفوض', cls: 'badge-rejected' }
      };
      const s = map[status] || { label: status || 'غير معروف', cls: 'badge-pending' };
      return `<span class="badge ${s.cls}">${s.label}</span>`;
    },

    async api(path, options = {}) {
      const url = Dev.getBaseUrl() + path;
      const headers = Object.assign({
        'Content-Type': 'application/json'
      }, options.headers || {});

      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || `خطأ في الخادم (${res.status})`);
      }
      return data;
    },

    // Compress client image before saving
    compressImage(file, maxSide = 1280, quality = 0.85) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            let w = img.width;
            let h = img.height;
            if (w > maxSide || h > maxSide) {
              if (w > h) {
                h = Math.round((h * maxSide) / w);
                w = maxSide;
              } else {
                w = Math.round((w * maxSide) / h);
                h = maxSide;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
            resolve(dataUrl);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }
  };

  global.Dev = Dev;
})(window);
