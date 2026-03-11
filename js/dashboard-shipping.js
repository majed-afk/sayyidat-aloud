// ===== dashboard-shipping.js — إدارة الشحن والبوالص — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, orders.js, ui.js
// يصدّر: SAIDAT.dashboard.shipping

(function() {
  'use strict';

  SAIDAT.dashboard = SAIDAT.dashboard || {};
  SAIDAT.dashboard.state = SAIDAT.dashboard.state || {};

  var U = SAIDAT.utils;
  var CFG = SAIDAT.config;

  // حالة محلية للشحن
  var _shippingCostStandard = 25;
  var _smsaPdfBase64 = null;

  // ===== تحميل تكلفة الشحن من إعدادات الأدمن =====
  async function loadShippingCost() {
    try {
      var sb = U.getSupabase();
      if (!sb) return;
      var res = await sb.from('admin_settings').select('value').eq('key', 'shipping_standard').single();
      if (res.data && res.data.value) {
        _shippingCostStandard = parseFloat(res.data.value) || 25;
      }
    } catch(e) {
      U.log('error', 'loadShippingCost error:', e);
    }
  }

  // ===== فتح/إغلاق modal البوليصة =====
  function openWaybillModal(orderId) {
    var state = SAIDAT.dashboard.state;
    document.getElementById('waybillOrderId').value = orderId;
    var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
    if (!order) return;

    // Reset SMSA sections
    document.getElementById('smsaInfoGroup').style.display = 'none';
    document.getElementById('smsaResultGroup').style.display = 'none';
    document.getElementById('smsaPdfContainer').innerHTML = '';
    var btnText = document.getElementById('smsaBtnText');
    var btnSpinner = document.getElementById('smsaBtnSpinner');
    if (btnText) btnText.style.display = '';
    if (btnSpinner) btnSpinner.style.display = 'none';
    var genBtn = document.getElementById('smsaGenerateBtn');
    if (genBtn) { genBtn.disabled = false; genBtn.style.opacity = '1'; }

    document.getElementById('waybillCarrier').value = order.carrier || '';
    document.getElementById('waybillTracking').value = order.trackingNumber || order.tracking_number || '';
    var carrierVal = order.carrier;
    document.getElementById('customCarrierGroup').style.display = carrierVal === 'other' ? 'block' : 'none';
    if (carrierVal === 'other' && (order.carrierName || order.carrier_name)) {
      document.getElementById('waybillCustomCarrier').value = order.carrierName || order.carrier_name;
    }

    // Trigger carrier change to handle SMSA vs manual display
    onWaybillCarrierChange();

    SAIDAT.ui.openModal('waybillModal');
  }

  function closeWaybillModal() {
    SAIDAT.ui.closeModal('waybillModal');
  }

  // ===== تغيير شركة الشحن =====
  function onWaybillCarrierChange() {
    var state = SAIDAT.dashboard.state;
    var carrier = document.getElementById('waybillCarrier').value;
    var isSMSA = carrier === 'smsa';

    // Toggle visibility: SMSA auto vs manual
    document.getElementById('customCarrierGroup').style.display = carrier === 'other' ? 'block' : 'none';
    document.getElementById('smsaInfoGroup').style.display = isSMSA ? 'block' : 'none';
    document.getElementById('smsaResultGroup').style.display = 'none';
    document.getElementById('manualTrackingGroup').style.display = isSMSA ? 'none' : 'block';
    document.getElementById('waybillPreview').style.display = isSMSA ? 'none' : 'block';
    document.getElementById('waybillManualFooter').style.display = isSMSA ? 'none' : 'flex';

    if (isSMSA) {
      // Show shipping cost + balance
      var cost = _shippingCostStandard || 25;
      document.getElementById('smsaShippingCost').textContent = cost + ' ر.س';
      var balance = state.currentUser ? state.currentUser.balance : 0;
      document.getElementById('smsaCurrentBalance').textContent = U.formatNumber(balance) + ' ر.س';

      var canAfford = balance >= cost;
      document.getElementById('smsaBalanceWarning').style.display = canAfford ? 'none' : 'block';
      document.getElementById('smsaGenerateBtn').disabled = !canAfford;
      document.getElementById('smsaGenerateBtn').style.opacity = canAfford ? '1' : '0.5';

      // Check if already has AWB
      var orderId = document.getElementById('waybillOrderId').value;
      var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
      if (order && order.awb_number && order.shipment_state === 'finalized') {
        document.getElementById('smsaInfoGroup').style.display = 'none';
        document.getElementById('smsaResultGroup').style.display = 'block';
        document.getElementById('smsaAwbDisplay').textContent = order.awb_number;
      }
    } else {
      updateWaybillPreview();
    }
  }

  // ===== معاينة البوليصة اليدوية =====
  function updateWaybillPreview() {
    var state = SAIDAT.dashboard.state;
    var orderId = document.getElementById('waybillOrderId').value;
    var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
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

    var senderName = U.escapeHtml(state.currentUser.firstName + ' ' + state.currentUser.lastName);
    var storeName = U.escapeHtml(state.currentUser.storeName || 'صيدات العود');
    var senderPhone = U.escapeHtml(state.currentUser.phone || '');
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

  // ===== حفظ وطباعة البوليصة اليدوية =====
  function saveAndPrintWaybill() {
    var state = SAIDAT.dashboard.state;
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
    var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
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

  // ===== SMSA API Helper =====
  async function _smsaApiCall(action, orderId) {
    var sb = U.getSupabase();
    if (!sb) throw new Error('غير مصرّح');
    var session = (await sb.auth.getSession()).data.session;
    if (!session) throw new Error('غير مصرّح');

    var res = await fetch('/api/smsa', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify({ action: action, orderId: orderId })
    });
    var data = await res.json();
    return data;
  }

  // ===== إنشاء بوليصة SMSA =====
  async function generateSMSAWaybill() {
    var state = SAIDAT.dashboard.state;
    var orderId = document.getElementById('waybillOrderId').value;
    if (!orderId) return;

    var btn = document.getElementById('smsaGenerateBtn');
    var btnText = document.getElementById('smsaBtnText');
    var btnSpinner = document.getElementById('smsaBtnSpinner');

    // Double-click guard (UI)
    if (btn.disabled) return;
    btn.disabled = true;
    btn.style.opacity = '0.5';
    btnText.style.display = 'none';
    btnSpinner.style.display = '';

    try {
      // Step 1: Create shipment (reserve → SMSA → commit)
      var result = await _smsaApiCall('createShipment', orderId);
      if (!result.success) {
        SAIDAT.ui.showToast(result.error || 'فشل إصدار البوليصة', 'error');
        btn.disabled = false;
        btn.style.opacity = '1';
        btnText.style.display = '';
        btnSpinner.style.display = 'none';
        return;
      }

      var awbNumber = result.awbNumber;
      if (result.warning) {
        SAIDAT.ui.showToast(result.warning, 'warning');
      }

      // Step 2: Get PDF (separate call)
      _smsaPdfBase64 = null;
      try {
        var pdfResult = await _smsaApiCall('getPDF', orderId);
        if (pdfResult.success && pdfResult.pdfBase64) {
          _smsaPdfBase64 = pdfResult.pdfBase64;
          var iframe = '<iframe src="data:application/pdf;base64,' + pdfResult.pdfBase64 + '" style="width:100%;height:300px;border:1px solid rgba(255,255,255,0.1);border-radius:8px;" frameborder="0"></iframe>';
          document.getElementById('smsaPdfContainer').innerHTML = iframe;
        }
      } catch(pdfErr) {
        U.log('error', 'PDF fetch failed:', pdfErr);
      }

      // Show result
      document.getElementById('smsaInfoGroup').style.display = 'none';
      document.getElementById('smsaResultGroup').style.display = 'block';
      document.getElementById('smsaAwbDisplay').textContent = awbNumber;

      // Update local order data — respect server state (may be needs_reconcile)
      var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
      if (order) {
        order.awb_number = awbNumber;
        order.carrier = 'smsa';
        order.carrier_name = 'SMSA Express';
        order.waybill_generated = true;
        order.shipment_state = result.shipmentState || 'finalized';
        order.tracking_number = awbNumber;
      }

      // Refresh orders + finance
      renderOrders();
      renderFinance();
      SAIDAT.ui.showToast('تم إصدار بوليصة SMSA بنجاح: ' + awbNumber, 'success');

    } catch(err) {
      U.log('error', 'generateSMSAWaybill error:', err);
      SAIDAT.ui.showToast('حدث خطأ غير متوقع. حاول مرة أخرى', 'error');
      btn.disabled = false;
      btn.style.opacity = '1';
      btnText.style.display = '';
      btnSpinner.style.display = 'none';
    }
  }

  // ===== إلغاء شحنة SMSA =====
  async function cancelSMSAShipment() {
    var state = SAIDAT.dashboard.state;
    var orderId = document.getElementById('waybillOrderId').value;
    if (!orderId) return;

    if (!confirm('هل تريد إلغاء الشحنة واسترجاع تكلفة الشحن؟')) return;

    try {
      SAIDAT.ui.showToast('جارٍ إلغاء الشحنة...', 'info');
      var result = await _smsaApiCall('cancelShipment', orderId);

      if (!result.success) {
        SAIDAT.ui.showToast(result.error || 'فشل إلغاء الشحنة', 'error');
        return;
      }

      if (result.warning) {
        SAIDAT.ui.showToast(result.warning, 'warning');
      }

      // Update local
      var order = state.currentUser.orders.find(function(o) { return o.id === orderId; });
      if (order) {
        order.awb_number = '';
        order.carrier = '';
        order.carrier_name = '';
        order.waybill_generated = false;
        order.shipment_state = 'cancelled';
      }
      if (result.refunded && state.currentUser) {
        state.currentUser.balance = (state.currentUser.balance || 0) + result.refunded;
      }

      // Reset UI
      document.getElementById('smsaResultGroup').style.display = 'none';
      document.getElementById('smsaInfoGroup').style.display = 'block';
      document.getElementById('smsaPdfContainer').innerHTML = '';
      _smsaPdfBase64 = null;
      onWaybillCarrierChange();

      renderOrders();
      renderFinance();
      SAIDAT.ui.showToast('تم إلغاء الشحنة واسترجاع ' + (result.refunded || 0) + ' ر.س', 'success');

    } catch(err) {
      U.log('error', 'cancelSMSAShipment error:', err);
      SAIDAT.ui.showToast('حدث خطأ أثناء الإلغاء', 'error');
    }
  }

  // ===== طباعة وتحميل ملصق SMSA =====
  function printSMSALabel() {
    if (_smsaPdfBase64) {
      var win = window.open('', '_blank');
      win.document.write('<html><body style="margin:0;"><embed width="100%" height="100%" src="data:application/pdf;base64,' + _smsaPdfBase64 + '" type="application/pdf" /></body></html>');
      win.document.close();
      setTimeout(function() { win.print(); }, 500);
    } else {
      SAIDAT.ui.showToast('لا يوجد ملف PDF للطباعة', 'error');
    }
  }

  function downloadSMSALabel() {
    if (_smsaPdfBase64) {
      var awb = document.getElementById('smsaAwbDisplay').textContent || 'smsa-label';
      var link = document.createElement('a');
      link.href = 'data:application/pdf;base64,' + _smsaPdfBase64;
      link.download = 'SMSA-' + awb + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      SAIDAT.ui.showToast('لا يوجد ملف PDF للتحميل', 'error');
    }
  }

  // ===== تصدير عبر namespace =====
  SAIDAT.dashboard.shipping = {
    loadShippingCost: loadShippingCost,
    openWaybillModal: openWaybillModal,
    closeWaybillModal: closeWaybillModal,
    onWaybillCarrierChange: onWaybillCarrierChange,
    updateWaybillPreview: updateWaybillPreview,
    saveAndPrintWaybill: saveAndPrintWaybill,
    generateSMSAWaybill: generateSMSAWaybill,
    cancelSMSAShipment: cancelSMSAShipment,
    printSMSALabel: printSMSALabel,
    downloadSMSALabel: downloadSMSALabel
  };

  // ===== Compatibility layer — window wrappers لـ inline onclick =====
  window.openWaybillModal = openWaybillModal;
  window.closeWaybillModal = closeWaybillModal;
  window.onWaybillCarrierChange = onWaybillCarrierChange;
  window.saveAndPrintWaybill = saveAndPrintWaybill;
  window.generateSMSAWaybill = generateSMSAWaybill;
  window.cancelSMSAShipment = cancelSMSAShipment;
  window.printSMSALabel = printSMSALabel;
  window.downloadSMSALabel = downloadSMSALabel;
  window.loadShippingCost = loadShippingCost;

})();
