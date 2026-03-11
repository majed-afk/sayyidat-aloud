// ===== dashboard-app.js — المنسق الرئيسي للوحة التحكم — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, profiles.js, products.js,
//             orders.js, transactions.js, ui.js
// يعتمد على وحدات لوحة التحكم:
//   dashboard-products.js, dashboard-orders.js, dashboard-shipping.js,
//   dashboard-finance.js, dashboard-profile.js, dashboard-support.js

(function() {
  'use strict';

  // ===== Namespace + Shared State =====
  SAIDAT.dashboard = SAIDAT.dashboard || {};
  SAIDAT.dashboard.state = SAIDAT.dashboard.state || {};
  SAIDAT.dashboard.state.currentUser = null;

  var U = SAIDAT.utils;
  var CFG = SAIDAT.config;
  var state = SAIDAT.dashboard.state;

  // عناوين الأقسام
  var SECTION_TITLES = {
    overview: 'نظرة عامة',
    products: 'المنتجات',
    orders: 'الطلبات',
    finance: 'المالية',
    support: 'الدعم الفني',
    profile: 'الملف الشخصي'
  };

  // ===== التهيئة =====
  async function initDashboard() {
    U.log('log', 'Dashboard: waiting for auth...');

    // انتظار auth مع timeout
    var authTimeout = new Promise(function(resolve) { setTimeout(resolve, 10000); });
    await Promise.race([SAIDAT.auth.ready(), authTimeout]);
    U.log('log', 'Dashboard: auth ready, isLoggedIn=' + SAIDAT.auth.isLoggedIn());

    state.currentUser = SAIDAT.auth.getCurrentUser();

    // لو ما في مستخدم — ننتظر 3 ثوانٍ ونعيد المحاولة
    if (!state.currentUser) {
      U.log('log', 'Dashboard: no user yet, retrying in 3s...');
      await new Promise(function(r) { setTimeout(r, 3000); });
      state.currentUser = SAIDAT.auth.getCurrentUser();
    }

    if (!state.currentUser) {
      U.log('warn', 'Dashboard: no currentUser after retry → redirecting to login');
      window.location.href = 'login.html';
      return;
    }
    U.log('log', 'Dashboard: user loaded =', state.currentUser.email);

    // جلب البيانات من Supabase
    try {
      var products = await SAIDAT.products.getForSeller();
      var orders = await SAIDAT.orders.getForSeller();
      var transactions = await SAIDAT.transactions.getForSeller();
      var monthlySales = await SAIDAT.transactions.getMonthlySales();

      state.currentUser.products = products || [];
      state.currentUser.orders = orders || [];
      state.currentUser.transactions = transactions || [];
      state.currentUser.monthlySales = monthlySales.length > 0 ? monthlySales : CFG.DEFAULT_MONTHLY_SALES.slice();
    } catch(e) {
      U.log('warn', 'Data load error:', e);
      state.currentUser.products = [];
      state.currentUser.orders = [];
      state.currentUser.transactions = [];
      state.currentUser.monthlySales = CFG.DEFAULT_MONTHLY_SALES.slice();
    }

    // تهيئة جميع الأقسام
    updateSidebar();
    loadShippingCost();
    renderOverview();
    renderProducts();
    renderOrders();
    renderFinance();
    renderSupportTickets();
    loadProfile();

    // Handle hash navigation
    var hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById('section-' + hash)) {
      SAIDAT.ui.switchSection(hash, SECTION_TITLES);
    }
  }

  // ===== SIDEBAR =====
  function updateSidebar() {
    var initial = U.escapeHtml(state.currentUser.firstName.charAt(0));
    document.getElementById('sidebarAvatar').textContent = state.currentUser.firstName.charAt(0);
    document.getElementById('sidebarName').textContent = state.currentUser.firstName + ' ' + state.currentUser.lastName;

    // تحديث حالة التوثيق
    var roleEl = document.querySelector('.sidebar-user-role');
    if (roleEl) {
      var isMerchant = state.currentUser.merchantVerified;
      var isSeller = state.currentUser.sellerVerified;
      var checkSvg = '<svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm-1.25 17.47l-4.82-4.82 1.41-1.41 3.41 3.41 7.2-7.2 1.41 1.42-8.61 8.6z"/></svg>';

      if (isMerchant && isSeller) {
        roleEl.innerHTML = checkSvg + ' تاجر وبائع موثق';
        roleEl.className = 'sidebar-user-role verify-both';
      } else if (isMerchant) {
        roleEl.innerHTML = checkSvg + ' تاجر موثق';
        roleEl.className = 'sidebar-user-role verify-merchant';
      } else if (isSeller) {
        roleEl.innerHTML = checkSvg + ' بائع موثق';
        roleEl.className = 'sidebar-user-role verify-seller';
      } else {
        roleEl.innerHTML = 'بائع';
        roleEl.className = 'sidebar-user-role verify-none';
      }
    }
  }

  // ===== OVERVIEW =====
  function renderOverview() {
    var user = state.currentUser;
    var activeProducts = user.products.filter(function(p) { return p.active; }).length;

    var statsHTML =
      '<div class="stat-card">' +
        '<div class="stat-icon sales"><svg viewBox="0 0 24 24"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg></div>' +
        '<div class="stat-info"><div class="stat-label">إجمالي المبيعات</div><div class="stat-value">' + U.formatNumber(user.totalSales) + '</div><div class="stat-change up">↑ 12%</div></div>' +
      '</div>' +
      '<div class="stat-card">' +
        '<div class="stat-icon revenue"><svg viewBox="0 0 24 24"><path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/></svg></div>' +
        '<div class="stat-info"><div class="stat-label">إجمالي الإيرادات</div><div class="stat-value">' + U.formatCurrency(user.totalRevenue) + '</div><div class="stat-change up">↑ 8%</div></div>' +
      '</div>' +
      '<div class="stat-card">' +
        '<div class="stat-icon balance"><svg viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.11 0-2-.9-2-2V5c0-1.1.89-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.11 0-2 .9-2 2v8c0 1.1.89 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg></div>' +
        '<div class="stat-info"><div class="stat-label">الرصيد المتاح</div><div class="stat-value">' + U.formatCurrency(user.balance) + '</div><div class="stat-change up">متاح للسحب</div></div>' +
      '</div>' +
      '<div class="stat-card">' +
        '<div class="stat-icon products"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM8 20H4v-4h4v4zm0-6H4v-4h4v4zm0-6H4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4zm6 12h-4v-4h4v4zm0-6h-4v-4h4v4zm0-6h-4V4h4v4z"/></svg></div>' +
        '<div class="stat-info"><div class="stat-label">المنتجات النشطة</div><div class="stat-value">' + activeProducts + '</div><div class="stat-change up">من ' + user.products.length + ' منتج</div></div>' +
      '</div>';

    document.getElementById('statsGrid').innerHTML = statsHTML;

    // Chart
    var maxSales = Math.max.apply(null, user.monthlySales.map(function(m) { return m.amount; }));
    var chartHTML = '';
    user.monthlySales.forEach(function(m) {
      var height = maxSales > 0 ? Math.round((m.amount / maxSales) * 160) : 0;
      chartHTML +=
        '<div class="bar-group">' +
          '<div class="bar" style="height: ' + height + 'px">' +
            '<span class="bar-value">' + U.formatNumber(m.amount) + ' ر.س</span>' +
          '</div>' +
          '<span class="bar-label">' + U.escapeHtml(m.month) + '</span>' +
        '</div>';
    });
    document.getElementById('barChart').innerHTML = chartHTML;

    // Recent orders
    var recent = user.orders.slice(0, 5);
    var ordersHTML = '';
    recent.forEach(function(o) {
      ordersHTML +=
        '<tr>' +
          '<td style="font-weight:600; font-size:0.82rem; direction:ltr; text-align:right;">' + U.escapeHtml(o.id) + '</td>' +
          '<td>' + U.escapeHtml(o.productName || o.product_name) + '</td>' +
          '<td>' + U.escapeHtml(o.buyer || o.buyer_name) + '</td>' +
          '<td style="font-weight:600;">' + U.formatCurrency(o.total) + '</td>' +
          '<td>' + U.statusLabel(o.status) + '</td>' +
          '<td style="font-size:0.82rem; opacity:0.7;">' + U.escapeHtml(o.date || o.created_at) + '</td>' +
        '</tr>';
    });
    document.getElementById('recentOrdersBody').innerHTML = ordersHTML;
  }

  // ===== كشف الدوال للـ HTML onclick handlers =====
  window.switchSection = function(s) { SAIDAT.ui.switchSection(s, SECTION_TITLES); };
  window.toggleSidebar = SAIDAT.ui.toggleSidebar;
  window.renderOverview = renderOverview;
  window.updateSidebar = updateSidebar;

  // ===== تصدير عبر namespace =====
  SAIDAT.dashboard.app = {
    init: initDashboard,
    updateSidebar: updateSidebar,
    renderOverview: renderOverview
  };

  // ===== تشغيل تلقائي =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDashboard);
  } else {
    initDashboard();
  }

  // Listen for hash changes
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById('section-' + hash)) {
      SAIDAT.ui.switchSection(hash, SECTION_TITLES);
    }
  });

})();
