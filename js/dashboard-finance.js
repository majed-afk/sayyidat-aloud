// ===== dashboard-finance.js — إدارة المالية — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, transactions.js, ui.js
// يصدّر: SAIDAT.dashboard.finance

(function() {
  'use strict';

  SAIDAT.dashboard = SAIDAT.dashboard || {};
  SAIDAT.dashboard.state = SAIDAT.dashboard.state || {};

  var U = SAIDAT.utils;
  var CFG = SAIDAT.config;

  // ===== عرض المالية =====
  function renderFinance() {
    var state = SAIDAT.dashboard.state;
    var user = state.currentUser;

    document.getElementById('balanceAmount').innerHTML = U.formatNumber(user.balance) + ' <span>ر.س</span>';

    // Calculate stats
    var _now = new Date();
    var _currentMonth = _now.getFullYear() + '-' + String(_now.getMonth() + 1).padStart(2, '0');
    var thisMonthSales = user.transactions.filter(function(t) {
      var d = t.date || t.created_at || '';
      return t.type === 'sale' && d.startsWith(_currentMonth);
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

  // ===== السحب =====
  function openWithdrawModal() {
    var state = SAIDAT.dashboard.state;
    document.getElementById('withdrawAmount').value = '';
    document.getElementById('withdrawBank').value = state.currentUser.bankName || 'لم يتم تحديد البنك';
    document.getElementById('withdrawIban').value = state.currentUser.iban || 'لم يتم تحديد الآيبان';
    SAIDAT.ui.openModal('withdrawModal');
  }

  function closeWithdrawModal() {
    SAIDAT.ui.closeModal('withdrawModal');
  }

  async function submitWithdraw() {
    var state = SAIDAT.dashboard.state;
    var amount = parseFloat(document.getElementById('withdrawAmount').value);
    if (!amount || amount < CFG.MIN_WITHDRAWAL) {
      SAIDAT.ui.showToast('الحد الأدنى للسحب ' + CFG.MIN_WITHDRAWAL + ' ر.س', 'error');
      return;
    }
    if (amount > state.currentUser.balance) {
      SAIDAT.ui.showToast('المبلغ أكبر من الرصيد المتاح', 'error');
      return;
    }
    if (!state.currentUser.iban) {
      SAIDAT.ui.showToast('الرجاء إضافة معلوماتك البنكية أولاً', 'error');
      return;
    }

    // استخدام RPC آمن
    var sb = U.getSupabase();
    if (!sb) return;

    try {
      var res = await sb.rpc('record_withdrawal', {
        p_amount: amount,
        p_bank_name: state.currentUser.bankName || ''
      });

      if (res.error) {
        U.log('error', 'record_withdrawal RPC error:', res.error.message);
        SAIDAT.ui.showToast('فشل طلب السحب: ' + res.error.message, 'error');
        return;
      }

      if (res.data && !res.data.success) {
        var errMap = {
          'insufficient_balance': 'الرصيد غير كافٍ',
          'no_iban': 'يجب إضافة الآيبان أولاً',
          'invalid_amount': 'مبلغ غير صالح'
        };
        SAIDAT.ui.showToast(errMap[res.data.error] || 'فشل طلب السحب', 'error');
        return;
      }

      // تحديث الرصيد المحلي من استجابة السيرفر
      state.currentUser.balance = res.data.new_balance;

      // إضافة المعاملة للعرض المحلي
      state.currentUser.transactions.unshift({
        id: 't_' + Date.now(),
        type: 'withdrawal',
        amount: -amount,
        date: new Date().toISOString().split('T')[0],
        ref: 'W-' + Math.floor(Math.random() * 999 + 1).toString().padStart(3, '0'),
        status: 'pending',
        description: 'سحب إلى ' + state.currentUser.bankName
      });

      renderFinance();
      renderOverview();
      closeWithdrawModal();
      SAIDAT.ui.showToast('تم طلب السحب بنجاح - سيتم التحويل خلال 1-3 أيام عمل', 'success');
    } catch(e) {
      U.log('error', 'record_withdrawal exception:', e);
      SAIDAT.ui.showToast('حدث خطأ في طلب السحب', 'error');
    }
  }

  // ===== تصدير عبر namespace =====
  SAIDAT.dashboard.finance = {
    render: renderFinance,
    openWithdrawModal: openWithdrawModal,
    closeWithdrawModal: closeWithdrawModal,
    submitWithdraw: submitWithdraw
  };

  // ===== Compatibility layer — window wrappers لـ inline onclick =====
  window.renderFinance = renderFinance;
  window.openWithdrawModal = openWithdrawModal;
  window.closeWithdrawModal = closeWithdrawModal;
  window.submitWithdraw = submitWithdraw;

})();
