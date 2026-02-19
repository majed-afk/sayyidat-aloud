// ===== admin-app.js — تطبيق لوحة الإدارة — صيدات العود =====
// المسؤوليات: عرض وإدارة المستخدمين، المنتجات، الطلبات، المالية، الإعدادات

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var CFG = SAIDAT.config;

  var adminUser = null;
  var allUsers = [];
  var allProducts = [];
  var allOrders = [];
  var allTransactions = [];
  var currentOrderFilter = 'all';
  var productApprovalFilter = 'all';

  // ===== SECTION TITLES =====
  var sectionTitles = {
    'dashboard': '\u0644\u0648\u062d\u0629 \u0627\u0644\u0642\u064a\u0627\u062f\u0629',
    'users': '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646',
    'products': '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a',
    'orders': '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0637\u0644\u0628\u0627\u062a',
    'finance': '\u0627\u0644\u0645\u0627\u0644\u064a\u0629',
    'settings': '\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u0648\u0642\u0639'
  };

  // ===== STATUS CLASSES (for admin-specific badge rendering) =====
  var statusClasses = {
    'new': 'status-new',
    'processing': 'status-processing',
    'completed': 'status-completed',
    'cancelled': 'status-cancelled',
    'shipped': 'status-processing'
  };

  // ===== INIT =====
  async function initAdmin() {
    console.log('Admin: waiting for auth...');

    // انتظار auth مع timeout
    var authTimeout = new Promise(function(resolve) { setTimeout(resolve, 10000); });
    await Promise.race([SAIDAT.auth.ready(), authTimeout]);
    console.log('Admin: auth ready, isLoggedIn =', SAIDAT.auth.isLoggedIn(), 'isAdmin =', SAIDAT.auth.isAdmin());

    var user = SAIDAT.auth.getCurrentUser();

    // لو ما في مستخدم — ننتظر ونعيد المحاولة
    if (!user || !SAIDAT.auth.isAdmin()) {
      console.log('Admin: no admin yet, retrying in 3s...');
      await new Promise(function(r) { setTimeout(r, 3000); });
      user = SAIDAT.auth.getCurrentUser();
    }

    if (!user || !SAIDAT.auth.isAdmin()) {
      console.warn('Admin: no admin user after retry → redirecting to login');
      window.location.href = 'login.html';
      return;
    }
    adminUser = user;

    await refreshData();
    renderDashboard();
    renderUsers();
    renderProducts();
    renderOrders();
    renderFinance();
    await loadSettings();

    var hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById('section-' + hash)) {
      switchSection(hash);
    }
  }

  // ===== DATA (async — loads from Supabase) =====
  async function refreshData() {
    allUsers = await SAIDAT.profiles.getAll();

    // Load all products from Supabase (admin gets all via products table directly)
    var sb = U.getSupabase();
    if (sb) {
      try {
        var pRes = await sb.from('products').select('*, profiles(first_name, last_name, store_name, id)').order('created_at', { ascending: false });
        if (pRes.error) {
          console.error('Admin products query error:', pRes.error);
          // Fallback: جلب بدون join في حال فشل الربط
          var fallback = await sb.from('products').select('*').order('created_at', { ascending: false });
          allProducts = (fallback.data || []);
        } else {
          allProducts = pRes.data || [];
        }
        console.log('Admin loaded products:', allProducts.length);
      } catch(e) {
        console.error('Admin load products error:', e);
        allProducts = [];
      }

      try {
        var oRes = await sb.from('orders').select('*, profiles!orders_seller_id_fkey(first_name, last_name, id)').order('created_at', { ascending: false });
        allOrders = oRes.data || [];
      } catch(e) {
        console.error('Admin load orders error:', e);
        allOrders = [];
      }

      try {
        var tRes = await sb.from('transactions').select('*, profiles(first_name, last_name, id)').order('created_at', { ascending: false });
        allTransactions = tRes.data || [];
      } catch(e) {
        console.error('Admin load transactions error:', e);
        allTransactions = [];
      }
    }
  }

  function getSellers() {
    return allUsers.filter(function(u) { return u.role === 'seller'; });
  }

  function getSellerName(sellerId) {
    var user = allUsers.find(function(u) { return u.id === sellerId; });
    if (user) return U.escapeHtml(user.firstName + ' ' + user.lastName);
    return '';
  }

  // ===== HELPERS =====
  function statusBadge(status) {
    var cls = statusClasses[status] || 'status-new';
    var label = CFG.STATUS_LABELS[status] || U.escapeHtml(status);
    return '<span class="status ' + cls + '"><span class="status-dot"></span>' + U.escapeHtml(label) + '</span>';
  }

  // ===== NAVIGATION =====
  function switchSection(section) {
    SAIDAT.ui.switchSection(section, sectionTitles);
    window.location.hash = section;
  }
  window.switchSection = switchSection;

  window.toggleSidebar = function() {
    SAIDAT.ui.toggleSidebar();
  };

  // ===== RENDER DASHBOARD =====
  function renderDashboard() {
    var sellers = getSellers();
    var totalUsers = sellers.length;
    var totalProducts = allProducts.length;
    var totalOrders = allOrders.length;

    var totalRevenue = sellers.reduce(function(s, u) { return s + (u.totalRevenue || 0); }, 0);
    var totalCommission = allTransactions
      .filter(function(t) { return t.type === 'commission'; })
      .reduce(function(s, t) { return s + Math.abs(t.amount || 0); }, 0);

    var pendingProducts = allProducts.filter(function(p) { return (p.approval_status || 'pending') === 'pending'; }).length;

    document.getElementById('adminStatsGrid').innerHTML =
      statCard('users', '\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646', U.formatNumber(totalUsers), '\u062a\u0627\u062c\u0631 \u0645\u0633\u062c\u0644') +
      statCard('products-stat', '\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a', U.formatNumber(totalProducts), '\u0645\u0646\u062a\u062c \u0645\u0639\u0631\u0648\u0636') +
      statCard('orders', '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629', U.formatNumber(pendingProducts), '\u0645\u0646\u062a\u062c \u064a\u0646\u062a\u0638\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629') +
      statCard('orders', '\u0627\u0644\u0637\u0644\u0628\u0627\u062a', U.formatNumber(totalOrders), '\u0637\u0644\u0628 \u0625\u062c\u0645\u0627\u0644\u064a') +
      statCard('revenue', '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a', U.formatCurrency(totalRevenue), '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a') +
      statCard('commission', '\u0627\u0644\u0639\u0645\u0648\u0644\u0627\u062a', U.formatCurrency(totalCommission), '\u0623\u0631\u0628\u0627\u062d \u0627\u0644\u0645\u0646\u0635\u0629');

    // Bar Chart — aggregate monthly sales from transactions
    renderBarChart();

    // Activity Feed
    renderActivityFeed();

    // Recent Orders (last 5)
    var recentOrders = allOrders.slice(0, 5);
    var html = '';
    recentOrders.forEach(function(o) {
      var commission = ((o.total || 0) * CFG.COMMISSION_RATE).toFixed(2);
      var sellerName = '';
      if (o.profiles) {
        sellerName = U.escapeHtml((o.profiles.first_name || '') + ' ' + (o.profiles.last_name || ''));
      } else {
        sellerName = getSellerName(o.seller_id);
      }
      html += '<tr>' +
        '<td><strong>' + U.escapeHtml(o.id ? o.id.substring(0, 8) : '') + '</strong></td>' +
        '<td>' + U.escapeHtml(o.product_name || '') + '</td>' +
        '<td>' + sellerName + '</td>' +
        '<td>' + U.escapeHtml(o.buyer_name || '') + '</td>' +
        '<td>' + U.formatCurrency(o.total || 0) + '</td>' +
        '<td style="color:#E67E22;font-weight:600;">' + U.formatCurrency(commission) + '</td>' +
        '<td>' + statusBadge(o.status || 'new') + '</td>' +
        '<td>' + U.escapeHtml(o.created_at ? o.created_at.split('T')[0] : '') + '</td>' +
        '</tr>';
    });
    document.getElementById('adminRecentOrdersBody').innerHTML = html || emptyRow(8);
  }

  function statCard(icon, label, value, sub) {
    return '<div class="stat-card">' +
      '<div class="stat-icon ' + icon + '"><svg viewBox="0 0 24 24" width="24" height="24" fill="#fff">' +
      getStatIcon(icon) + '</svg></div>' +
      '<div class="stat-info"><div class="stat-label">' + U.escapeHtml(label) + '</div>' +
      '<div class="stat-value">' + value + '</div>' +
      '<div class="stat-change" style="color:var(--text-medium);opacity:0.6;font-size:0.75rem;">' + U.escapeHtml(sub) + '</div>' +
      '</div></div>';
  }

  function getStatIcon(type) {
    var icons = {
      'users': '<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5z"/>',
      'products-stat': '<path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/>',
      'orders': '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>',
      'revenue': '<path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>',
      'commission': '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.94s4.18 1.36 4.18 3.87c0 1.87-1.38 2.91-3.12 3.17z"/>'
    };
    return icons[type] || icons['orders'];
  }

  function renderBarChart() {
    // Aggregate monthly data from sale transactions
    var monthlyData = {};
    allTransactions.forEach(function(t) {
      if (t.type === 'sale' && t.created_at) {
        var month = t.created_at.substring(0, 7); // YYYY-MM
        monthlyData[month] = (monthlyData[month] || 0) + Math.abs(t.amount || 0);
      }
    });

    var months = Object.keys(monthlyData).sort();
    var values = months.map(function(m) { return monthlyData[m]; });
    var maxVal = Math.max.apply(null, values.length ? values : [1]) || 1;

    var html = '';
    months.forEach(function(month, i) {
      var pct = (values[i] / maxVal * 100).toFixed(0);
      html += '<div class="bar-group">' +
        '<div class="bar-value">' + U.formatNumber(values[i]) + '</div>' +
        '<div class="bar" style="height:' + pct + '%;"></div>' +
        '<div class="bar-label">' + U.escapeHtml(month) + '</div>' +
        '</div>';
    });
    document.getElementById('adminBarChart').innerHTML = html || '<p style="color:var(--text-medium);opacity:0.6;text-align:center;padding:20px;">\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a</p>';
  }

  function renderActivityFeed() {
    var activities = [];

    // Orders
    allOrders.slice(0, 5).forEach(function(o) {
      activities.push({
        type: 'order',
        icon: '\uD83D\uDED2',
        text: '\u0637\u0644\u0628 \u062c\u062f\u064a\u062f <strong>#' + U.escapeHtml(o.id ? o.id.substring(0, 8) : '') + '</strong> \u0645\u0646 ' + U.escapeHtml(o.buyer_name || '') + ' \u2014 ' + U.formatCurrency(o.total || 0),
        date: o.created_at || ''
      });
    });

    // Registrations
    getSellers().forEach(function(u) {
      activities.push({
        type: 'user',
        icon: '\uD83D\uDC64',
        text: '\u062a\u0633\u062c\u064a\u0644 \u062a\u0627\u062c\u0631 \u062c\u062f\u064a\u062f: <strong>' + U.escapeHtml(u.firstName + ' ' + u.lastName) + '</strong>',
        date: u.createdAt || ''
      });
    });

    activities.sort(function(a, b) { return (b.date || '').localeCompare(a.date || ''); });
    activities = activities.slice(0, 8);

    var html = '';
    activities.forEach(function(a) {
      html += '<div class="activity-item">' +
        '<div class="activity-icon ' + a.type + '">' + a.icon + '</div>' +
        '<div class="activity-content">' +
        '<div class="activity-text">' + a.text + '</div>' +
        '<div class="activity-time">' + U.escapeHtml(a.date ? a.date.split('T')[0] : '') + '</div>' +
        '</div></div>';
    });
    document.getElementById('activityFeed').innerHTML = html || '<p style="color:var(--text-medium);opacity:0.6;text-align:center;padding:20px;">\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u0634\u0627\u0637\u0627\u062a</p>';
  }

  // ===== RENDER USERS =====
  window.renderUsers = async function() {
    await refreshData();
    var searchVal = (document.getElementById('userSearch').value || '').toLowerCase();
    var roleFilter = document.getElementById('userRoleFilter').value;
    var statusFilter = document.getElementById('userStatusFilter').value;

    var filtered = allUsers.filter(function(u) {
      var name = (u.firstName + ' ' + u.lastName + ' ' + u.email).toLowerCase();
      if (searchVal && name.indexOf(searchVal) === -1) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && u.suspended) return false;
      if (statusFilter === 'suspended' && !u.suspended) return false;
      return true;
    });

    var html = '';
    filtered.forEach(function(u) {
      var initial = U.escapeHtml(u.firstName.charAt(0));
      var roleBadge = u.role === 'admin'
        ? '<span class="role-badge role-admin">\u0645\u062f\u064a\u0631</span>'
        : '<span class="role-badge role-seller">\u062a\u0627\u062c\u0631</span>';
      var statusBdg = u.suspended
        ? '<span class="status status-suspended"><span class="status-dot"></span>\u0645\u0639\u0644\u0651\u0642</span>'
        : '<span class="status status-completed"><span class="status-dot"></span>\u0646\u0634\u0637</span>';

      // Count products and revenue for this user
      var userProducts = allProducts.filter(function(p) { return p.seller_id === u.id; });
      var userRevenue = u.totalRevenue || 0;

      var actions = '';
      if (u.role !== 'admin') {
        actions =
          '<div class="table-actions">' +
          '<button class="btn btn-outline btn-sm" onclick="showUserDetail(\'' + U.escapeHtml(u.id) + '\')">\u062a\u0641\u0627\u0635\u064a\u0644</button>' +
          '<button class="btn ' + (u.suspended ? 'btn-success' : 'btn-warning') + ' btn-sm" onclick="toggleUserStatus(\'' + U.escapeHtml(u.id) + '\')">' + (u.suspended ? '\u062a\u0641\u0639\u064a\u0644' : '\u062a\u0639\u0644\u064a\u0642') + '</button>' +
          '<button class="btn btn-danger btn-sm" onclick="deleteUserAction(\'' + U.escapeHtml(u.id) + '\')">\u062d\u0630\u0641</button>' +
          '</div>';
      } else {
        actions = '<span style="opacity:0.4;">\u2014</span>';
      }

      html += '<tr>' +
        '<td><div style="display:flex;align-items:center;gap:10px;">' +
        '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent-amber);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">' + initial + '</div>' +
        '<div><div style="font-weight:600;">' + U.escapeHtml(u.firstName + ' ' + u.lastName) + '</div>' +
        (u.storeName ? '<div style="font-size:0.75rem;color:var(--text-medium);opacity:0.6;">' + U.escapeHtml(u.storeName) + '</div>' : '') +
        '</div></div></td>' +
        '<td>' + U.escapeHtml(u.email) + '</td>' +
        '<td>' + roleBadge + '</td>' +
        '<td>' + statusBdg + '</td>' +
        '<td>' + U.formatNumber(userProducts.length) + '</td>' +
        '<td>' + U.formatCurrency(userRevenue) + '</td>' +
        '<td>' + U.escapeHtml(u.createdAt) + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    });
    document.getElementById('usersBody').innerHTML = html || emptyRow(8);
  };

  // ===== USER ACTIONS =====
  window.showUserDetail = function(userId) {
    var user = allUsers.find(function(u) { return u.id === userId; });
    if (!user) return;
    var initial = U.escapeHtml(user.firstName.charAt(0));

    // Count user products and orders
    var userProducts = allProducts.filter(function(p) { return p.seller_id === userId; });
    var userOrders = allOrders.filter(function(o) { return o.seller_id === userId; });

    // === Merchant Verification Section ===
    var merchantVerifiedBadge = user.merchantVerified
      ? '<span class="status status-completed"><span class="status-dot"></span>\u0645\u0648\u062b\u0651\u0642 \u0643\u062a\u0627\u062c\u0631</span>'
      : '<span class="status status-cancelled"><span class="status-dot"></span>\u063a\u064a\u0631 \u0645\u0648\u062b\u0651\u0642</span>';

    var sellerVerifiedBadge = user.sellerVerified
      ? '<span class="status status-completed"><span class="status-dot"></span>\u0628\u0627\u0626\u0639 \u0645\u0648\u062b\u0651\u0642</span>'
      : '<span class="status status-cancelled"><span class="status-dot"></span>\u063a\u064a\u0631 \u0645\u0648\u062b\u0651\u0642</span>';

    var commercialRegisterHtml = '';
    if (user.commercialRegister) {
      commercialRegisterHtml =
        '<div style="margin-top:16px;padding:12px;background:var(--bg-warm);border:1.5px solid var(--border-taupe);border-radius:var(--radius-btn);">' +
        '<div style="font-weight:600;font-size:0.85rem;margin-bottom:8px;color:var(--accent-amber);">\u0627\u0644\u0633\u062c\u0644 \u0627\u0644\u062a\u062c\u0627\u0631\u064a \u0627\u0644\u0645\u0631\u0641\u0642</div>' +
        '<a href="' + U.escapeHtml(user.commercialRegister) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent-amber);text-decoration:underline;font-size:0.85rem;">\u0639\u0631\u0636 \u0627\u0644\u0633\u062c\u0644 \u0627\u0644\u062a\u062c\u0627\u0631\u064a</a>' +
        '</div>';
    }

    var merchantActionBtn = user.merchantVerified
      ? '<button class="btn btn-warning btn-sm" onclick="revokeMerchant(\'' + U.escapeHtml(user.id) + '\')">\u0625\u0644\u063a\u0627\u0621 \u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u062a\u0627\u062c\u0631</button>'
      : '<button class="btn btn-success btn-sm" onclick="verifyMerchant(\'' + U.escapeHtml(user.id) + '\')">\u062a\u0648\u062b\u064a\u0642 \u0643\u062a\u0627\u062c\u0631</button>';

    document.getElementById('userDetailBody').innerHTML =
      '<div class="user-detail-header">' +
      '<div class="user-detail-avatar">' + initial + '</div>' +
      '<div class="user-detail-info"><h3>' + U.escapeHtml(user.firstName + ' ' + user.lastName) + '</h3>' +
      '<p>' + U.escapeHtml(user.email) + (user.storeName ? ' \u2014 ' + U.escapeHtml(user.storeName) : '') + '</p></div>' +
      '</div>' +
      '<div class="user-detail-grid">' +
      detailItem('\u0627\u0644\u0647\u0627\u062a\u0641', U.escapeHtml(user.phone || '\u2014')) +
      detailItem('\u062a\u0627\u0631\u064a\u062e \u0627\u0644\u062a\u0633\u062c\u064a\u0644', U.escapeHtml(user.createdAt)) +
      detailItem('\u0627\u0644\u0645\u062a\u062c\u0631', U.escapeHtml(user.storeName || '\u2014')) +
      detailItem('\u0627\u0644\u062d\u0627\u0644\u0629', user.suspended ? '\u0645\u0639\u0644\u0651\u0642' : '\u0646\u0634\u0637') +
      detailItem('\u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a', U.formatNumber(userProducts.length)) +
      detailItem('\u0627\u0644\u0637\u0644\u0628\u0627\u062a', U.formatNumber(userOrders.length)) +
      detailItem('\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a', U.formatNumber(user.totalSales || 0)) +
      detailItem('\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a', U.formatCurrency(user.totalRevenue || 0)) +
      detailItem('\u0627\u0644\u0631\u0635\u064a\u062f \u0627\u0644\u0645\u062a\u0627\u062d', U.formatCurrency(user.balance || 0)) +
      detailItem('\u0627\u0644\u0628\u0646\u0643', U.escapeHtml(user.bankName || '\u2014')) +
      detailItem('IBAN', U.escapeHtml(user.iban || '\u2014')) +
      detailItem('\u0627\u0644\u0648\u0635\u0641', U.escapeHtml(user.storeDesc || '\u2014')) +
      '</div>' +
      // === Verification Section ===
      '<div style="margin-top:20px;padding:16px;background:var(--bg-warm);border:1.5px solid var(--border-taupe);border-radius:var(--radius-btn);">' +
      '<h4 style="margin:0 0 12px;font-size:0.9rem;color:var(--accent-amber);">\u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u0648\u062b\u064a\u0642</h4>' +
      '<div class="user-detail-grid">' +
      detailItem('\u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u062a\u0627\u062c\u0631', merchantVerifiedBadge) +
      detailItem('\u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u0628\u0627\u0626\u0639 (\u062a\u0644\u0642\u0627\u0626\u064a)', sellerVerifiedBadge) +
      detailItem('\u0627\u0644\u0645\u0632\u0627\u062f\u0627\u062a \u0627\u0644\u0645\u0643\u062a\u0645\u0644\u0629', U.formatNumber(user.completedAuctions || 0)) +
      '</div>' +
      commercialRegisterHtml +
      '</div>';

    document.getElementById('userDetailFooter').innerHTML =
      merchantActionBtn +
      '<button class="btn ' + (user.suspended ? 'btn-success' : 'btn-warning') + ' btn-sm" onclick="toggleUserStatus(\'' + U.escapeHtml(user.id) + '\');closeModal(\'userDetailModal\');">' + (user.suspended ? '\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628' : '\u062a\u0639\u0644\u064a\u0642 \u0627\u0644\u062d\u0633\u0627\u0628') + '</button>' +
      '<button class="btn btn-outline btn-sm" onclick="closeModal(\'userDetailModal\')">\u0625\u063a\u0644\u0627\u0642</button>';

    document.getElementById('userDetailModal').classList.add('open');
  };

  window.toggleUserStatus = async function(userId) {
    var user = allUsers.find(function(u) { return u.id === userId; });
    if (!user || user.role === 'admin') return;

    var newSuspended = !user.suspended;
    var ok = await SAIDAT.profiles.update({ id: userId, suspended: newSuspended });
    if (!ok) {
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623 \u0641\u064a \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u062d\u0627\u0644\u0629', 'error');
      return;
    }
    await refreshData();
    renderUsers();
    renderDashboard();
    SAIDAT.ui.showToast(newSuspended ? '\u062a\u0645 \u062a\u0639\u0644\u064a\u0642 \u0627\u0644\u062d\u0633\u0627\u0628' : '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u062d\u0633\u0627\u0628', 'success');
  };

  window.deleteUserAction = async function(userId) {
    if (!confirm('\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062d\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u061f \u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u062a\u0631\u0627\u062c\u0639 \u0639\u0646 \u0647\u0630\u0627 \u0627\u0644\u0625\u062c\u0631\u0627\u0621.')) return;
    await SAIDAT.profiles.suspend(userId);
    await refreshData();
    renderUsers();
    renderDashboard();
    renderProducts();
    renderOrders();
    renderFinance();
    SAIDAT.ui.showToast('\u062a\u0645 \u062d\u0630\u0641 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0628\u0646\u062c\u0627\u062d', 'success');
  };

  // ===== MERCHANT VERIFICATION =====
  window.verifyMerchant = async function(userId) {
    if (!confirm('\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u062a\u0648\u062b\u064a\u0642 \u0647\u0630\u0627 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0643\u062a\u0627\u062c\u0631\u061f')) return;
    await SAIDAT.profiles.update({ id: userId, merchantVerified: true });
    await refreshData();
    renderUsers();
    closeModal('userDetailModal');
    SAIDAT.ui.showToast('\u062a\u0645 \u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645 \u0643\u062a\u0627\u062c\u0631 \u0628\u0646\u062c\u0627\u062d', 'success');
  };

  window.revokeMerchant = async function(userId) {
    if (!confirm('\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0625\u0644\u063a\u0627\u0621 \u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u062a\u0627\u062c\u0631\u061f')) return;
    await SAIDAT.profiles.update({ id: userId, merchantVerified: false });
    await refreshData();
    renderUsers();
    closeModal('userDetailModal');
    SAIDAT.ui.showToast('\u062a\u0645 \u0625\u0644\u063a\u0627\u0621 \u062a\u0648\u062b\u064a\u0642 \u0627\u0644\u062a\u0627\u062c\u0631', 'success');
  };

  // ===== RENDER PRODUCTS =====
  window.renderProducts = async function() {
    await refreshData();
    var searchVal = (document.getElementById('productSearch').value || '').toLowerCase();
    var typeFilter = document.getElementById('productTypeFilter').value;
    var statusFilter = document.getElementById('productStatusFilter').value;

    var filtered = allProducts.filter(function(p) {
      if (searchVal && (p.name || '').toLowerCase().indexOf(searchVal) === -1) return false;
      if (typeFilter !== 'all' && p.listing_type !== typeFilter) return false;
      if (statusFilter === 'active' && !p.active) return false;
      if (statusFilter === 'inactive' && p.active) return false;
      var approvalStatus = p.approval_status || 'pending';
      if (productApprovalFilter !== 'all' && approvalStatus !== productApprovalFilter) return false;
      return true;
    });

    var html = '';
    filtered.forEach(function(p) {
      var sellerName = '';
      if (p.profiles) {
        sellerName = U.escapeHtml((p.profiles.first_name || '') + ' ' + (p.profiles.last_name || ''));
      } else {
        sellerName = getSellerName(p.seller_id);
      }

      var priceDisplay = p.listing_type === 'auction'
        ? U.formatCurrency(p.price || 0) + ' <span style="font-size:0.7rem;opacity:0.6;">(\u0645\u0632\u0627\u064a\u062f\u0629)</span>'
        : U.formatCurrency(p.price || 0);
      var statusBdg = p.active
        ? '<span class="status status-completed"><span class="status-dot"></span>\u0646\u0634\u0637</span>'
        : '<span class="status status-cancelled"><span class="status-dot"></span>\u0645\u062a\u0648\u0642\u0641</span>';

      var approvalStatus = p.approval_status || 'pending';
      var approvalBadge = '';
      if (approvalStatus === 'pending') {
        approvalBadge = '<span class="status" style="background:rgba(243,156,18,0.1);color:#F39C12"><span class="status-dot" style="background:#F39C12"></span>\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629</span>';
      } else if (approvalStatus === 'rejected') {
        approvalBadge = '<span class="status" style="background:rgba(231,76,60,0.1);color:#E74C3C"><span class="status-dot" style="background:#E74C3C"></span>\u0645\u0631\u0641\u0648\u0636</span>';
      } else {
        approvalBadge = '<span class="status" style="background:rgba(39,174,96,0.1);color:#27AE60"><span class="status-dot" style="background:#27AE60"></span>\u0645\u0639\u062a\u0645\u062f</span>';
      }

      var approvalActions = '';
      if ((p.approval_status || 'pending') === 'pending') {
        approvalActions = '<button class="btn btn-sm" style="background:#27AE60;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.78rem;margin-left:4px" onclick="approveProduct(\'' + U.escapeHtml(p.id) + '\')">\u2713 \u0627\u0639\u062a\u0645\u0627\u062f</button>' +
          '<button class="btn btn-sm" style="background:#E74C3C;color:#fff;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:0.78rem;margin-left:4px" onclick="rejectProduct(\'' + U.escapeHtml(p.id) + '\')">\u2717 \u0631\u0641\u0636</button>';
      }

      var imgUrl = U.safeImageUrl(p.image_url || p.image || '');

      html += '<tr>' +
        '<td><div style="display:flex;align-items:center;gap:10px;">' +
        '<img src="' + U.escapeHtml(imgUrl) + '" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" onerror="this.style.display=\'none\'">' +
        '<div><div style="font-weight:600;">' + U.escapeHtml(p.name || '') + '</div>' +
        '<div style="font-size:0.72rem;color:var(--text-medium);opacity:0.6;">' + U.escapeHtml(p.origin || '') + ' \u2014 ' + U.escapeHtml(p.weight || '') + ' ' + U.escapeHtml(p.unit || '') + '</div>' +
        '</div></div></td>' +
        '<td>' + sellerName + '</td>' +
        '<td>' + U.listingBadge(p.listing_type) + '</td>' +
        '<td>' + U.escapeHtml(p.category || '\u2014') + '</td>' +
        '<td>' + priceDisplay + '</td>' +
        '<td>' + U.formatNumber(p.stock || 0) + '</td>' +
        '<td>' + statusBdg + '</td>' +
        '<td>' + approvalBadge + '</td>' +
        '<td><div class="table-actions">' +
        approvalActions +
        '<button class="btn btn-outline btn-sm" onclick="toggleProduct(\'' + U.escapeHtml(p.id) + '\')">' + (p.active ? '\u0625\u064a\u0642\u0627\u0641' : '\u062a\u0641\u0639\u064a\u0644') + '</button>' +
        '<button class="btn btn-danger btn-sm" onclick="removeProduct(\'' + U.escapeHtml(p.id) + '\')">\u0625\u0632\u0627\u0644\u0629</button>' +
        '</div></td>' +
        '</tr>';
    });
    document.getElementById('adminProductsBody').innerHTML = html || emptyRow(9);

    // Update pending count badge
    var pendingCount = allProducts.filter(function(p) { return (p.approval_status || 'pending') === 'pending'; }).length;
    var countEl = document.getElementById('pendingProductsCount');
    if (countEl) countEl.textContent = pendingCount;
  };

  window.toggleProduct = async function(productId) {
    var product = allProducts.find(function(p) { return p.id === productId; });
    if (!product) return;
    var newActive = !product.active;
    var ok = await SAIDAT.products.update(productId, { active: newActive });
    if (!ok) {
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623', 'error');
      return;
    }
    await refreshData();
    renderProducts();
    renderDashboard();
    SAIDAT.ui.showToast(newActive ? '\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0645\u0646\u062a\u062c' : '\u062a\u0645 \u0625\u064a\u0642\u0627\u0641 \u0627\u0644\u0645\u0646\u062a\u062c', 'success');
  };

  window.removeProduct = async function(productId) {
    if (!confirm('\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0625\u0632\u0627\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c\u061f')) return;
    var ok = await SAIDAT.products.remove(productId);
    if (!ok) {
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623', 'error');
      return;
    }
    await refreshData();
    renderProducts();
    renderDashboard();
    SAIDAT.ui.showToast('\u062a\u0645 \u0625\u0632\u0627\u0644\u0629 \u0627\u0644\u0645\u0646\u062a\u062c', 'success');
  };

  // ===== RENDER ORDERS =====
  window.renderOrders = function() {
    // Update counts
    var counts = { all: allOrders.length, new: 0, processing: 0, completed: 0, cancelled: 0 };
    allOrders.forEach(function(o) {
      if (counts.hasOwnProperty(o.status)) counts[o.status]++;
    });
    document.getElementById('adminCountAll').textContent = counts.all;
    document.getElementById('adminCountNew').textContent = counts['new'];
    document.getElementById('adminCountProcessing').textContent = counts.processing;
    document.getElementById('adminCountCompleted').textContent = counts.completed;
    document.getElementById('adminCountCancelled').textContent = counts.cancelled;

    var filtered = currentOrderFilter === 'all' ? allOrders : allOrders.filter(function(o) { return o.status === currentOrderFilter; });

    var html = '';
    filtered.forEach(function(o) {
      var commission = ((o.total || 0) * CFG.COMMISSION_RATE).toFixed(2);
      var sellerName = '';
      if (o.profiles) {
        sellerName = U.escapeHtml((o.profiles.first_name || '') + ' ' + (o.profiles.last_name || ''));
      } else {
        sellerName = getSellerName(o.seller_id);
      }
      html += '<tr>' +
        '<td><strong>' + U.escapeHtml(o.id ? o.id.substring(0, 8) : '') + '</strong></td>' +
        '<td>' + U.escapeHtml(o.product_name || '') + '</td>' +
        '<td>' + sellerName + '</td>' +
        '<td>' + U.escapeHtml(o.buyer_name || '') + '</td>' +
        '<td>' + U.formatCurrency(o.total || 0) + '</td>' +
        '<td style="color:#E67E22;font-weight:600;">' + U.formatCurrency(commission) + '</td>' +
        '<td>' + statusBadge(o.status || 'new') + '</td>' +
        '<td>' + U.escapeHtml(o.created_at ? o.created_at.split('T')[0] : '') + '</td>' +
        '<td><button class="btn btn-outline btn-sm" onclick="showOrderDetail(\'' + U.escapeHtml(o.id) + '\')">\u062a\u0641\u0627\u0635\u064a\u0644</button></td>' +
        '</tr>';
    });
    document.getElementById('adminOrdersBody').innerHTML = html || emptyRow(9);
  };

  window.filterAdminOrders = function(filter) {
    currentOrderFilter = filter;
    document.querySelectorAll('#adminOrderTabs .tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === filter);
    });
    renderOrders();
  };

  window.showOrderDetail = function(orderId) {
    var order = allOrders.find(function(o) { return o.id === orderId; });
    if (!order) return;

    var sellerName = '';
    if (order.profiles) {
      sellerName = U.escapeHtml((order.profiles.first_name || '') + ' ' + (order.profiles.last_name || ''));
    } else {
      sellerName = getSellerName(order.seller_id);
    }

    var commission = ((order.total || 0) * CFG.COMMISSION_RATE).toFixed(2);

    document.getElementById('orderDetailBody').innerHTML =
      '<div class="order-detail-grid">' +
      '<div>' +
      '<h4 style="margin:0 0 12px;font-size:0.9rem;color:var(--accent-amber);">\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0637\u0644\u0628</h4>' +
      detailItem('\u0631\u0642\u0645 \u0627\u0644\u0637\u0644\u0628', U.escapeHtml(order.id || '')) +
      detailItem('\u0627\u0644\u062d\u0627\u0644\u0629', U.escapeHtml(CFG.STATUS_LABELS[order.status] || order.status || '')) +
      detailItem('\u0627\u0644\u062a\u0627\u0631\u064a\u062e', U.escapeHtml(order.created_at ? order.created_at.split('T')[0] : '')) +
      detailItem('\u0637\u0631\u064a\u0642\u0629 \u0627\u0644\u0634\u062d\u0646', U.escapeHtml(order.shipping_method || '\u2014')) +
      '</div><div>' +
      '<h4 style="margin:0 0 12px;font-size:0.9rem;color:var(--accent-amber);">\u0627\u0644\u0645\u0646\u062a\u062c \u0648\u0627\u0644\u0645\u0628\u0644\u063a</h4>' +
      detailItem('\u0627\u0644\u0645\u0646\u062a\u062c', U.escapeHtml(order.product_name || '')) +
      detailItem('\u0627\u0644\u0643\u0645\u064a\u0629', U.escapeHtml(String(order.qty || 1))) +
      detailItem('\u0627\u0644\u0633\u0639\u0631', U.formatCurrency(order.price || 0)) +
      detailItem('\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a', U.formatCurrency(order.total || 0)) +
      detailItem('\u0627\u0644\u0634\u062d\u0646', U.formatCurrency(order.shipping || 0)) +
      detailItem('\u0627\u0644\u0639\u0645\u0648\u0644\u0629', U.formatCurrency(commission)) +
      '</div><div>' +
      '<h4 style="margin:0 0 12px;font-size:0.9rem;color:var(--accent-amber);">\u0627\u0644\u0623\u0637\u0631\u0627\u0641</h4>' +
      detailItem('\u0627\u0644\u0628\u0627\u0626\u0639', sellerName) +
      detailItem('\u0627\u0644\u0645\u0634\u062a\u0631\u064a', U.escapeHtml(order.buyer_name || '')) +
      detailItem('\u0647\u0627\u062a\u0641 \u0627\u0644\u0645\u0634\u062a\u0631\u064a', U.escapeHtml(order.buyer_phone || '\u2014')) +
      detailItem('\u0627\u0644\u0645\u062f\u064a\u0646\u0629', U.escapeHtml(order.buyer_city || '\u2014')) +
      detailItem('\u0627\u0644\u062d\u064a', U.escapeHtml(order.buyer_district || '\u2014')) +
      detailItem('\u0627\u0644\u0634\u0627\u0631\u0639', U.escapeHtml(order.buyer_street || '\u2014')) +
      '</div></div>';

    document.getElementById('orderDetailModal').classList.add('open');
  };

  // ===== RENDER FINANCE =====
  function renderFinance() {
    var sellers = getSellers();

    var totalRevenue = sellers.reduce(function(s, u) { return s + (u.totalRevenue || 0); }, 0);
    var totalCommission = allTransactions
      .filter(function(t) { return t.type === 'commission'; })
      .reduce(function(s, t) { return s + Math.abs(t.amount || 0); }, 0);
    var pendingWithdrawals = allTransactions
      .filter(function(t) { return t.type === 'withdrawal' && t.status === 'pending'; })
      .reduce(function(s, t) { return s + Math.abs(t.amount || 0); }, 0);
    var paidOut = allTransactions
      .filter(function(t) { return t.type === 'withdrawal' && t.status === 'completed'; })
      .reduce(function(s, t) { return s + Math.abs(t.amount || 0); }, 0);

    document.getElementById('financeStatsGrid').innerHTML =
      statCard('revenue', '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a', U.formatCurrency(totalRevenue), '\u0645\u0628\u064a\u0639\u0627\u062a \u062c\u0645\u064a\u0639 \u0627\u0644\u062a\u062c\u0627\u0631') +
      statCard('commission', '\u0627\u0644\u0639\u0645\u0648\u0644\u0627\u062a \u0627\u0644\u0645\u062d\u0635\u0651\u0644\u0629', U.formatCurrency(totalCommission), '\u0623\u0631\u0628\u0627\u062d \u0627\u0644\u0645\u0646\u0635\u0629 (5%)') +
      statCard('orders', '\u0633\u062d\u0648\u0628\u0627\u062a \u0645\u0639\u0644\u0651\u0642\u0629', U.formatCurrency(pendingWithdrawals), '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629') +
      statCard('users', '\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u062f\u0641\u0648\u0639', U.formatCurrency(paidOut), '\u062a\u0645 \u062a\u062d\u0648\u064a\u0644\u0647 \u0644\u0644\u062a\u062c\u0627\u0631');

    // Commission table
    var commissions = allTransactions.filter(function(t) { return t.type === 'commission'; });
    var cHtml = '';
    commissions.forEach(function(t) {
      var sellerName = '';
      if (t.profiles) {
        sellerName = U.escapeHtml((t.profiles.first_name || '') + ' ' + (t.profiles.last_name || ''));
      } else {
        sellerName = getSellerName(t.seller_id);
      }
      // Find matching sale transaction
      var saleTxn = allTransactions.find(function(s) { return s.ref === t.ref && s.type === 'sale'; });
      var saleAmount = saleTxn ? saleTxn.amount : 0;
      cHtml += '<tr>' +
        '<td>' + U.escapeHtml(t.created_at ? t.created_at.split('T')[0] : '') + '</td>' +
        '<td>' + sellerName + '</td>' +
        '<td>' + U.escapeHtml(t.ref || t.order_id || '') + '</td>' +
        '<td>' + U.formatCurrency(saleAmount) + '</td>' +
        '<td style="color:#E67E22;font-weight:600;">' + U.formatCurrency(Math.abs(t.amount || 0)) + '</td>' +
        '<td>' + statusBadge(t.status || 'completed') + '</td>' +
        '</tr>';
    });
    document.getElementById('commissionBody').innerHTML = cHtml || emptyRow(6);

    // Withdrawals table
    var withdrawals = allTransactions.filter(function(t) { return t.type === 'withdrawal'; });
    var wHtml = '';
    withdrawals.forEach(function(t) {
      var sellerName = '';
      if (t.profiles) {
        sellerName = U.escapeHtml((t.profiles.first_name || '') + ' ' + (t.profiles.last_name || ''));
      } else {
        sellerName = getSellerName(t.seller_id);
      }
      // Find seller for bank name
      var seller = allUsers.find(function(u) { return u.id === t.seller_id; });
      var bankName = seller ? U.escapeHtml(seller.bankName || '\u2014') : '\u2014';

      var statusBdg = t.status === 'completed'
        ? '<span class="status status-completed"><span class="status-dot"></span>\u0645\u0643\u062a\u0645\u0644</span>'
        : '<span class="status status-pending-withdrawal"><span class="status-dot"></span>\u0645\u0639\u0644\u0651\u0642</span>';
      var actions = t.status === 'pending'
        ? '<div class="table-actions">' +
          '<button class="btn btn-success btn-sm" onclick="approveWithdrawal(\'' + U.escapeHtml(t.id) + '\')">\u0645\u0648\u0627\u0641\u0642\u0629</button>' +
          '<button class="btn btn-danger btn-sm" onclick="rejectWithdrawal(\'' + U.escapeHtml(t.id) + '\')">\u0631\u0641\u0636</button>' +
          '</div>'
        : '<span style="opacity:0.4;">\u2014</span>';

      wHtml += '<tr>' +
        '<td>' + U.escapeHtml(t.created_at ? t.created_at.split('T')[0] : '') + '</td>' +
        '<td>' + sellerName + '</td>' +
        '<td>' + bankName + '</td>' +
        '<td style="font-weight:600;">' + U.formatCurrency(Math.abs(t.amount || 0)) + '</td>' +
        '<td>' + statusBdg + '</td>' +
        '<td>' + actions + '</td>' +
        '</tr>';
    });
    document.getElementById('withdrawalsBody').innerHTML = wHtml || emptyRow(6);
  }

  window.approveWithdrawal = async function(txnId) {
    var sb = U.getSupabase();
    if (!sb) return;
    try {
      var res = await sb.from('transactions').update({ status: 'completed' }).eq('id', txnId);
      if (res.error) {
        SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623', 'error');
        return;
      }
    } catch(e) {
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623', 'error');
      return;
    }
    await refreshData();
    renderFinance();
    renderDashboard();
    SAIDAT.ui.showToast('\u062a\u0645\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0637\u0644\u0628 \u0627\u0644\u0633\u062d\u0628', 'success');
  };

  window.rejectWithdrawal = async function(txnId) {
    if (!confirm('\u0647\u0644 \u0623\u0646\u062a \u0645\u062a\u0623\u0643\u062f \u0645\u0646 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0633\u062d\u0628\u061f')) return;
    var sb = U.getSupabase();
    if (!sb) return;

    // Find the transaction to get seller_id and amount for balance refund
    var txn = allTransactions.find(function(t) { return t.id === txnId; });
    if (!txn) return;

    try {
      // Update transaction status
      await sb.from('transactions').update({ status: 'rejected' }).eq('id', txnId);

      // Refund balance to seller
      if (txn.seller_id && txn.amount) {
        var seller = allUsers.find(function(u) { return u.id === txn.seller_id; });
        if (seller) {
          var newBalance = (seller.balance || 0) + Math.abs(txn.amount);
          await SAIDAT.profiles.update({ id: txn.seller_id, balance: newBalance });
        }
      }
    } catch(e) {
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623', 'error');
      return;
    }
    await refreshData();
    renderFinance();
    renderDashboard();
    SAIDAT.ui.showToast('\u062a\u0645 \u0631\u0641\u0636 \u0637\u0644\u0628 \u0627\u0644\u0633\u062d\u0628 \u0648\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u0628\u0644\u063a \u0644\u0644\u0631\u0635\u064a\u062f', 'success');
  };

  // ===== SETTINGS =====
  async function loadSettings() {
    var settings = await SAIDAT.admin.getSettings();
    document.getElementById('settingSiteName').value = settings.siteName || settings.site_name || '\u0635\u064a\u062f\u0627\u062a \u0627\u0644\u0639\u0648\u062f';
    document.getElementById('settingContactEmail').value = settings.contactEmail || settings.contact_email || 'info@saidat.com';
    document.getElementById('settingCommission').value = settings.commissionRate || settings.commission_rate || 5;
    if (settings.terms) document.getElementById('settingTerms').value = settings.terms;
    if (settings.returnPolicy || settings.return_policy) {
      document.getElementById('settingReturnPolicy').value = settings.returnPolicy || settings.return_policy;
    }
  }
  window.loadSettings = loadSettings;

  window.saveSettings = async function() {
    var siteName = document.getElementById('settingSiteName').value.trim();
    var contactEmail = document.getElementById('settingContactEmail').value.trim();
    var commissionRate = parseFloat(document.getElementById('settingCommission').value) || 5;
    var terms = document.getElementById('settingTerms').value.trim();
    var returnPolicy = document.getElementById('settingReturnPolicy').value.trim();

    await SAIDAT.admin.setSetting('site_name', siteName);
    await SAIDAT.admin.setSetting('contact_email', contactEmail);
    await SAIDAT.admin.setSetting('commission_rate', commissionRate);
    await SAIDAT.admin.setSetting('terms', terms);
    await SAIDAT.admin.setSetting('return_policy', returnPolicy);

    SAIDAT.ui.showToast('\u062a\u0645 \u062d\u0641\u0638 \u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0628\u0646\u062c\u0627\u062d', 'success');
  };

  // ===== MODALS =====
  function closeModal(id) {
    SAIDAT.ui.closeModal(id);
  }
  window.closeModal = closeModal;

  // Close modal on overlay click
  document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });

  // ===== HELPERS =====
  function detailItem(label, value) {
    return '<div class="detail-item"><div class="detail-label">' + U.escapeHtml(label) + '</div><div class="detail-value">' + (value || '') + '</div></div>';
  }

  function emptyRow(cols) {
    return '<tr><td colspan="' + cols + '"><div class="empty-state"><svg viewBox="0 0 24 24" width="48" height="48" fill="#ccc"><path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/></svg><h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a</h3></div></td></tr>';
  }

  // ===== PRODUCT APPROVAL =====
  window.approveProduct = async function(productId) {
    var ok = await SAIDAT.products.update(productId, { approval_status: 'approved', active: true });
    if (!ok) {
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623', 'error');
      return;
    }
    await refreshData();
    renderProducts();
    renderDashboard();
    SAIDAT.ui.showToast('\u062a\u0645\u062a \u0627\u0644\u0645\u0648\u0627\u0641\u0642\u0629 \u0639\u0644\u0649 \u0627\u0644\u0645\u0646\u062a\u062c \u2713', 'success');
  };

  window.rejectProduct = async function(productId) {
    var reason = prompt('\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a):') || '';
    var updates = { approval_status: 'rejected', active: false };
    if (reason) updates.rejection_reason = reason;
    var ok = await SAIDAT.products.update(productId, updates);
    if (!ok) {
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623', 'error');
      return;
    }
    await refreshData();
    renderProducts();
    renderDashboard();
    SAIDAT.ui.showToast('\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0645\u0646\u062a\u062c', 'success');
  };

  window.filterProductApproval = function(filter) {
    productApprovalFilter = filter;
    var tabs = document.querySelectorAll('#productApprovalTabs .tab-btn');
    tabs.forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === filter);
    });
    renderProducts();
  };

  // ===== HASH CHANGE =====
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById('section-' + hash)) {
      switchSection(hash);
    }
  });

  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdmin);
  } else {
    initAdmin();
  }

})();
