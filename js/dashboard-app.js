// ===== dashboard-app.js — تطبيق لوحة التحكم — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, profiles.js, products.js,
//             orders.js, transactions.js, ui.js

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var CFG = SAIDAT.config;

  // ===== حالة التطبيق =====
  var currentUser = null;
  var currentOrderFilter = 'all';

  // عناوين الأقسام
  var SECTION_TITLES = {
    overview: 'نظرة عامة',
    products: 'المنتجات',
    orders: 'الطلبات',
    finance: 'المالية',
    profile: 'الملف الشخصي'
  };

  // ===== التهيئة =====
  async function initDashboard() {
    console.log('Dashboard: waiting for auth...');

    // انتظار auth مع timeout — لو علّق نعيد المحاولة
    var authTimeout = new Promise(function(resolve) { setTimeout(resolve, 10000); });
    await Promise.race([SAIDAT.auth.ready(), authTimeout]);
    console.log('Dashboard: auth ready, isLoggedIn =', SAIDAT.auth.isLoggedIn());

    currentUser = SAIDAT.auth.getCurrentUser();

    // لو ما في مستخدم — ننتظر 3 ثوانٍ ونعيد المحاولة (ممكن auth بطيء)
    if (!currentUser) {
      console.log('Dashboard: no user yet, retrying in 3s...');
      await new Promise(function(r) { setTimeout(r, 3000); });
      currentUser = SAIDAT.auth.getCurrentUser();
    }

    if (!currentUser) {
      console.warn('Dashboard: no currentUser after retry → redirecting to login');
      window.location.href = 'login.html';
      return;
    }
    console.log('Dashboard: user loaded =', currentUser.email);

    // جلب البيانات من Supabase وإضافتها للمستخدم
    try {
      var products = await SAIDAT.products.getForSeller();
      var orders = await SAIDAT.orders.getForSeller();
      var transactions = await SAIDAT.transactions.getForSeller();
      var monthlySales = await SAIDAT.transactions.getMonthlySales();

      currentUser.products = products || [];
      currentUser.orders = orders || [];
      currentUser.transactions = transactions || [];
      currentUser.monthlySales = monthlySales.length > 0 ? monthlySales : CFG.DEFAULT_MONTHLY_SALES.slice();
    } catch(e) {
      console.warn('Data load error:', e);
      currentUser.products = [];
      currentUser.orders = [];
      currentUser.transactions = [];
      currentUser.monthlySales = CFG.DEFAULT_MONTHLY_SALES.slice();
    }

    updateSidebar();
    renderOverview();
    renderProducts();
    renderOrders();
    renderFinance();
    loadProfile();

    // Handle hash navigation
    var hash = window.location.hash.replace('#', '');
    if (hash && document.getElementById('section-' + hash)) {
      SAIDAT.ui.switchSection(hash, SECTION_TITLES);
    }
  }

  // ===== SIDEBAR =====
  function updateSidebar() {
    var initial = U.escapeHtml(currentUser.firstName.charAt(0));
    document.getElementById('sidebarAvatar').textContent = currentUser.firstName.charAt(0);
    document.getElementById('sidebarName').textContent = currentUser.firstName + ' ' + currentUser.lastName;

    // تحديث حالة التوثيق
    var roleEl = document.querySelector('.sidebar-user-role');
    if (roleEl) {
      var isMerchant = currentUser.merchantVerified;
      var isSeller = currentUser.sellerVerified;
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
    var user = currentUser;
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

  // ===== PRODUCTS =====
  function renderProducts() {
    var user = currentUser;
    var html = '';

    if (user.products.length === 0) {
      document.getElementById('productsBody').innerHTML = '<tr><td colspan="8"><div class="empty-state"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 14H9v-2h6v2zm3-4H7v-2h10v2zm0-4H7V6h10v2z"/></svg><h3>لا توجد منتجات</h3><p>أضف منتجك الأول الآن</p></div></td></tr>';
      return;
    }

    user.products.forEach(function(p) {
      var pName = U.escapeHtml(p.name);
      var pImage = U.safeImageUrl(p.image);
      var pCategory = U.escapeHtml(p.category);
      var pType = U.escapeHtml(p.type);
      var pOrigin = U.escapeHtml(p.origin);
      var listingType = p.listingType || p.listing_type || 'market';

      var listingHTML = '';
      var priceHTML = '';
      if (listingType === 'auction') {
        var auctionType = p.auctionType || p.auction_type || 'timed';
        var auctionStatus = p.auctionStatus || p.auction_status;
        var startPrice = p.startPrice || p.start_price || 0;
        var buyNowPrice = p.buyNow || p.buy_now;
        var auctionTypeLabel = auctionType === 'until_sold' ? 'منتهي بالبيع' : 'محدد بوقت';
        var isLive = auctionStatus === 'live';
        var badgeClass = isLive ? 'badge-auction-live' : 'badge-auction';
        listingHTML = '<span class="listing-badge ' + badgeClass + '"><svg viewBox="0 0 24 24"><path d="M17.65 6.35a7.95 7.95 0 0 0-11.3 0L12 12l5.65-5.65zM12 22c5.52 0 10-4.48 10-10h-4c0 3.31-2.69 6-6 6s-6-2.69-6-6H2c0 5.52 4.48 10 10 10z"/></svg>' + (isLive ? 'مزاد جارٍ' : 'مزاد') + '</span>' +
          '<div class="auction-info-sm">' + U.escapeHtml(auctionTypeLabel) + '</div>';
        var currentBid = (p.bids && p.bids.length > 0) ? p.bids[p.bids.length - 1].amount : startPrice;
        priceHTML = '<div style="font-weight:600;">' + U.formatCurrency(currentBid) + '</div><div class="auction-info-sm">افتتاحي: ' + U.formatCurrency(startPrice) + '</div>';
        if (buyNowPrice) priceHTML += '<div class="auction-info-sm">فوري: ' + U.formatCurrency(buyNowPrice) + '</div>';
      } else {
        listingHTML = '<span class="listing-badge badge-market"><svg viewBox="0 0 24 24"><path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/></svg> سوق</span>';
        priceHTML = U.formatCurrency(p.price);
      }

      var approvalStatus = p.approval_status || p.approvalStatus || 'approved';
      var approvalBadge = '';
      if (approvalStatus === 'pending') {
        approvalBadge = '<span class="badge badge-warning">بانتظار الموافقة</span>';
      } else if (approvalStatus === 'approved') {
        approvalBadge = '<span class="badge badge-success">معتمد</span>';
      } else if (approvalStatus === 'rejected') {
        approvalBadge = '<span class="badge badge-danger">مرفوض</span>';
      }

      html +=
        '<tr>' +
          '<td><div class="product-name-cell"><img class="product-thumb" src="' + pImage + '" alt="' + pName + '" onerror="this.style.background=\'linear-gradient(135deg,#4A2C1A,#C19A6B)\';this.src=\'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==\'"><span>' + pName + '</span></div></td>' +
          '<td>' + listingHTML + '</td>' +
          '<td>' + pCategory + ' / ' + pType + '</td>' +
          '<td>' + pOrigin + '</td>' +
          '<td style="font-weight:600;">' + priceHTML + '</td>' +
          '<td>' + p.stock + '</td>' +
          '<td>' + (p.active ? '<span class="status status-active"><span class="status-dot"></span>نشط</span>' : '<span class="status status-inactive"><span class="status-dot"></span>متوقف</span>') + '</td>' +
          '<td>' + approvalBadge + '</td>' +
          '<td><div class="action-btns">' +
            '<button class="btn btn-sm btn-outline" onclick="editProduct(\'' + U.escapeHtml(p.id) + '\')">تعديل</button>' +
            '<button class="btn btn-sm ' + (p.active ? 'btn-warning' : 'btn-success') + '" onclick="toggleProduct(\'' + U.escapeHtml(p.id) + '\')">' + (p.active ? 'إيقاف' : 'تفعيل') + '</button>' +
            '<button class="btn btn-sm btn-danger" onclick="deleteProduct(\'' + U.escapeHtml(p.id) + '\')">حذف</button>' +
          '</div></td>' +
        '</tr>';
    });

    document.getElementById('productsBody').innerHTML = html;
  }

  // ===== ADD CHOOSER =====
  function openAddChooser() {
    SAIDAT.ui.openModal('addChooserModal');
    // Reset selection
    document.querySelectorAll('#addChooserModal .chooser-card').forEach(function(c) { c.classList.remove('selected'); });
  }

  function closeAddChooser() {
    SAIDAT.ui.closeModal('addChooserModal');
  }

  function chooseListingType(type) {
    closeAddChooser();
    openProductModal(null, type);
  }

  function selectAuctionType(type) {
    document.querySelectorAll('.auction-type-btn').forEach(function(btn) {
      btn.classList.toggle('selected', btn.dataset.atype === type);
    });
    // Show/hide duration field
    var durationGroup = document.getElementById('auctionDurationGroup');
    if (type === 'until_sold') {
      durationGroup.style.display = 'none';
    } else {
      durationGroup.style.display = 'block';
    }
  }

  function updateFormForListingType(type) {
    var auctionFields = document.getElementById('auctionFields');
    var priceGroup = document.getElementById('priceGroup');
    var priceLabelText = document.getElementById('priceLabelText');
    var saveBtn = document.getElementById('saveProductBtn');

    if (type === 'auction') {
      auctionFields.classList.add('visible');
      priceGroup.style.display = 'none';
      priceLabelText.textContent = 'السعر (ر.س)';
      saveBtn.textContent = 'طرح المزاد';
      document.getElementById('productModalTitle').textContent = document.getElementById('editProductId').value ? 'تعديل المزاد' : 'طرح مزاد جديد';
    } else {
      auctionFields.classList.remove('visible');
      priceGroup.style.display = 'block';
      priceLabelText.textContent = 'السعر (ر.س)';
      saveBtn.textContent = 'حفظ المنتج';
      document.getElementById('productModalTitle').textContent = document.getElementById('editProductId').value ? 'تعديل المنتج' : 'طرح في السوق';
    }
  }

  function openProductModal(editId, listingType) {
    document.getElementById('editProductId').value = editId || '';
    var type = listingType || 'market';

    if (editId) {
      var p = currentUser.products.find(function(pr) { return pr.id === editId; });
      if (p) {
        type = p.listingType || p.listing_type || 'market';
        document.getElementById('pmName').value = p.name;
        document.getElementById('pmCategory').value = p.category;
        document.getElementById('pmType').value = p.type;
        document.getElementById('pmOrigin').value = p.origin;
        document.getElementById('pmWeight').value = p.weight;
        document.getElementById('pmUnit').value = p.unit;
        document.getElementById('pmPrice').value = p.price;
        document.getElementById('pmStock').value = p.stock;
        document.getElementById('pmImage').value = p.image;
        document.getElementById('pmDesc').value = p.description;

        // Auction fields
        if (type === 'auction') {
          document.getElementById('pmStartPrice').value = p.startPrice || p.start_price || '';
          document.getElementById('pmMinBid').value = p.minBid || p.min_bid || '';
          document.getElementById('pmAuctionDuration').value = p.auctionDuration || p.auction_duration || '3';
          document.getElementById('pmBuyNow').value = p.buyNow || p.buy_now || '';
          selectAuctionType(p.auctionType || p.auction_type || 'timed');
        }
      }
    } else {
      // Clear form
      ['pmName','pmWeight','pmPrice','pmStock','pmImage','pmDesc','pmStartPrice','pmMinBid','pmBuyNow'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('pmCategory').value = 'بخور';
      document.getElementById('pmType').value = 'طبيعي';
      document.getElementById('pmOrigin').value = 'كمبودي';
      document.getElementById('pmUnit').value = 'جرام';
      document.getElementById('pmAuctionDuration').value = '3';
      selectAuctionType('timed');
    }

    document.getElementById('pmListingType').value = type;
    updateFormForListingType(type);
    SAIDAT.ui.openModal('productModal');
  }

  function closeProductModal() {
    SAIDAT.ui.closeModal('productModal');
  }

  async function saveProduct() {
    var name = document.getElementById('pmName').value.trim();
    var stock = parseInt(document.getElementById('pmStock').value);
    var weight = parseFloat(document.getElementById('pmWeight').value);
    var listingType = document.getElementById('pmListingType').value;

    if (!name) { SAIDAT.ui.showToast('الرجاء إدخال اسم المنتج', 'error'); return; }
    if (isNaN(stock) || stock < 0) { SAIDAT.ui.showToast('الرجاء إدخال كمية مخزون صحيحة', 'error'); return; }

    var editId = document.getElementById('editProductId').value;
    var product = {
      id: editId || 'p_' + Date.now(),
      name: name,
      listingType: listingType,
      category: document.getElementById('pmCategory').value,
      type: document.getElementById('pmType').value,
      origin: document.getElementById('pmOrigin').value,
      weight: weight || 0,
      unit: document.getElementById('pmUnit').value,
      price: 0,
      stock: stock,
      active: true,
      image: document.getElementById('pmImage').value.trim() || CFG.DEFAULT_IMAGE,
      description: document.getElementById('pmDesc').value.trim(),
      createdAt: new Date().toISOString().split('T')[0]
    };

    // فحص رابط الصورة بالذكاء الاصطناعي
    if (product.image && SAIDAT.imageGuard && !editId) {
      try {
        var imgCheck = await SAIDAT.imageGuard.checkImage(product.image);
        if (!imgCheck.ok) {
          SAIDAT.ui.showToast(imgCheck.issues[0] || 'صورة المنتج غير مقبولة', 'error');
          return;
        }
        if (imgCheck.warnings.length > 0) {
          SAIDAT.ui.showToast(imgCheck.warnings[0], 'warning');
        }
      } catch(err) {
        console.warn('Image check failed:', err);
      }
    }

    if (listingType === 'auction') {
      var startPrice = parseFloat(document.getElementById('pmStartPrice').value);
      var minBid = parseFloat(document.getElementById('pmMinBid').value);
      if (!startPrice || startPrice <= 0) { SAIDAT.ui.showToast('الرجاء إدخال السعر الافتتاحي', 'error'); return; }
      if (!minBid || minBid <= 0) { SAIDAT.ui.showToast('الرجاء إدخال الحد الأدنى للمزايدة', 'error'); return; }

      var selectedAuctionType = document.querySelector('.auction-type-btn.selected');
      var auctionType = selectedAuctionType ? selectedAuctionType.dataset.atype : 'timed';

      product.startPrice = startPrice;
      product.minBid = minBid;
      product.auctionType = auctionType;
      product.auctionDuration = parseInt(document.getElementById('pmAuctionDuration').value) || 3;
      product.buyNow = parseFloat(document.getElementById('pmBuyNow').value) || 0;
      product.price = startPrice;
      product.auctionStatus = 'live';
      product.auctionStartDate = new Date().toISOString().split('T')[0];

      // Calculate end date for timed auctions
      if (auctionType === 'timed') {
        var endDate = new Date();
        endDate.setDate(endDate.getDate() + product.auctionDuration);
        product.auctionEndDate = endDate.toISOString().split('T')[0];
      } else {
        product.auctionEndDate = null;
      }

      // Keep existing bids on edit, initialize empty on new
      if (editId) {
        var existing = currentUser.products.find(function(p) { return p.id === editId; });
        product.bids = (existing && existing.bids) ? existing.bids : [];
      } else {
        product.bids = [];
        // Add mock bids for demo
        product.bids.push(
          { bidder: 'عبدالرحمن السالم', amount: startPrice, date: new Date().toISOString() },
          { bidder: 'فيصل العمري', amount: startPrice + minBid, date: new Date().toISOString() },
          { bidder: 'سعود الدوسري', amount: startPrice + (minBid * 2), date: new Date().toISOString() }
        );
      }
    } else {
      var price = parseFloat(document.getElementById('pmPrice').value);
      if (!price || price <= 0) { SAIDAT.ui.showToast('الرجاء إدخال سعر صحيح', 'error'); return; }
      product.price = price;
      product.listingType = 'market';
    }

    // تحويل أسماء الحقول لصيغة Supabase (snake_case)
    var dbProduct = {
      name: product.name,
      listing_type: product.listingType,
      category: product.category,
      type: product.type,
      origin: product.origin,
      weight: product.weight,
      unit: product.unit,
      price: product.price,
      stock: product.stock,
      active: product.active,
      image: product.image,
      description: product.description,
      start_price: product.startPrice || null,
      min_bid: product.minBid || null,
      auction_type: product.auctionType || null,
      auction_duration: product.auctionDuration || null,
      buy_now: product.buyNow || null,
      auction_status: product.auctionStatus || null,
      auction_start_date: product.auctionStartDate || null,
      auction_end_date: product.auctionEndDate || null
    };

    // تحديد حالة الموافقة بناءً على توثيق البائع
    if (!editId) {
      var isVerified = currentUser.merchantVerified || currentUser.sellerVerified;
      dbProduct.approval_status = isVerified ? 'approved' : 'pending';
    }

    if (editId) {
      SAIDAT.products.update(editId, dbProduct).then(function() {
        SAIDAT.ui.showToast(listingType === 'auction' ? 'تم تحديث المزاد بنجاح' : 'تم تحديث المنتج بنجاح', 'success');
      });
      // تحديث محلياً
      var idx = currentUser.products.findIndex(function(p) { return p.id === editId; });
      if (idx !== -1) {
        currentUser.products[idx] = Object.assign(currentUser.products[idx], product);
      }
    } else {
      SAIDAT.products.add(dbProduct).then(function(saved) {
        if (saved) {
          product.id = saved.id;
          currentUser.products.push(product);
          renderProducts();
          renderOverview();
        }
      });
      // مؤقتاً أضف محلياً
      currentUser.products = currentUser.products || [];
      currentUser.products.push(product);
      var isVerifiedToast = currentUser.merchantVerified || currentUser.sellerVerified;
      SAIDAT.ui.showToast(
        isVerifiedToast ? 'تم نشر المنتج بنجاح' : 'تم إرسال المنتج للمراجعة — سيتم نشره بعد موافقة الإدارة',
        'success'
      );
    }

    renderProducts();
    renderOverview();
    closeProductModal();
  }

  function editProduct(id) {
    var p = currentUser.products.find(function(pr) { return pr.id === id; });
    openProductModal(id, p ? (p.listingType || p.listing_type) : 'market');
  }

  function toggleProduct(id) {
    var p = currentUser.products.find(function(pr) { return pr.id === id; });
    if (p) {
      p.active = !p.active;
      SAIDAT.products.update(id, { active: p.active });
      renderProducts();
      renderOverview();
      SAIDAT.ui.showToast(p.active ? 'تم تفعيل المنتج' : 'تم إيقاف المنتج', 'success');
    }
  }

  function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    currentUser.products = currentUser.products.filter(function(p) { return p.id !== id; });
    SAIDAT.products.remove(id);
    renderProducts();
    renderOverview();
    SAIDAT.ui.showToast('تم حذف المنتج', 'success');
  }

  // ===== ORDERS =====
  function renderOrders() {
    var user = currentUser;
    var orders = user.orders;

    // Counts
    var countNew = orders.filter(function(o) { return o.status === 'new'; }).length;
    var countProcessing = orders.filter(function(o) { return o.status === 'processing'; }).length;
    var countCompleted = orders.filter(function(o) { return o.status === 'completed'; }).length;
    var countCancelled = orders.filter(function(o) { return o.status === 'cancelled'; }).length;

    document.getElementById('countAll').textContent = orders.length;
    document.getElementById('countNew').textContent = countNew;
    document.getElementById('countProcessing').textContent = countProcessing;
    document.getElementById('countCompleted').textContent = countCompleted;
    document.getElementById('countCancelled').textContent = countCancelled;
    document.getElementById('newOrdersCount').textContent = countNew;

    // Filter
    var filtered = orders;
    if (currentOrderFilter !== 'all') {
      filtered = orders.filter(function(o) { return o.status === currentOrderFilter; });
    }

    if (filtered.length === 0) {
      document.getElementById('ordersBody').innerHTML = '<tr><td colspan="9"><div class="empty-state"><svg viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg><h3>لا توجد طلبات</h3></div></td></tr>';
      return;
    }

    var html = '';
    filtered.forEach(function(o) {
      var oId = U.escapeHtml(o.id);
      var oProductName = U.escapeHtml(o.productName || o.product_name);
      var oBuyer = U.escapeHtml(o.buyer || o.buyer_name);
      var oShippingMethod = U.escapeHtml(o.shippingMethod || o.shipping_method);
      var oDate = U.escapeHtml(o.date || o.created_at);

      var actions = '';
      if (o.status === 'new') {
        actions = '<button class="btn btn-sm btn-success" onclick="acceptOrder(\'' + oId + '\')">قبول</button>' +
                  '<button class="btn btn-sm btn-danger" onclick="openRejectModal(\'' + oId + '\')">رفض</button>';
      } else if (o.status === 'processing') {
        actions = '<button class="btn btn-sm btn-primary" onclick="openWaybillModal(\'' + oId + '\')">بوليصة</button>' +
                  '<button class="btn btn-sm btn-success" onclick="updateOrderStatus(\'' + oId + '\',\'completed\')">تم التسليم</button>';
      }
      actions += '<button class="btn btn-sm btn-outline" onclick="showOrderDetail(\'' + oId + '\')">تفاصيل</button>';

      // Waybill badge
      var waybillBadge = '';
      if (o.waybillGenerated || o.waybill_generated) {
        waybillBadge = ' <span class="shipping-badge">&#10003; بوليصة</span>';
      } else if (o.status === 'processing') {
        waybillBadge = ' <span class="shipping-badge pending">بدون بوليصة</span>';
      }

      html +=
        '<tr>' +
          '<td style="font-weight:600; font-size:0.82rem; direction:ltr; text-align:right;">' + oId + '</td>' +
          '<td>' + oProductName + '</td>' +
          '<td>' + oBuyer + '</td>' +
          '<td>' + o.qty + '</td>' +
          '<td style="font-weight:600;">' + U.formatCurrency(o.total) + '</td>' +
          '<td>' + oShippingMethod + waybillBadge + '</td>' +
          '<td>' + U.statusLabel(o.status) + '</td>' +
          '<td style="font-size:0.82rem; opacity:0.7;">' + oDate + '</td>' +
          '<td><div class="action-btns">' + actions + '</div></td>' +
        '</tr>';
    });

    document.getElementById('ordersBody').innerHTML = html;
  }

  function filterOrders(tab) {
    currentOrderFilter = tab;
    document.querySelectorAll('#orderTabs .tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderOrders();
  }

  function updateOrderStatus(orderId, newStatus) {
    var order = currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;

    order.status = newStatus;

    // Push to status history
    var statusNotes = { processing: 'تم قبول الطلب', completed: 'تم شحن الطلب وإتمامه', cancelled: 'تم رفض الطلب' };
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: newStatus,
      date: new Date().toISOString(),
      note: statusNotes[newStatus] || 'تم تحديث الحالة'
    });

    // Persist to Supabase
    SAIDAT.orders.update(orderId, { status: newStatus });
    SAIDAT.orders.addHistory(orderId, newStatus, statusNotes[newStatus] || 'تم تحديث الحالة');

    // If completed, add transaction
    if (newStatus === 'completed') {
      var commission = order.total * CFG.COMMISSION_RATE;

      var saleTx = {
        type: 'sale',
        amount: order.total,
        date: new Date().toISOString().split('T')[0],
        ref: order.id,
        status: 'completed',
        description: 'بيع: ' + (order.productName || order.product_name) + ' × ' + order.qty
      };
      var commTx = {
        type: 'commission',
        amount: -commission,
        date: new Date().toISOString().split('T')[0],
        ref: order.id,
        status: 'completed',
        description: 'عمولة المنصة ' + (CFG.COMMISSION_RATE * 100) + '%'
      };

      currentUser.transactions.unshift(
        Object.assign({ id: 't_' + Date.now() }, saleTx),
        Object.assign({ id: 't_' + (Date.now() + 1) }, commTx)
      );

      // Persist transactions to Supabase
      SAIDAT.transactions.add(U.camelToSnake(saleTx));
      SAIDAT.transactions.add(U.camelToSnake(commTx));

      currentUser.balance += (order.total - commission);
      currentUser.totalSales += order.qty;
      currentUser.totalRevenue += order.total;

      // Persist profile updates
      SAIDAT.profiles.update({
        balance: currentUser.balance,
        totalSales: currentUser.totalSales,
        totalRevenue: currentUser.totalRevenue
      });
    }

    renderOrders();
    renderOverview();
    renderFinance();

    var msgs = { processing: 'تم قبول الطلب', completed: 'تم شحن الطلب', cancelled: 'تم رفض الطلب' };
    SAIDAT.ui.showToast(msgs[newStatus] || 'تم التحديث', 'success');
  }

  // ===== ORDER DETAIL (Enhanced) =====
  function showOrderDetail(orderId) {
    var order = currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;

    var oId = U.escapeHtml(order.id);
    var oProductName = U.escapeHtml(order.productName || order.product_name);
    var oBuyer = U.escapeHtml(order.buyer || order.buyer_name);
    var oBuyerPhone = U.escapeHtml(order.buyerPhone || order.buyer_phone);
    var oBuyerCity = U.escapeHtml(order.buyerCity || order.buyer_city);
    var oBuyerDistrict = U.escapeHtml(order.buyerDistrict || order.buyer_district);
    var oBuyerStreet = U.escapeHtml(order.buyerStreet || order.buyer_street);
    var oShippingMethod = U.escapeHtml(order.shippingMethod || order.shipping_method);
    var oDate = U.escapeHtml(order.date || order.created_at);
    var oCarrierName = U.escapeHtml(order.carrierName || order.carrier_name);
    var oTrackingNumber = U.escapeHtml(order.trackingNumber || order.tracking_number);
    var oWaybillDate = U.escapeHtml(order.waybillDate || order.waybill_date);
    var oCancelReason = U.escapeHtml(order.cancelReason || order.cancel_reason || 'غير محدد');

    document.getElementById('orderDetailTitle').textContent = 'تفاصيل الطلب ' + order.id;

    // 1. Order Info Section
    var html = '<div class="order-detail-section">' +
      '<div class="order-detail-section-title">معلومات الطلب</div>' +
      '<div class="order-detail-row"><label>المنتج</label><span>' + oProductName + '</span></div>' +
      '<div class="order-detail-row"><label>الكمية</label><span>' + order.qty + '</span></div>' +
      '<div class="order-detail-row"><label>سعر الوحدة</label><span>' + U.formatCurrency(order.price) + '</span></div>' +
      '<div class="order-detail-row"><label>المجموع الفرعي</label><span>' + U.formatCurrency(order.total) + '</span></div>' +
      '<div class="order-detail-row"><label>الشحن (' + oShippingMethod + ')</label><span>' + U.formatCurrency(order.shipping) + '</span></div>' +
      '<div class="order-detail-row order-detail-total"><label>الإجمالي</label><span>' + U.formatCurrency(order.total + order.shipping) + '</span></div>' +
      '<div class="order-detail-row"><label>الحالة</label><span>' + U.statusLabel(order.status) + '</span></div>' +
      '<div class="order-detail-row"><label>التاريخ</label><span>' + oDate + '</span></div>' +
    '</div>';

    // 2. Buyer Address Section
    html += '<div class="order-detail-section">' +
      '<div class="order-detail-section-title">' +
        'عنوان المشتري' +
        (order.status !== 'completed' && order.status !== 'cancelled' ? '<button class="btn btn-sm btn-outline" onclick="toggleAddressEdit(\'' + oId + '\')">تعديل</button>' : '') +
      '</div>' +
      '<div class="order-detail-row"><label>الاسم</label><span>' + oBuyer + '</span></div>' +
      '<div class="order-detail-row"><label>الجوال</label><span style="direction:ltr;display:inline-block;">' + oBuyerPhone + '</span></div>' +
      '<div class="order-detail-row"><label>المدينة</label><span>' + oBuyerCity + '</span></div>' +
      '<div class="order-detail-row"><label>الحي</label><span>' + oBuyerDistrict + '</span></div>' +
      '<div class="order-detail-row"><label>العنوان</label><span>' + oBuyerStreet + '</span></div>' +
      '<div class="address-edit-form" id="addressEditForm">' +
        '<div class="form-group"><label class="form-label">المدينة</label><input type="text" class="form-input" id="editCity" value="' + oBuyerCity + '"></div>' +
        '<div class="form-group"><label class="form-label">الحي</label><input type="text" class="form-input" id="editDistrict" value="' + oBuyerDistrict + '"></div>' +
        '<div class="form-group"><label class="form-label">العنوان</label><input type="text" class="form-input" id="editStreet" value="' + oBuyerStreet + '"></div>' +
        '<div style="display:flex;gap:8px;margin-top:12px;"><button class="btn btn-sm btn-primary" onclick="saveOrderAddress(\'' + oId + '\')">حفظ العنوان</button><button class="btn btn-sm btn-outline" onclick="toggleAddressEdit(\'' + oId + '\')">إلغاء</button></div>' +
      '</div>' +
    '</div>';

    // 3. Shipping Info Section (only if not new)
    if (order.status !== 'new') {
      html += '<div class="order-detail-section">' +
        '<div class="order-detail-section-title">معلومات الشحن</div>';
      if (order.waybillGenerated || order.waybill_generated) {
        html += '<div class="order-detail-row"><label>شركة الشحن</label><span>' + oCarrierName + '</span></div>' +
          '<div class="order-detail-row"><label>رقم التتبع</label><span style="direction:ltr;display:inline-block;font-weight:700;">' + oTrackingNumber + '</span></div>' +
          '<div class="order-detail-row"><label>تاريخ البوليصة</label><span>' + oWaybillDate + '</span></div>' +
          '<div class="order-detail-row"><label>الحالة</label><span class="shipping-badge">&#10003; تم إصدار البوليصة</span></div>';
      } else if (order.status === 'processing') {
        html += '<div style="text-align:center;padding:16px;"><span class="shipping-badge pending">لم يتم إصدار بوليصة بعد</span>' +
          '<br><button class="btn btn-sm btn-primary" style="margin-top:12px;" onclick="closeOrderDetail();openWaybillModal(\'' + oId + '\')">إصدار بوليصة الآن</button></div>';
      } else if (order.status === 'cancelled') {
        html += '<div class="order-detail-row"><label>سبب الإلغاء</label><span style="color:var(--red);">' + oCancelReason + '</span></div>';
      }
      html += '</div>';
    }

    // 4. Timeline Section
    var history = order.statusHistory || [];
    if (history.length > 0) {
      html += '<div class="order-detail-section">' +
        '<div class="order-detail-section-title">الجدول الزمني</div>' +
        '<div class="order-timeline">';
      history.forEach(function(h, i) {
        var isLast = i === history.length - 1;
        var dateStr = h.date ? new Date(h.date).toLocaleString('ar-SA', {year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
        html += '<div class="timeline-item">' +
          '<div class="timeline-dot' + (isLast ? ' active' : '') + '"></div>' +
          '<div class="timeline-content">' +
            '<div class="timeline-date">' + U.escapeHtml(dateStr) + '</div>' +
            '<div class="timeline-note">' + U.escapeHtml(h.note || h.status) + '</div>' +
          '</div>' +
        '</div>';
      });
      html += '</div></div>';
    }

    document.getElementById('orderDetailBody').innerHTML = html;

    // Footer actions based on status
    var footerHTML = '';
    if (order.status === 'new') {
      footerHTML = '<button class="btn btn-success" onclick="acceptOrder(\'' + oId + '\')">قبول الطلب</button>' +
                   '<button class="btn btn-danger" onclick="openRejectModal(\'' + oId + '\')">رفض الطلب</button>';
    } else if (order.status === 'processing') {
      footerHTML = '<button class="btn btn-primary" onclick="closeOrderDetail();openWaybillModal(\'' + oId + '\')">إصدار بوليصة</button>' +
                   '<button class="btn btn-success" onclick="updateOrderStatus(\'' + oId + '\',\'completed\');closeOrderDetail();">تم التسليم</button>';
    }
    document.getElementById('orderDetailFooter').innerHTML = footerHTML;

    SAIDAT.ui.openModal('orderDetailModal');
  }

  function closeOrderDetail() {
    SAIDAT.ui.closeModal('orderDetailModal');
  }

  // ===== ORDER ACTIONS =====
  function acceptOrder(orderId) {
    updateOrderStatus(orderId, 'processing');
    closeOrderDetail();
  }

  function toggleAddressEdit() {
    var form = document.getElementById('addressEditForm');
    if (form) form.classList.toggle('visible');
  }

  function saveOrderAddress(orderId) {
    var order = currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;
    var city = document.getElementById('editCity').value.trim();
    var district = document.getElementById('editDistrict').value.trim();
    var street = document.getElementById('editStreet').value.trim();
    if (!city || !district || !street) { SAIDAT.ui.showToast('جميع حقول العنوان مطلوبة', 'error'); return; }
    order.buyerCity = city;
    order.buyer_city = city;
    order.buyerDistrict = district;
    order.buyer_district = district;
    order.buyerStreet = street;
    order.buyer_street = street;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: order.status, date: new Date().toISOString(), note: 'تم تعديل عنوان التوصيل' });

    SAIDAT.orders.update(orderId, {
      buyer_city: city,
      buyer_district: district,
      buyer_street: street
    });
    SAIDAT.orders.addHistory(orderId, order.status, 'تم تعديل عنوان التوصيل');

    showOrderDetail(orderId);
    SAIDAT.ui.showToast('تم تحديث العنوان بنجاح', 'success');
  }

  // ===== REJECT ORDER =====
  function openRejectModal(orderId) {
    document.getElementById('rejectOrderId').value = orderId;
    document.getElementById('rejectReason').value = 'المنتج غير متوفر';
    document.getElementById('customRejectGroup').style.display = 'none';
    SAIDAT.ui.openModal('rejectModal');
  }

  function closeRejectModal() {
    SAIDAT.ui.closeModal('rejectModal');
  }

  function onRejectReasonChange() {
    document.getElementById('customRejectGroup').style.display =
      document.getElementById('rejectReason').value === 'other' ? 'block' : 'none';
  }

  function confirmRejectOrder() {
    var orderId = document.getElementById('rejectOrderId').value;
    var reason = document.getElementById('rejectReason').value;
    if (reason === 'other') {
      reason = document.getElementById('rejectCustomReason').value.trim();
      if (!reason) { SAIDAT.ui.showToast('الرجاء كتابة سبب الرفض', 'error'); return; }
    }
    var order = currentUser.orders.find(function(o) { return o.id === orderId; });
    if (order) {
      order.cancelReason = reason;
      order.cancel_reason = reason;
      SAIDAT.orders.update(orderId, { cancel_reason: reason });
    }
    updateOrderStatus(orderId, 'cancelled');
    closeRejectModal();
    closeOrderDetail();
  }

  // ===== WAYBILL =====
  function openWaybillModal(orderId) {
    document.getElementById('waybillOrderId').value = orderId;
    var order = currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;
    document.getElementById('waybillCarrier').value = order.carrier || '';
    document.getElementById('waybillTracking').value = order.trackingNumber || order.tracking_number || '';
    var carrierVal = order.carrier;
    document.getElementById('customCarrierGroup').style.display = carrierVal === 'other' ? 'block' : 'none';
    if (carrierVal === 'other' && (order.carrierName || order.carrier_name)) {
      document.getElementById('waybillCustomCarrier').value = order.carrierName || order.carrier_name;
    }
    updateWaybillPreview();
    SAIDAT.ui.openModal('waybillModal');
  }

  function closeWaybillModal() {
    SAIDAT.ui.closeModal('waybillModal');
  }

  function onWaybillCarrierChange() {
    document.getElementById('customCarrierGroup').style.display =
      document.getElementById('waybillCarrier').value === 'other' ? 'block' : 'none';
    updateWaybillPreview();
  }

  function updateWaybillPreview() {
    var orderId = document.getElementById('waybillOrderId').value;
    var order = currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) { document.getElementById('waybillPreview').innerHTML = ''; return; }
    var carrier = document.getElementById('waybillCarrier').value;
    var tracking = document.getElementById('waybillTracking').value;
    var carrierLogos = {
      aramex: { name: 'Aramex - أرامكس', color: '#E74C3C' },
      smsa: { name: 'SMSA Express', color: '#1A73E8' },
      spl: { name: 'البريد السعودي - SPL', color: '#4A7C59' },
      other: { name: document.getElementById('waybillCustomCarrier').value || 'شركة شحن', color: '#666' }
    };
    var ci = carrierLogos[carrier] || { name: 'اختر شركة الشحن', color: '#999' };

    var senderName = U.escapeHtml(currentUser.firstName + ' ' + currentUser.lastName);
    var storeName = U.escapeHtml(currentUser.storeName || 'صيدات العود');
    var senderPhone = U.escapeHtml(currentUser.phone || '');
    var oBuyer = U.escapeHtml(order.buyer || order.buyer_name);
    var oBuyerPhone = U.escapeHtml(order.buyerPhone || order.buyer_phone);
    var oBuyerCity = U.escapeHtml(order.buyerCity || order.buyer_city);
    var oBuyerDistrict = U.escapeHtml(order.buyerDistrict || order.buyer_district);
    var oBuyerStreet = U.escapeHtml(order.buyerStreet || order.buyer_street);
    var oProductName = U.escapeHtml(order.productName || order.product_name);
    var oShippingMethod = U.escapeHtml(order.shippingMethod || order.shipping_method);
    var oId = U.escapeHtml(order.id);
    var trackingEsc = U.escapeHtml(tracking);

    var h = '<div class="waybill-page">' +
      '<div class="waybill-header">' +
        '<div class="waybill-carrier-logo" style="border-color:' + ci.color + ';color:' + ci.color + ';">' + U.escapeHtml(ci.name) + '</div>' +
        '<div class="waybill-barcode-area">' +
          '<div class="waybill-order-id">' + oId + '</div>' +
          '<div class="waybill-barcode-placeholder">||||| |||| ||||| ||||</div>' +
          (tracking ? '<div class="waybill-tracking-num">' + trackingEsc + '</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="waybill-section"><div class="waybill-section-title">المرسل</div>' +
        '<div class="waybill-row"><span>الاسم:</span> ' + senderName + '</div>' +
        '<div class="waybill-row"><span>المتجر:</span> ' + storeName + '</div>' +
        '<div class="waybill-row"><span>الجوال:</span> <span style="direction:ltr;display:inline-block;">' + senderPhone + '</span></div>' +
      '</div>' +
      '<div class="waybill-section"><div class="waybill-section-title">المستلم</div>' +
        '<div class="waybill-row"><span>الاسم:</span> ' + oBuyer + '</div>' +
        '<div class="waybill-row"><span>الجوال:</span> <span style="direction:ltr;display:inline-block;">' + oBuyerPhone + '</span></div>' +
        '<div class="waybill-row"><span>المدينة:</span> ' + oBuyerCity + '</div>' +
        '<div class="waybill-row"><span>الحي:</span> ' + oBuyerDistrict + '</div>' +
        '<div class="waybill-row"><span>العنوان:</span> ' + oBuyerStreet + '</div>' +
      '</div>' +
      '<div class="waybill-section"><div class="waybill-section-title">تفاصيل الشحنة</div>' +
        '<div class="waybill-row"><span>المنتج:</span> ' + oProductName + '</div>' +
        '<div class="waybill-row"><span>الكمية:</span> ' + order.qty + '</div>' +
        '<div class="waybill-row"><span>القيمة:</span> ' + U.formatCurrency(order.total) + '</div>' +
        '<div class="waybill-row"><span>طريقة الشحن:</span> ' + oShippingMethod + '</div>' +
        '<div class="waybill-row"><span>الدفع:</span> الدفع عند الاستلام</div>' +
      '</div>' +
      '<div class="waybill-footer"><span>صيدات العود</span><span>' + new Date().toISOString().split('T')[0] + '</span></div>' +
    '</div>';

    document.getElementById('waybillPreview').innerHTML = h;
  }

  function saveAndPrintWaybill() {
    var orderId = document.getElementById('waybillOrderId').value;
    var carrier = document.getElementById('waybillCarrier').value;
    var tracking = document.getElementById('waybillTracking').value.trim();
    if (!carrier) { SAIDAT.ui.showToast('اختر شركة الشحن', 'error'); return; }
    if (!tracking) { SAIDAT.ui.showToast('أدخل رقم التتبع', 'error'); return; }
    var carrierName = '';
    var opt = document.querySelector('#waybillCarrier option:checked');
    if (opt) carrierName = opt.textContent;
    if (carrier === 'other') {
      carrierName = document.getElementById('waybillCustomCarrier').value.trim();
      if (!carrierName) { SAIDAT.ui.showToast('أدخل اسم شركة الشحن', 'error'); return; }
    }
    var order = currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;
    order.carrier = carrier;
    order.carrierName = carrierName;
    order.carrier_name = carrierName;
    order.trackingNumber = tracking;
    order.tracking_number = tracking;
    order.waybillGenerated = true;
    order.waybill_generated = true;
    order.waybillDate = new Date().toISOString().split('T')[0];
    order.waybill_date = order.waybillDate;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({ status: order.status, date: new Date().toISOString(), note: 'تم إصدار بوليصة الشحن - ' + carrierName + ' - ' + tracking });

    SAIDAT.orders.update(orderId, {
      carrier: carrier,
      carrier_name: carrierName,
      tracking_number: tracking,
      waybill_generated: true,
      waybill_date: order.waybillDate
    });
    SAIDAT.orders.addHistory(orderId, order.status, 'تم إصدار بوليصة الشحن - ' + carrierName + ' - ' + tracking);

    renderOrders();
    SAIDAT.ui.showToast('تم حفظ بيانات الشحن', 'success');
    // Update preview then print
    updateWaybillPreview();
    setTimeout(function() { window.print(); }, 300);
  }

  // ===== FINANCE =====
  function renderFinance() {
    var user = currentUser;

    document.getElementById('balanceAmount').innerHTML = U.formatNumber(user.balance) + ' <span>ر.س</span>';

    // Calculate stats
    var thisMonthSales = user.transactions.filter(function(t) {
      var d = t.date || t.created_at || '';
      return t.type === 'sale' && d.startsWith('2026-02');
    }).reduce(function(sum, t) { return sum + t.amount; }, 0);

    var totalCommission = user.transactions.filter(function(t) {
      return t.type === 'commission';
    }).reduce(function(sum, t) { return sum + Math.abs(t.amount); }, 0);

    var netProfit = user.totalRevenue - totalCommission;

    document.getElementById('financeStats').innerHTML =
      '<div class="finance-stat"><div class="finance-stat-value">' + U.formatCurrency(thisMonthSales) + '</div><div class="finance-stat-label">مبيعات هذا الشهر</div></div>' +
      '<div class="finance-stat"><div class="finance-stat-value" style="color:#F39C12;">' + U.formatCurrency(totalCommission) + '</div><div class="finance-stat-label">العمولة المستقطعة (' + (CFG.COMMISSION_RATE * 100) + '%)</div></div>' +
      '<div class="finance-stat"><div class="finance-stat-value" style="color:#27AE60;">' + U.formatCurrency(netProfit) + '</div><div class="finance-stat-label">صافي الأرباح</div></div>';

    // Transactions table
    var html = '';
    user.transactions.forEach(function(t) {
      var amountClass = t.amount >= 0 ? 'color:#27AE60;' : 'color:#E74C3C;';
      var amountPrefix = t.amount >= 0 ? '+' : '';
      html +=
        '<tr>' +
          '<td style="font-size:0.82rem; opacity:0.7;">' + U.escapeHtml(t.date || t.created_at) + '</td>' +
          '<td>' + U.typeLabel(t.type) + '</td>' +
          '<td>' + U.escapeHtml(t.description) + '</td>' +
          '<td style="font-weight:700;' + amountClass + '">' + amountPrefix + U.formatCurrency(t.amount) + '</td>' +
          '<td style="font-size:0.82rem; direction:ltr; text-align:right;">' + U.escapeHtml(t.ref) + '</td>' +
          '<td>' + U.statusLabel(t.status) + '</td>' +
        '</tr>';
    });
    document.getElementById('transactionsBody').innerHTML = html;
  }

  function openWithdrawModal() {
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawBank').value = currentUser.bankName || 'لم يتم تحديد البنك';
    document.getElementById('withdrawIban').value = currentUser.iban || 'لم يتم تحديد الآيبان';
    SAIDAT.ui.openModal('withdrawModal');
  }

  function closeWithdrawModal() {
    SAIDAT.ui.closeModal('withdrawModal');
  }

  function submitWithdraw() {
    var amount = parseFloat(document.getElementById('withdrawAmount').value);
    if (!amount || amount < CFG.MIN_WITHDRAWAL) {
      SAIDAT.ui.showToast('الحد الأدنى للسحب ' + CFG.MIN_WITHDRAWAL + ' ر.س', 'error');
      return;
    }
    if (amount > currentUser.balance) {
      SAIDAT.ui.showToast('المبلغ أكبر من الرصيد المتاح', 'error');
      return;
    }
    if (!currentUser.iban) {
      SAIDAT.ui.showToast('الرجاء إضافة معلوماتك البنكية أولاً', 'error');
      return;
    }

    currentUser.balance -= amount;

    var withdrawTx = {
      id: 't_' + Date.now(),
      type: 'withdrawal',
      amount: -amount,
      date: new Date().toISOString().split('T')[0],
      ref: 'W-' + Math.floor(Math.random() * 999 + 1).toString().padStart(3, '0'),
      status: 'completed',
      description: 'سحب إلى ' + currentUser.bankName
    };

    currentUser.transactions.unshift(withdrawTx);

    // Persist
    SAIDAT.transactions.add(U.camelToSnake(withdrawTx));
    SAIDAT.profiles.update({ balance: currentUser.balance });

    renderFinance();
    renderOverview();
    closeWithdrawModal();
    SAIDAT.ui.showToast('تم طلب السحب بنجاح - سيتم التحويل خلال 1-3 أيام عمل', 'success');
  }

  // ===== PROFILE =====
  function loadProfile() {
    var user = currentUser;
    document.getElementById('profileAvatar').textContent = user.firstName.charAt(0);
    document.getElementById('profileFullName').textContent = user.firstName + ' ' + user.lastName;
    document.getElementById('profFirstName').value = user.firstName;
    document.getElementById('profLastName').value = user.lastName;
    document.getElementById('profEmail').value = user.email;
    document.getElementById('profPhone').value = user.phone;
    document.getElementById('profStoreName').value = user.storeName || '';
    document.getElementById('profStoreDesc').value = user.storeDesc || '';
    document.getElementById('profBankName').value = user.bankName || '';
    document.getElementById('profBankHolder').value = user.bankHolder || '';
    document.getElementById('profIban').value = user.iban || '';
    document.getElementById('profCurrentPass').value = '';
    document.getElementById('profNewPass').value = '';
    document.getElementById('profConfirmPass').value = '';

    // تحديث قسم التوثيق
    document.getElementById('profCommercialRegister').value = user.commercialRegister || '';

    // شارة التاجر الموثق
    var merchantBadge = document.getElementById('merchantBadge');
    var merchantForm = document.getElementById('merchantVerifyForm');
    if (user.merchantVerified) {
      merchantBadge.textContent = 'موثق ✓';
      merchantBadge.className = 'verify-badge verified';
      merchantForm.style.display = 'none';
    } else if (user.commercialRegister) {
      merchantBadge.textContent = 'قيد المراجعة';
      merchantBadge.className = 'verify-badge pending';
      merchantForm.style.display = 'none';
    } else {
      merchantBadge.textContent = 'غير موثق';
      merchantBadge.className = 'verify-badge';
      merchantForm.style.display = 'block';
    }

    // شارة البائع الموثق
    var sellerBadge = document.getElementById('sellerBadge');
    var completed = user.completedAuctions || 0;
    var progress = Math.min(completed / 2 * 100, 100);
    document.getElementById('auctionProgressFill').style.width = progress + '%';
    document.getElementById('auctionProgressText').textContent = completed + ' / 2 مزاد مكتمل';
    if (user.sellerVerified) {
      sellerBadge.textContent = 'موثق ✓';
      sellerBadge.className = 'verify-badge verified';
    } else {
      sellerBadge.textContent = 'غير موثق';
      sellerBadge.className = 'verify-badge';
    }
  }

  // إرسال طلب توثيق تاجر
  function submitMerchantVerification() {
    var register = document.getElementById('profCommercialRegister').value.trim();
    if (!register) { SAIDAT.ui.showToast('الرجاء إدخال رقم السجل التجاري', 'error'); return; }
    currentUser.commercialRegister = register;
    SAIDAT.profiles.update({ commercialRegister: register });
    loadProfile();
    SAIDAT.ui.showToast('تم إرسال طلب التوثيق - سيتم مراجعته من الإدارة', 'success');
  }

  function saveProfile() {
    var firstName = document.getElementById('profFirstName').value.trim();
    var lastName = document.getElementById('profLastName').value.trim();
    if (!firstName || !lastName) { SAIDAT.ui.showToast('الاسم مطلوب', 'error'); return; }

    currentUser.firstName = firstName;
    currentUser.lastName = lastName;
    currentUser.email = document.getElementById('profEmail').value.trim();
    currentUser.phone = document.getElementById('profPhone').value.trim();
    currentUser.storeName = document.getElementById('profStoreName').value.trim();
    currentUser.storeDesc = document.getElementById('profStoreDesc').value.trim();
    currentUser.bankName = document.getElementById('profBankName').value;
    currentUser.bankHolder = document.getElementById('profBankHolder').value.trim();
    currentUser.iban = document.getElementById('profIban').value.trim();

    // Password change
    var currentPass = document.getElementById('profCurrentPass').value;
    var newPass = document.getElementById('profNewPass').value;
    var confirmPass = document.getElementById('profConfirmPass').value;

    if (currentPass || newPass || confirmPass) {
      if (btoa(currentPass) !== currentUser.password) {
        SAIDAT.ui.showToast('كلمة المرور الحالية غير صحيحة', 'error');
        return;
      }
      if (newPass.length < 6) {
        SAIDAT.ui.showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
      }
      if (newPass !== confirmPass) {
        SAIDAT.ui.showToast('كلمات المرور غير متطابقة', 'error');
        return;
      }
      currentUser.password = btoa(newPass);
    }

    SAIDAT.profiles.update({
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      phone: currentUser.phone,
      storeName: currentUser.storeName,
      storeDesc: currentUser.storeDesc,
      bankName: currentUser.bankName,
      bankHolder: currentUser.bankHolder,
      iban: currentUser.iban
    });

    updateSidebar();
    loadProfile();
    SAIDAT.ui.showToast('تم حفظ التغييرات بنجاح', 'success');
  }

  // ===== كشف الدوال للـ HTML onclick handlers =====
  window.switchSection = function(s) { SAIDAT.ui.switchSection(s, SECTION_TITLES); };
  window.toggleSidebar = SAIDAT.ui.toggleSidebar;
  window.saveProduct = saveProduct;
  window.deleteProduct = deleteProduct;
  window.toggleProduct = toggleProduct;
  window.openProductModal = openProductModal;
  window.editProduct = editProduct;
  window.showOrderDetail = showOrderDetail;
  window.updateOrderStatus = updateOrderStatus;
  window.filterOrders = filterOrders;
  window.openAddChooser = openAddChooser;
  window.closeAddChooser = closeAddChooser;
  window.chooseListingType = chooseListingType;
  window.closeProductModal = closeProductModal;
  window.selectAuctionType = selectAuctionType;
  window.acceptOrder = acceptOrder;
  window.toggleAddressEdit = toggleAddressEdit;
  window.saveOrderAddress = saveOrderAddress;
  window.openRejectModal = openRejectModal;
  window.closeRejectModal = closeRejectModal;
  window.onRejectReasonChange = onRejectReasonChange;
  window.confirmRejectOrder = confirmRejectOrder;
  window.openWaybillModal = openWaybillModal;
  window.closeWaybillModal = closeWaybillModal;
  window.onWaybillCarrierChange = onWaybillCarrierChange;
  window.saveAndPrintWaybill = saveAndPrintWaybill;
  window.openWithdrawModal = openWithdrawModal;
  window.closeWithdrawModal = closeWithdrawModal;
  window.submitWithdraw = submitWithdraw;
  window.closeOrderDetail = closeOrderDetail;
  window.loadProfile = loadProfile;
  window.saveProfile = saveProfile;
  window.submitMerchantVerification = submitMerchantVerification;
  window.renderOverview = renderOverview;
  window.renderProducts = renderProducts;
  window.renderOrders = renderOrders;
  window.renderFinance = renderFinance;

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
