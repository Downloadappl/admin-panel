/**
 * AppLand Developers Client Library
 */
(function (global) {
  'use strict';

  const Dev = {
    getBaseUrl() {
      const stored = localStorage.getItem('appland_api_base');
      if (stored) return stored.replace(/\/$/, '');
      // If served from worker origin
      if (window.location.origin && !window.location.origin.includes('file:')) {
        return window.location.origin;
      }
      return 'https://apphub.khhjmwmmy.workers.dev';
    },

    setBaseUrl(url) {
      if (url) localStorage.setItem('appland_api_base', url.trim().replace(/\/$/, ''));
      else localStorage.removeItem('appland_api_base');
    },

    getToken() {
      return localStorage.getItem('appland_dev_token') || '';
    },

    setToken(token) {
      if (token) localStorage.setItem('appland_dev_token', token);
      else localStorage.removeItem('appland_dev_token');
    },

    getUser() {
      try {
        return JSON.parse(localStorage.getItem('appland_dev_user') || 'null');
      } catch (_) {
        return null;
      }
    },

    setUser(user) {
      if (user) localStorage.setItem('appland_dev_user', JSON.stringify(user));
      else localStorage.removeItem('appland_dev_user');
    },

    logout() {
      const token = Dev.getToken();
      if (token) {
        fetch(Dev.getBaseUrl() + '/api/dev/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        }).catch(() => {});
      }
      Dev.setToken('');
      Dev.setUser(null);
      window.location.href = 'login.html';
    },

    requireAuth() {
      const token = Dev.getToken();
      if (!token) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
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

      const token = Dev.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      if (res.status === 401 && !path.includes('/login') && !path.includes('/register')) {
        Dev.logout();
        throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
      }

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
