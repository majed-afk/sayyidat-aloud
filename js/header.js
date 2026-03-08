// ===== header.js — تحديث الهيدر وقائمة المستخدم — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var esc = U.escapeHtml;

  SAIDAT.header = {

    /**
     * تحديث الهيدر حسب حالة تسجيل الدخول
     * يستخدم escapeHtml لمنع XSS
     */
    update: function() {
      var user = SAIDAT.auth.getCurrentUser();
      var desktopActions = document.querySelector('.header > .container > .header-actions');
      var mobileActions = document.querySelector('.mobile-menu .header-actions');

      if (!desktopActions) return;

      if (user) {
        var initial = esc(user.firstName ? user.firstName.charAt(0) : '?');
        var name = esc(user.firstName || '');
        var fullName = esc((user.firstName || '') + ' ' + (user.lastName || ''));
        var email = esc(user.email || '');

        desktopActions.innerHTML =
          '<div class="notif-wrapper">' +
            '<button class="notif-bell-btn" onclick="SAIDAT.header.toggleNotifications()">' +
              '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z"/></svg>' +
              '<span class="notif-badge" id="notifBadge" style="display:none;">0</span>' +
            '</button>' +
            '<div class="notif-dropdown" id="notifDropdown">' +
              '<div class="notif-dropdown-header">' +
                '<span>الإشعارات</span>' +
                '<button onclick="SAIDAT.header.markAllNotifRead()">تحديد الكل كمقروء</button>' +
              '</div>' +
              '<div class="notif-list" id="notifList"><p style="padding:16px;text-align:center;color:#999;">لا توجد إشعارات</p></div>' +
            '</div>' +
          '</div>' +
          '<div class="user-menu-wrapper">' +
            '<button class="user-menu-btn" onclick="SAIDAT.header.toggleMenu()">' +
              '<span class="user-avatar-sm">' + initial + '</span>' +
              '<span class="user-name-sm">' + name + '</span>' +
              '<svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            '<div class="user-dropdown" id="userDropdown">' +
              '<div class="dropdown-header">' +
                '<span class="dropdown-avatar">' + initial + '</span>' +
                '<div><div class="dropdown-name">' + fullName + '</div>' +
                '<div class="dropdown-email">' + email + '</div></div>' +
              '</div>' +
              '<div class="dropdown-divider"></div>' +
              '<a href="dashboard.html" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg> لوحة التحكم</a>' +
              '<a href="dashboard.html#orders" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> طلباتي</a>' +
              '<a href="dashboard.html#profile" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> حسابي</a>' +
              (SAIDAT.auth.isAdmin() ? '<a href="admin.html" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg> لوحة الإدارة</a>' : '') +
              '<div class="dropdown-divider"></div>' +
              '<a href="#" class="dropdown-item dropdown-logout" onclick="AUTH.logout(); return false;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg> تسجيل الخروج</a>' +
            '</div>' +
          '</div>';

        if (mobileActions) {
          mobileActions.innerHTML =
            '<a href="dashboard.html" class="btn btn-outline">لوحة التحكم</a>' +
            '<a href="#" class="btn btn-filled" onclick="AUTH.logout(); return false;">تسجيل الخروج</a>';
        }
      }
    },

    /**
     * تبديل ظهور قائمة المستخدم
     */
    toggleMenu: function() {
      var dd = document.getElementById('userDropdown');
      if (dd) dd.classList.toggle('open');
      // إغلاق الإشعارات لو مفتوحة
      var nd = document.getElementById('notifDropdown');
      if (nd) nd.classList.remove('open');
    },

    /**
     * تبديل ظهور قائمة الإشعارات
     */
    toggleNotifications: function() {
      var nd = document.getElementById('notifDropdown');
      if (nd) {
        nd.classList.toggle('open');
        if (nd.classList.contains('open')) {
          this.loadNotifications();
        }
      }
      // إغلاق قائمة المستخدم لو مفتوحة
      var dd = document.getElementById('userDropdown');
      if (dd) dd.classList.remove('open');
    },

    /**
     * تحميل الإشعارات وعرضها
     */
    loadNotifications: async function() {
      if (!SAIDAT.notifications) return;
      var list = document.getElementById('notifList');
      if (!list) return;

      var notifs = await SAIDAT.notifications.getUnread();
      if (notifs.length === 0) {
        list.innerHTML = '<p style="padding:16px;text-align:center;color:#999;font-size:0.85rem;">لا توجد إشعارات جديدة</p>';
        return;
      }

      var html = '';
      notifs.forEach(function(n) {
        var timeAgo = SAIDAT.header._timeAgo(n.created_at);
        html += '<a href="' + esc(n.link || '#') + '" class="notif-item' + (n.is_read ? '' : ' unread') + '" onclick="SAIDAT.header.readNotif(\'' + esc(n.id) + '\')">' +
          '<div class="notif-title">' + esc(n.title) + '</div>' +
          '<div class="notif-body">' + esc(n.body) + '</div>' +
          '<div class="notif-time">' + esc(timeAgo) + '</div>' +
        '</a>';
      });
      list.innerHTML = html;
    },

    /**
     * تحديث عداد الإشعارات
     */
    refreshBadge: async function() {
      if (!SAIDAT.notifications || !SAIDAT.auth.getAuthUser()) return;
      var count = await SAIDAT.notifications.getUnreadCount();
      var badge = document.getElementById('notifBadge');
      if (badge) {
        if (count > 0) {
          badge.textContent = count > 9 ? '9+' : count;
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
      }
    },

    /**
     * قراءة إشعار معين
     */
    readNotif: async function(id) {
      if (SAIDAT.notifications) {
        await SAIDAT.notifications.markRead(id);
        this.refreshBadge();
      }
    },

    /**
     * تحديد الكل كمقروء
     */
    markAllNotifRead: async function() {
      if (SAIDAT.notifications) {
        await SAIDAT.notifications.markAllRead();
        this.refreshBadge();
        this.loadNotifications();
      }
    },

    /**
     * حساب الوقت المنقضي
     */
    _timeAgo: function(dateStr) {
      var diff = Date.now() - new Date(dateStr).getTime();
      var mins = Math.floor(diff / 60000);
      if (mins < 1) return 'الآن';
      if (mins < 60) return 'منذ ' + mins + ' دقيقة';
      var hours = Math.floor(mins / 60);
      if (hours < 24) return 'منذ ' + hours + ' ساعة';
      var days = Math.floor(hours / 24);
      return 'منذ ' + days + ' يوم';
    }
  };

  // إغلاق القوائم عند النقر خارجها
  document.addEventListener('click', function(e) {
    var dd = document.getElementById('userDropdown');
    var btn = e.target.closest('.user-menu-btn');
    if (dd && !btn && !e.target.closest('.user-dropdown')) {
      dd.classList.remove('open');
    }
    var nd = document.getElementById('notifDropdown');
    var nbtn = e.target.closest('.notif-bell-btn');
    if (nd && !nbtn && !e.target.closest('.notif-dropdown')) {
      nd.classList.remove('open');
    }
  });

  // تحديث عداد الإشعارات كل 30 ثانية
  var _notifInterval = null;
  function startNotifPolling() {
    if (_notifInterval) clearInterval(_notifInterval);
    SAIDAT.header.refreshBadge();
    _notifInterval = setInterval(function() {
      SAIDAT.header.refreshBadge();
    }, 30000);
  }

  // بدء polling الإشعارات بعد تحميل Auth
  setTimeout(function() {
    if (SAIDAT.auth && SAIDAT.auth.getAuthUser()) {
      startNotifPolling();
    }
  }, 3000);

  // ===== CSS للهيدر =====
  var style = document.createElement('style');
  style.textContent =
    '.user-menu-wrapper { position: relative; }' +
    '.user-menu-btn { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1.5px solid #E8DDD0; border-radius: 50px; background: transparent; cursor: pointer; font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 0.88rem; color: #2C1810; transition: all 0.3s ease; }' +
    '.user-menu-btn:hover { border-color: #C19A6B; background: #FAF7F2; }' +
    '.user-avatar-sm { width: 30px; height: 30px; border-radius: 50%; background: #C19A6B; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.82rem; flex-shrink: 0; }' +
    '.user-name-sm { font-weight: 600; }' +
    '.user-dropdown { position: absolute; top: calc(100% + 8px); left: 0; min-width: 260px; background: #fff; border: 1px solid #E8DDD0; border-radius: 12px; box-shadow: 0 12px 40px rgba(44,24,16,0.15); opacity: 0; visibility: hidden; transform: translateY(-8px); transition: all 0.25s ease; z-index: 1100; }' +
    '.user-dropdown.open { opacity: 1; visibility: visible; transform: translateY(0); }' +
    '.dropdown-header { display: flex; align-items: center; gap: 12px; padding: 16px; }' +
    '.dropdown-avatar { width: 40px; height: 40px; border-radius: 50%; background: #C19A6B; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; flex-shrink: 0; }' +
    '.dropdown-name { font-weight: 700; font-size: 0.92rem; color: #2C1810; }' +
    '.dropdown-email { font-size: 0.78rem; color: #4A2C1A; opacity: 0.7; margin-top: 2px; }' +
    '.dropdown-divider { height: 1px; background: #E8DDD0; margin: 0; }' +
    '.dropdown-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; text-decoration: none; color: #4A2C1A; font-size: 0.88rem; font-weight: 500; transition: all 0.2s ease; }' +
    '.dropdown-item:hover { background: #FAF7F2; color: #C19A6B; }' +
    '.dropdown-item svg { opacity: 0.6; }' +
    '.dropdown-item:hover svg { opacity: 1; }' +
    '.dropdown-logout { color: #C0392B; }' +
    '.dropdown-logout:hover { background: #FDF2F2; color: #C0392B; }' +
    '@media (max-width: 768px) { .user-name-sm { display: none; } .user-dropdown { left: auto; right: 0; min-width: 240px; } }' +
    '.notif-wrapper { position: relative; display: flex; align-items: center; }' +
    '.notif-bell-btn { position: relative; background: transparent; border: none; cursor: pointer; padding: 8px; border-radius: 50%; transition: background 0.2s; color: #2C1810; }' +
    '.notif-bell-btn:hover { background: #FAF7F2; }' +
    '.notif-badge { position: absolute; top: 2px; right: 2px; min-width: 18px; height: 18px; background: #DC2626; color: #fff; font-size: 0.7rem; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; padding: 0 4px; }' +
    '.notif-dropdown { position: absolute; top: calc(100% + 8px); left: 0; width: 320px; max-height: 400px; overflow-y: auto; background: #fff; border: 1px solid #E8DDD0; border-radius: 12px; box-shadow: 0 12px 40px rgba(44,24,16,0.15); opacity: 0; visibility: hidden; transform: translateY(-8px); transition: all 0.25s ease; z-index: 1100; }' +
    '.notif-dropdown.open { opacity: 1; visibility: visible; transform: translateY(0); }' +
    '.notif-dropdown-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #E8DDD0; font-weight: 700; font-size: 0.9rem; }' +
    '.notif-dropdown-header button { background: none; border: none; color: #C19A6B; cursor: pointer; font-size: 0.78rem; font-family: inherit; }' +
    '.notif-item { display: block; padding: 12px 16px; border-bottom: 1px solid #f5f0eb; text-decoration: none; color: #2C1810; transition: background 0.2s; }' +
    '.notif-item:hover { background: #FAF7F2; }' +
    '.notif-item.unread { background: #FFF8F0; border-right: 3px solid #C19A6B; }' +
    '.notif-title { font-weight: 600; font-size: 0.85rem; margin-bottom: 2px; }' +
    '.notif-body { font-size: 0.8rem; color: #666; margin-bottom: 4px; }' +
    '.notif-time { font-size: 0.72rem; color: #999; }' +
    '@media (max-width: 768px) { .notif-dropdown { left: auto; right: -40px; width: 290px; } }';
  document.head.appendChild(style);

  // التوافق العكسي
  window.AUTH = window.AUTH || {};
  window.AUTH.updateHeader = function() { SAIDAT.header.update(); };
  window.AUTH.toggleUserMenu = function() { SAIDAT.header.toggleMenu(); };

})();
