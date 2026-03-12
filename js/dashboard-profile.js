// ===== dashboard-profile.js — الملف الشخصي وحذف الحساب — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, profiles.js, ui.js
// يصدّر: SAIDAT.dashboard.profile

(function() {
  'use strict';

  SAIDAT.dashboard = SAIDAT.dashboard || {};
  SAIDAT.dashboard.state = SAIDAT.dashboard.state || {};

  var U = SAIDAT.utils;

  // ===== تحميل الملف الشخصي =====
  function loadProfile() {
    var state = SAIDAT.dashboard.state;
    var user = state.currentUser;
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

  // ===== إرسال طلب توثيق تاجر =====
  function submitMerchantVerification() {
    var state = SAIDAT.dashboard.state;
    var register = document.getElementById('profCommercialRegister').value.trim();
    if (!register) { SAIDAT.ui.showToast('الرجاء إدخال رقم السجل التجاري', 'error'); return; }
    state.currentUser.commercialRegister = register;
    SAIDAT.profiles.update({ commercialRegister: register });
    loadProfile();
    SAIDAT.ui.showToast('تم إرسال طلب التوثيق - سيتم مراجعته من الإدارة', 'success');
  }

  // ===== حفظ الملف الشخصي =====
  async function saveProfile() {
    var state = SAIDAT.dashboard.state;
    var firstName = document.getElementById('profFirstName').value.trim();
    var lastName = document.getElementById('profLastName').value.trim();
    if (!firstName || !lastName) { SAIDAT.ui.showToast('الاسم مطلوب', 'error'); return; }

    state.currentUser.firstName = firstName;
    state.currentUser.lastName = lastName;
    state.currentUser.email = document.getElementById('profEmail').value.trim();
    state.currentUser.phone = document.getElementById('profPhone').value.trim();
    state.currentUser.storeName = document.getElementById('profStoreName').value.trim();
    state.currentUser.storeDesc = document.getElementById('profStoreDesc').value.trim();
    state.currentUser.bankName = document.getElementById('profBankName').value;
    state.currentUser.bankHolder = document.getElementById('profBankHolder').value.trim();
    state.currentUser.iban = document.getElementById('profIban').value.trim();

    // ★ F-01 FIX: Password change via Supabase Auth API (not btoa)
    var newPass = document.getElementById('profNewPass').value;
    var confirmPass = document.getElementById('profConfirmPass').value;

    if (newPass || confirmPass) {
      if (newPass.length < 6) {
        SAIDAT.ui.showToast('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
      }
      if (newPass !== confirmPass) {
        SAIDAT.ui.showToast('كلمات المرور غير متطابقة', 'error');
        return;
      }
      var passResult = await SAIDAT.auth.updatePassword(newPass);
      if (!passResult.success) {
        SAIDAT.ui.showToast(passResult.message || 'فشل تغيير كلمة المرور', 'error');
        return;
      }
      SAIDAT.ui.showToast('تم تغيير كلمة المرور بنجاح', 'success');
    }

    SAIDAT.profiles.update({
      firstName: state.currentUser.firstName,
      lastName: state.currentUser.lastName,
      phone: state.currentUser.phone,
      storeName: state.currentUser.storeName,
      storeDesc: state.currentUser.storeDesc,
      bankName: state.currentUser.bankName,
      bankHolder: state.currentUser.bankHolder,
      iban: state.currentUser.iban
    });

    updateSidebar();
    loadProfile();
    SAIDAT.ui.showToast('تم حفظ التغييرات بنجاح', 'success');
  }

  // ===== حذف الحساب =====
  function confirmDeleteAccount() {
    document.getElementById('deleteAccountModal').style.display = 'flex';
    document.getElementById('deleteConfirmInput').value = '';
    document.getElementById('deleteAccountError').style.display = 'none';
  }

  async function executeDeleteAccount() {
    var errEl = document.getElementById('deleteAccountError');
    errEl.style.display = 'none';

    var input = document.getElementById('deleteConfirmInput').value.trim();
    if (input !== 'حذف') {
      errEl.textContent = 'يرجى كتابة "حذف" للتأكيد';
      errEl.style.display = 'block';
      return;
    }

    var btn = document.querySelector('#deleteAccountModal .btn[onclick*="executeDeleteAccount"]');
    if (btn) { btn.disabled = true; btn.textContent = 'جاري الحذف...'; }

    try {
      var sb = SAIDAT.utils.getSupabase();
      if (!sb) {
        errEl.textContent = 'خطأ في الاتصال بالخادم';
        errEl.style.display = 'block';
        return;
      }

      var res = await sb.rpc('delete_own_account', { p_reason: '' });
      if (res.error) {
        errEl.textContent = 'خطأ: ' + res.error.message;
        errEl.style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = 'نعم، احذف حسابي'; }
        return;
      }

      var result = res.data;
      if (result && result.success) {
        SAIDAT.ui.showToast('تم حذف حسابك بنجاح', 'success');
        setTimeout(function() { window.location.href = 'index.html'; }, 2000);
      } else {
        errEl.textContent = (result && result.message) || 'حدث خطأ أثناء حذف الحساب';
        errEl.style.display = 'block';
        if (btn) { btn.disabled = false; btn.textContent = 'نعم، احذف حسابي'; }
      }
    } catch(e) {
      errEl.textContent = 'خطأ: ' + e.message;
      errEl.style.display = 'block';
      if (btn) { btn.disabled = false; btn.textContent = 'نعم، احذف حسابي'; }
    }
  }

  // ===== تصدير عبر namespace =====
  SAIDAT.dashboard.profile = {
    load: loadProfile,
    save: saveProfile,
    submitMerchantVerification: submitMerchantVerification,
    confirmDeleteAccount: confirmDeleteAccount,
    executeDeleteAccount: executeDeleteAccount
  };

  // ===== Compatibility layer — window wrappers لـ inline onclick =====
  window.loadProfile = loadProfile;
  window.saveProfile = saveProfile;
  window.submitMerchantVerification = submitMerchantVerification;
  window.confirmDeleteAccount = confirmDeleteAccount;
  window.executeDeleteAccount = executeDeleteAccount;

})();
