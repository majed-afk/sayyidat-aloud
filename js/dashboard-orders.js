// ===== dashboard-orders.js — إدارة الطلبات — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, orders.js, disputes.js, ui.js
// يصدّر: SAIDAT.dashboard.orders

(function() {
  'use strict';

  SAIDAT.dashboard = SAIDAT.dashboard || {};
  SAIDAT.dashboard.state = SAIDAT.dashboard.state || {};

  var U = SAIDAT.utils;
  var CFG = SAIDAT.config;

  // حالة محلية
  var currentOrderFilter = 'all';

  // ===== النزاعات =====
  async function openDispute(orderId, sellerId) {
    var reason = prompt('سبب النزاع:');
    if (!reason || !reason.trim()) return;

    var dispute = {
      order_id: orderId,
      seller_id: sellerId,
      reason: reason.trim()
    };

    var result = await SAIDAT.disputes.create(dispute);
    if (result) {
      SAIDAT.ui.showToast('تم فتح النزاع بنجاح', 'success');
      renderOrders();
    } else {
      SAIDAT.ui.showToast('حدث خطأ أثناء فتح النزاع', 'error');
    }
  }

  function getDisputeStatusBadge(dispute) {
    if (!dispute) return '';
    var statusLabels = {
      'open': 'نزاع مفتوح',
      'resolved': 'تم الحل',
      'rejected': 'مرفوض'
    };
    var statusClasses = {
      'open': 'status-processing',
      'resolved': 'status-completed',
      'rejected': 'status-cancelled'
    };
    var label = statusLabels[dispute.status] || U.escapeHtml(dispute.status);
    var cls = statusClasses[dispute.status] || 'status-new';
    return '<span class="status ' + cls + '"><span class="status-dot"></span>' + U.escapeHtml(label) + '</span>';
  }

  function isWithin7Days(dateStr) {
    if (!dateStr) return false;
    var completed = new Date(dateStr);
    var now = new Date();
    var diff = now.getTime() - completed.getTime();
    return diff <= 7 * 24 * 60 * 60 * 1000;
  }

  // ===== عرض الطلبات =====
  async function renderOrders() {
    var state = SAIDAT.dashboard.state;
    var user = state.currentUser;
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

    // Load disputes for completed orders
    if (SAIDAT.disputes) {
      var completedOrders = orders.filter(function(o) { return o.status === 'completed'; });
      for (var i = 0; i < completedOrders.length; i++) {
        try {
          completedOrders[i]._dispute = await SAIDAT.disputes.getForOrder(completedOrders[i].id);
        } catch(e) {
          completedOrders[i]._dispute = null;
        }
      }
    }

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

      // Dispute button for completed orders within 7 days
      var disputeBadge = '';
      var completedDate = o.completed_at || o.completedAt || (o.status === 'completed' ? (o.updated_at || o.date || o.created_at) : null);
      if (o.status === 'completed' && isWithin7Days(completedDate)) {
        var sellerId = U.escapeHtml(o.seller_id || o.sellerId || '');
        if (o._dispute) {
          disputeBadge = ' ' + getDisputeStatusBadge(o._dispute);
        } else {
          actions += '<button class="btn-sm btn-outline" onclick="openDispute(\'' + oId + '\', \'' + sellerId + '\')">&#9888; فتح نزاع</button>';
        }
      } else if (o.status === 'completed' && o._dispute) {
        disputeBadge = ' ' + getDisputeStatusBadge(o._dispute);
      }

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
          '<td>' + U.statusLabel(o.status) + disputeBadge + '</td>' +
          '<td style="font-size:0.82rem; opacity:0.7;">' + oDate + '</td>' +
          '<td><div class="action-btns">' + actions + '</div></td>' +
        '</tr>';
    });

    document.getElementById('ordersBody').innerHTML = html;
  }

  // ===== فلترة الطلبات =====
  function filterOrders(tab) {
    currentOrderFilter = tab;
    document.querySelectorAll('#orderTabs .tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    renderOrders();
  }

  // ===== تحديث حالة الطلب =====
  async function updateOrderStatus(orderId, newStatus) {
    var state = SAIDAT.dashboard.state;
    var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;

    var statusNotes = { processing: 'تم قبول الطلب', completed: 'تم شحن الطلب وإتمامه', cancelled: 'تم رفض الطلب' };

    // Persist to Supabase أولاً
    var updateOk = await SAIDAT.orders.update(orderId, { status: newStatus });
    if (!updateOk) {
      SAIDAT.ui.showToast('فشل تحديث حالة الطلب', 'error');
      return;
    }
    await SAIDAT.orders.addHistory(orderId, newStatus, statusNotes[newStatus] || 'تم تحديث الحالة');

    // DB update نجح — تحديث محلي
    order.status = newStatus;
    order.statusHistory = order.statusHistory || [];
    order.statusHistory.push({
      status: newStatus,
      date: new Date().toISOString(),
      note: statusNotes[newStatus] || 'تم تحديث الحالة'
    });

    // If completed, record transaction via secure RPC
    if (newStatus === 'completed') {
      var commission = order.total * CFG.COMMISSION_RATE;

      var sb = U.getSupabase();
      if (sb) {
        try {
          var rpcResult = await sb.rpc('record_sale_transaction', {
            p_order_id: order.id,
            p_amount: order.total,
            p_commission_rate: CFG.COMMISSION_RATE
          });
          if (rpcResult.error) {
            U.log('error', 'record_sale_transaction RPC error:', rpcResult.error);
            SAIDAT.ui.showToast('تم تحديث الحالة لكن فشل تسجيل المعاملة المالية', 'error');
          } else if (rpcResult.data && !rpcResult.data.success) {
            U.log('error', 'record_sale_transaction failed:', rpcResult.data.error);
            SAIDAT.ui.showToast('تم تحديث الحالة لكن فشل تسجيل المعاملة', 'error');
          } else {
            U.log('log', 'Transaction recorded:', rpcResult.data);
            // فقط عند نجاح RPC: تحديث الرصيد والمعاملات محلياً
            state.currentUser.balance += (order.total - commission);
            state.currentUser.totalSales += order.qty;
            state.currentUser.totalRevenue += order.total;
            state.currentUser.transactions.unshift(
              { id: 't_' + Date.now(), type: 'sale', amount: order.total - commission, date: new Date().toISOString(), ref: order.id, status: 'completed', description: 'بيع: ' + (order.productName || order.product_name) },
              { id: 't_' + (Date.now() + 1), type: 'commission', amount: -commission, date: new Date().toISOString(), ref: order.id, status: 'completed', description: 'عمولة المنصة ' + (CFG.COMMISSION_RATE * 100) + '%' }
            );
          }
        } catch(e) {
          U.log('error', 'record_sale_transaction exception:', e);
          SAIDAT.ui.showToast('تم تحديث الحالة لكن حدث خطأ في المعاملة', 'error');
        }
      }
    }

    renderOrders();
    renderOverview();
    renderFinance();

    var msgs = { processing: 'تم قبول الطلب', completed: 'تم شحن الطلب', cancelled: 'تم رفض الطلب' };
    if (newStatus !== 'completed' || (state.currentUser.balance > 0)) {
      SAIDAT.ui.showToast(msgs[newStatus] || 'تم التحديث', 'success');
    }
  }

  // ===== تفاصيل الطلب =====
  function showOrderDetail(orderId) {
    var state = SAIDAT.dashboard.state;
    var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
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

  // ===== إجراءات الطلبات =====
  function acceptOrder(orderId) {
    updateOrderStatus(orderId, 'processing');
    closeOrderDetail();
  }

  function toggleAddressEdit() {
    var form = document.getElementById('addressEditForm');
    if (form) form.classList.toggle('visible');
  }

  function saveOrderAddress(orderId) {
    var state = SAIDAT.dashboard.state;
    var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
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

  // ===== رفض الطلب =====
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
    var state = SAIDAT.dashboard.state;
    var orderId = document.getElementById('rejectOrderId').value;
    var reason = document.getElementById('rejectReason').value;
    if (reason === 'other') {
      reason = document.getElementById('rejectCustomReason').value.trim();
      if (!reason) { SAIDAT.ui.showToast('الرجاء كتابة سبب الرفض', 'error'); return; }
    }
    var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
    if (order) {
      order.cancelReason = reason;
      order.cancel_reason = reason;
      SAIDAT.orders.update(orderId, { cancel_reason: reason });
    }
    updateOrderStatus(orderId, 'cancelled');
    closeRejectModal();
    closeOrderDetail();
  }

  // ===== تصدير عبر namespace =====
  SAIDAT.dashboard.ordersModule = {
    render: renderOrders,
    filter: filterOrders,
    updateStatus: updateOrderStatus,
    showDetail: showOrderDetail,
    closeDetail: closeOrderDetail,
    acceptOrder: acceptOrder,
    openDispute: openDispute
  };

  // ===== Compatibility layer — window wrappers لـ inline onclick =====
  window.renderOrders = renderOrders;
  window.filterOrders = filterOrders;
  window.updateOrderStatus = updateOrderStatus;
  window.showOrderDetail = showOrderDetail;
  window.closeOrderDetail = closeOrderDetail;
  window.acceptOrder = acceptOrder;
  window.toggleAddressEdit = toggleAddressEdit;
  window.saveOrderAddress = saveOrderAddress;
  window.openRejectModal = openRejectModal;
  window.closeRejectModal = closeRejectModal;
  window.onRejectReasonChange = onRejectReasonChange;
  window.confirmRejectOrder = confirmRejectOrder;
  window.openDispute = openDispute;

})();
