/**
 * AppLand Developers Client Library (Passwordless, Standalone & Real-time Integration)
 * Matches AppLand Brand & Production Backend APIs
 */
(function (global) {
  'use strict';

  const DEFAULT_API_BASE = 'https://apphub.khhjmwmmy.workers.dev';
  const DEV_NAME_KEY = 'appland_dev_name';
  const DEV_ID_KEY = 'appland_dev_id';
  const DEV_MY_SUBS_KEY = 'appland_dev_my_subs';

  const Dev = {
    DEFAULT_API_BASE,

    // Backend Base URL resolver
    getBaseUrl() {
      // 1. Check synced local storage keys
      const stored = localStorage.getItem('apphub_api_base') || localStorage.getItem('appland_api_base');
      if (stored && stored.trim()) {
        return stored.trim().replace(/\/$/, '');
      }

      // 2. If hosted directly on Cloudflare Workers / production domain (not local dev)
      if (window.location && window.location.origin) {
        const origin = window.location.origin;
        const isLocal = origin.includes('localhost') ||
                        origin.includes('127.0.0.1') ||
                        origin.includes('file:') ||
                        origin.includes(':8080') ||
                        origin.includes(':5500') ||
                        origin.includes(':3000');
        if (!isLocal && origin.includes('workers.dev')) {
          return origin;
        }
      }

      // 3. Official AppLand Cloudflare Worker Backend
      return DEFAULT_API_BASE;
    },

    setBaseUrl(url) {
      if (url && url.trim()) {
        const clean = url.trim().replace(/\/$/, '');
        localStorage.setItem('apphub_api_base', clean);
        localStorage.setItem('appland_api_base', clean);
      } else {
        localStorage.removeItem('apphub_api_base');
        localStorage.removeItem('appland_api_base');
      }
    },

    // Developer Identity (No Password Needed)
    getDevName() {
      return (localStorage.getItem(DEV_NAME_KEY) || '').trim();
    },

    setDevName(name) {
      const clean = String(name || '').trim();
      if (clean) {
        localStorage.setItem(DEV_NAME_KEY, clean);
      } else {
        localStorage.removeItem(DEV_NAME_KEY);
      }
      return clean;
    },

    getDevId() {
      let id = localStorage.getItem(DEV_ID_KEY);
      if (!id) {
        id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
        localStorage.setItem(DEV_ID_KEY, id);
      }
      return id;
    },

    // Submissions history tracking in localStorage
    getMySubmissions() {
      try {
        const val = localStorage.getItem(DEV_MY_SUBS_KEY);
        return val ? JSON.parse(val) : [];
      } catch (_) {
        return [];
      }
    },

    recordMySubmission(subId) {
      if (!subId) return;
      try {
        const subs = Dev.getMySubmissions();
        if (!subs.includes(subId)) {
          subs.unshift(subId);
          localStorage.setItem(DEV_MY_SUBS_KEY, JSON.stringify(subs.slice(0, 100)));
        }
      } catch (_) {}
    },

    // Sanitize HTML
    esc(val) {
      return String(val ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
    },

    // Toast alert message
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
      }, 4000);
    },

    // Date formatting (Arabic)
    fmtDate(isoStr) {
      if (!isoStr) return '—';
      try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        });
      } catch (_) {
        return '—';
      }
    },

    // Byte / Size formatting
    fmtBytes(bytes) {
      const b = Number(bytes || 0);
      if (!b) return '—';
      if (b < 1024) return b + ' بايت';
      if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' ك.ب';
      if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' م.ب';
      return (b / (1024 * 1024 * 1024)).toFixed(2) + ' ج.ب';
    },

    // Status Badge component
    statusBadge(status) {
      const map = {
        'pending': { label: 'قيد المراجعة', cls: 'badge-pending', icon: 'clock' },
        'in_review': { label: 'تحت الفحص', cls: 'badge-in_review', icon: 'search' },
        'changes_requested': { label: 'مطلوب تعديل', cls: 'badge-changes_requested', icon: 'alert-triangle' },
        'approved': { label: 'مقبول ومنشور', cls: 'badge-approved', icon: 'check-circle' },
        'rejected': { label: 'مرفوض', cls: 'badge-rejected', icon: 'x-circle' }
      };
      const s = map[status] || { label: status || 'غير معروف', cls: 'badge-pending', icon: 'clock' };
      return `<span class="badge ${s.cls}"><span>${s.label}</span></span>`;
    },

    // Direct Image URL Validator (tests actual loading and headers)
    validateImageUrl(url) {
      return new Promise((resolve) => {
        const clean = String(url || '').trim();
        if (!clean) {
          return resolve({ valid: false, error: 'رابط الصورة فارغ' });
        }
        if (!/^https?:\/\//i.test(clean)) {
          return resolve({ valid: false, error: 'يجب أن يبدأ الرابط بـ http:// أو https://' });
        }

        const extMatch = clean.split('?')[0].match(/\.(png|jpe?g|webp|svg|gif|bmp|ico)$/i);
        const img = new Image();
        let timer = null;
        let done = false;

        const cleanup = () => {
          if (timer) clearTimeout(timer);
          img.onload = null;
          img.onerror = null;
        };

        timer = setTimeout(() => {
          if (done) return;
          done = true;
          cleanup();
          if (extMatch) {
            resolve({
              valid: true,
              width: null,
              height: null,
              warning: 'امتداد الصورة صالح ولكن الخادم لم يستجب بالسرعة الكافية'
            });
          } else {
            resolve({ valid: false, error: 'استغرق فحص الصورة وقتاً طويلاً أو أن الخادم محجوب' });
          }
        }, 8000);

        img.onload = () => {
          if (done) return;
          done = true;
          cleanup();
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            resolve({ valid: false, error: 'الملف لا يحتوي على بيانات صورة حقيقية' });
          } else {
            resolve({
              valid: true,
              width: img.naturalWidth,
              height: img.naturalHeight,
              aspectRatio: (img.naturalWidth / img.naturalHeight).toFixed(2)
            });
          }
        };

        img.onerror = () => {
          if (done) return;
          done = true;
          cleanup();
          resolve({ valid: false, error: 'تعذر تحميل الصورة — تأكد من أن الرابط مباشر وصالح ويعرض صورة حقيقية' });
        };

        // Assign src to start loading
        img.src = clean;
      });
    },

    // API Caller
    async api(path, options = {}) {
      const baseUrl = Dev.getBaseUrl();
      const url = baseUrl + path;

      const headers = Object.assign({
        'Content-Type': 'application/json',
        'X-Dev-Id': Dev.getDevId(),
        'X-Dev-Name': encodeURIComponent(Dev.getDevName() || '')
      }, options.headers || {});

      try {
        const res = await fetch(url, {
          method: options.method || 'GET',
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined
        });

        const text = await res.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (_) {
          data = { message: text };
        }

        if (!res.ok) {
          const msg = data.error || data.message || `خطأ من الخادم (${res.status})`;
          const err = new Error(msg);
          err.status = res.status;
          err.data = data;
          throw err;
        }

        return data;
      } catch (err) {
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
          throw new Error(`تعذر الاتصال بالخادم (${baseUrl}). يرجى التحقق من اتصال الإنترنت أو إعداد الخادم.`);
        }
        throw err;
      }
    },

    // Fetch dynamic sections, categories, and target device types from Backend
    async fetchOptions() {
      try {
        // Preferred unified options endpoint
        const opts = await Dev.api('/api/options');
        return {
          sections: opts.sections || [],
          categories: opts.categories || [],
          targetTypes: opts.targetTypes || [
            { id: 'TV', name: 'Android TV (مخصص للشاشات وأجهزة التلفزيون)' },
            { id: 'BOTH', name: 'Both (متوافق مع الشاشات والهواتف)' },
            { id: 'PHONE', name: 'Android Phone (هواتف فقط)' }
          ]
        };
      } catch (e) {
        // Fallback: fetch separately
        const [secRes, catRes] = await Promise.all([
          Dev.api('/api/sections').catch(() => ({ items: [] })),
          Dev.api('/api/categories').catch(() => ({ items: [] }))
        ]);

        return {
          sections: secRes.items || [],
          categories: catRes.items || [],
          targetTypes: [
            { id: 'TV', name: 'Android TV (مخصص للشاشات وأجهزة التلفزيون)' },
            { id: 'BOTH', name: 'Both (متوافق مع الشاشات والهواتف)' },
            { id: 'PHONE', name: 'Android Phone (هواتف فقط)' }
          ]
        };
      }
    }
  };

  global.Dev = Dev;
})(window);
