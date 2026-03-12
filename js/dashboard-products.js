// ===== dashboard-products.js — إدارة المنتجات والمزادات — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, products.js, bids.js, ui.js
// يصدّر: SAIDAT.dashboard.products

(function() {
  'use strict';

  SAIDAT.dashboard = SAIDAT.dashboard || {};
  SAIDAT.dashboard.state = SAIDAT.dashboard.state || {};

  var U = SAIDAT.utils;
  var CFG = SAIDAT.config;

  // ===== عرض المنتجات =====
  function renderProducts() {
    var state = SAIDAT.dashboard.state;
    var user = state.currentUser;
    var html = '';

    if (user.products.length === 0) {
      document.getElementById('productsBody').innerHTML = '<tr><td colspan="8"><div class="empty-state"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-5 14H9v-2h6v2zm3-4H7v-2h10v2zm0-4H7V6h10v2z"/></svg><h3>لا توجد منتجات</h3><p>أضف منتجك الأول الآن</p></div></td></tr>';
      return;
    }

    user.products.forEach(function(p) {
      var pName = U.escapeHtml(p.name);
      var pImage = U.safeImageUrl(p.image_url || p.image);
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

      var approvalStatus = p.approval_status || p.approvalStatus || 'pending';
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
            (listingType === 'auction' && auctionStatus === 'live' && auctionType === 'until_sold' ? '<button class="btn btn-sm btn-success" onclick="showOffers(\'' + U.escapeHtml(p.id) + '\')">اختيار فائز</button>' : '') +
            (listingType === 'auction' && auctionStatus === 'live' ? '<button class="btn btn-sm btn-danger" onclick="cancelAuction(\'' + U.escapeHtml(p.id) + '\')">إلغاء المزاد</button>' : '') +
            '<button class="btn btn-sm btn-danger" onclick="deleteProduct(\'' + U.escapeHtml(p.id) + '\')">حذف</button>' +
          '</div></td>' +
        '</tr>';
    });

    document.getElementById('productsBody').innerHTML = html;
  }

  // ===== اختيار نوع الإعلان =====
  function openAddChooser() {
    SAIDAT.ui.openModal('addChooserModal');
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

  // ===== فتح/إغلاق نموذج المنتج =====
  function openProductModal(editId, listingType) {
    var state = SAIDAT.dashboard.state;
    document.getElementById('editProductId').value = editId || '';
    var type = listingType || 'market';

    if (editId) {
      var p = state.currentUser.products.find(function(pr) { return pr.id === editId; });
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
        document.getElementById('pmImage').value = p.image_url || p.image || '';
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

  // ===== حفظ المنتج =====
  async function saveProduct() {
    var state = SAIDAT.dashboard.state;
    var saveBtn = document.getElementById('saveProductBtn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'جاري الحفظ...'; }

    try {
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

    // فحص رابط الصورة
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
        U.log('warn', 'Image check failed:', err);
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
      product.auctionStartDate = new Date().toISOString();

      if (auctionType === 'timed') {
        var endDate = new Date();
        endDate.setDate(endDate.getDate() + product.auctionDuration);
        product.auctionEndDate = endDate.toISOString();
      } else {
        product.auctionEndDate = null;
      }

      if (editId) {
        var existing = state.currentUser.products.find(function(p) { return p.id === editId; });
        product.bids = (existing && existing.bids) ? existing.bids : [];
      } else {
        product.bids = [];
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
      image_url: product.image,
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
      var isVerified = state.currentUser.merchantVerified || state.currentUser.sellerVerified;
      dbProduct.approval_status = isVerified ? 'approved' : 'pending';
    }

    if (editId) {
      var updated = await SAIDAT.products.update(editId, dbProduct);
      if (!updated) {
        SAIDAT.ui.showToast('حدث خطأ أثناء تحديث المنتج — حاول مرة أخرى', 'error');
        return;
      }
      var idx = state.currentUser.products.findIndex(function(p) { return p.id === editId; });
      if (idx !== -1) {
        state.currentUser.products[idx] = Object.assign(state.currentUser.products[idx], product);
      }
      SAIDAT.ui.showToast(listingType === 'auction' ? 'تم تحديث المزاد بنجاح' : 'تم تحديث المنتج بنجاح', 'success');
    } else {
      var saved = await SAIDAT.products.add(dbProduct);
      if (!saved) {
        SAIDAT.ui.showToast('حدث خطأ أثناء حفظ المنتج — حاول مرة أخرى', 'error');
        return;
      }
      product.id = saved.id;
      state.currentUser.products = state.currentUser.products || [];
      state.currentUser.products.push(product);
      var isVerifiedToast = state.currentUser.merchantVerified || state.currentUser.sellerVerified;
      SAIDAT.ui.showToast(
        isVerifiedToast ? 'تم نشر المنتج بنجاح' : 'تم إرسال المنتج للمراجعة — سيتم نشره بعد موافقة الإدارة',
        'success'
      );
    }

    renderProducts();
    renderOverview();
    closeProductModal();

    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'حفظ المنتج'; }
    }
  }

  function editProduct(id) {
    var state = SAIDAT.dashboard.state;
    var p = state.currentUser.products.find(function(pr) { return pr.id === id; });
    openProductModal(id, p ? (p.listingType || p.listing_type) : 'market');
  }

  function toggleProduct(id) {
    var state = SAIDAT.dashboard.state;
    var p = state.currentUser.products.find(function(pr) { return pr.id === id; });
    if (p) {
      p.active = !p.active;
      SAIDAT.products.update(id, { active: p.active });
      renderProducts();
      renderOverview();
      SAIDAT.ui.showToast(p.active ? 'تم تفعيل المنتج' : 'تم إيقاف المنتج', 'success');
    }
  }

  function deleteProduct(id) {
    var state = SAIDAT.dashboard.state;
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
    state.currentUser.products = state.currentUser.products.filter(function(p) { return p.id !== id; });
    SAIDAT.products.remove(id);
    renderProducts();
    renderOverview();
    SAIDAT.ui.showToast('تم حذف المنتج', 'success');
  }

  // ===== إلغاء المزاد =====
  async function cancelAuction(productId) {
    var state = SAIDAT.dashboard.state;
    var reason = prompt('سبب إلغاء المزاد (اختياري):') || '';

    if (!confirm('هل أنت متأكد من إلغاء هذا المزاد؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    try {
      var ok = await SAIDAT.products.update(productId, {
        auction_status: 'cancelled',
        cancel_reason: reason,
        cancelled_by: 'seller',
        active: false
      });

      if (!ok) {
        SAIDAT.ui.showToast('حدث خطأ أثناء إلغاء المزاد', 'error');
        return;
      }

      try {
        var products = await SAIDAT.products.getForSeller();
        state.currentUser.products = products || [];
      } catch(e) {
        U.log('warn', 'Could not refresh products:', e);
      }

      renderProducts();
      renderOverview();
      SAIDAT.ui.showToast('تم إلغاء المزاد بنجاح', 'success');
    } catch(e) {
      U.log('error', 'cancelAuction error:', e);
      SAIDAT.ui.showToast('حدث خطأ غير متوقع', 'error');
    }
  }

  // ===== عروض مفتوحة: اختيار فائز =====
  async function showOffers(productId) {
    var sb = U.getSupabase();
    if (!sb) return;

    try {
      var res = await sb.from('bids')
        .select('*, profiles(first_name, last_name, store_name)')
        .eq('product_id', productId)
        .eq('status', 'active')
        .order('amount', { ascending: false });

      if (res.error || !res.data || res.data.length === 0) {
        SAIDAT.ui.showToast('لا توجد عروض على هذا المزاد بعد', 'info');
        return;
      }

      var bids = res.data;
      var html = '<div style="max-height:400px;overflow-y:auto;">';
      html += '<table style="width:100%;border-collapse:collapse;">';
      html += '<tr style="background:#F5F0EB;"><th style="padding:8px;text-align:right;">المزايد</th><th style="padding:8px;text-align:right;">المبلغ</th><th style="padding:8px;text-align:center;">إجراء</th></tr>';

      bids.forEach(function(bid) {
        var bidderName = bid.profiles ? U.escapeHtml((bid.profiles.store_name || bid.profiles.first_name || '') + ' ' + (bid.profiles.last_name || '')) : 'مزايد';
        html += '<tr style="border-bottom:1px solid #E8DDD0;">' +
          '<td style="padding:8px;">' + bidderName + '</td>' +
          '<td style="padding:8px;font-weight:600;">' + U.formatCurrency(bid.amount) + '</td>' +
          '<td style="padding:8px;text-align:center;"><button class="btn btn-sm btn-success" onclick="acceptOfferFromList(\'' + U.escapeHtml(productId) + '\',\'' + U.escapeHtml(bid.bidder_id) + '\')">قبول</button></td>' +
          '</tr>';
      });

      html += '</table></div>';

      var modal = document.createElement('div');
      modal.id = 'offersModal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
      modal.innerHTML = '<div style="background:white;border-radius:16px;padding:24px;max-width:500px;width:90%;max-height:80vh;overflow:auto;">' +
        '<h3 style="margin:0 0 16px;text-align:right;">العروض المقدمة</h3>' +
        html +
        '<button class="btn btn-outline" onclick="document.getElementById(\'offersModal\').remove()" style="margin-top:16px;width:100%;">إغلاق</button>' +
        '</div>';
      document.body.appendChild(modal);
    } catch(e) {
      U.log('error', 'showOffers error:', e);
      SAIDAT.ui.showToast('حدث خطأ في تحميل العروض', 'error');
    }
  }

  async function acceptOfferFromList(productId, bidderId) {
    var state = SAIDAT.dashboard.state;
    if (!confirm('هل أنت متأكد من قبول هذا العرض؟ سيتم إنهاء المزاد وتعيين هذا المزايد كفائز.')) return;

    try {
      var result = await SAIDAT.products.acceptOffer(productId, bidderId);
      if (result && result.success) {
        SAIDAT.ui.showToast('تم قبول العرض وإنهاء المزاد', 'success');
        var modal = document.getElementById('offersModal');
        if (modal) modal.remove();

        try {
          var products = await SAIDAT.products.getForSeller();
          state.currentUser.products = products || [];
        } catch(e) { /* silent */ }
        renderProducts();
        renderOverview();
      } else {
        SAIDAT.ui.showToast('فشل قبول العرض: ' + (result.error || 'خطأ غير معروف'), 'error');
      }
    } catch(e) {
      U.log('error', 'acceptOffer error:', e);
      SAIDAT.ui.showToast('حدث خطأ غير متوقع', 'error');
    }
  }

  // ===== تصدير عبر namespace =====
  SAIDAT.dashboard.products = {
    render: renderProducts,
    openAddChooser: openAddChooser,
    openProductModal: openProductModal,
    saveProduct: saveProduct,
    editProduct: editProduct,
    toggleProduct: toggleProduct,
    deleteProduct: deleteProduct,
    cancelAuction: cancelAuction,
    showOffers: showOffers,
    acceptOfferFromList: acceptOfferFromList
  };

  // ===== Compatibility layer — window wrappers لـ inline onclick =====
  window.renderProducts = renderProducts;
  window.saveProduct = saveProduct;
  window.deleteProduct = deleteProduct;
  window.toggleProduct = toggleProduct;
  window.cancelAuction = cancelAuction;
  window.showOffers = showOffers;
  window.acceptOfferFromList = acceptOfferFromList;
  window.openProductModal = openProductModal;
  window.editProduct = editProduct;
  window.openAddChooser = openAddChooser;
  window.closeAddChooser = closeAddChooser;
  window.chooseListingType = chooseListingType;
  window.closeProductModal = closeProductModal;
  window.selectAuctionType = selectAuctionType;

})();
