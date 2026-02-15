// ===== login-app.js — منطق صفحة تسجيل الدخول — صيدات العود =====

(function() {
  'use strict';

  // ===== تبديل التبويبات =====
  function switchTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(function(t) {
      t.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(function(c) {
      c.classList.remove('active');
    });
    document.querySelector('[data-tab="' + tabName + '"]').classList.add('active');
    document.getElementById('tab-' + tabName).classList.add('active');
  }

  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      switchTab(tab.dataset.tab);
    });
  });

  // ===== إظهار/إخفاء كلمة المرور =====
  function togglePassword(inputId, btn) {
    var input = document.getElementById(inputId);
    if (input.type === 'password') {
      input.type = 'text';
      btn.textContent = '🙈';
    } else {
      input.type = 'password';
      btn.textContent = '👁️';
    }
  }

  // ===== معالجة تسجيل الدخول =====
  async function handleLogin(e) {
    e.preventDefault();
    var errEl = document.getElementById('loginError');
    errEl.style.display = 'none';

    var email = document.getElementById('loginEmail').value.trim();
    var password = document.getElementById('loginPassword').value;
    var btn = document.querySelector('#loginForm .btn');

    if (!email || !password) {
      errEl.textContent = 'يرجى تعبئة جميع الحقول';
      errEl.style.display = 'block';
      return false;
    }

    btn.classList.add('loading');
    btn.textContent = 'جاري تسجيل الدخول...';

    try {
      var result = await SAIDAT.auth.login(email, password);

      if (result.success) {
        window.location.href = 'dashboard.html';
      } else {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        document.getElementById('loginPassword').value = '';
        btn.classList.remove('loading');
        btn.textContent = 'تسجيل الدخول';
      }
    } catch(err) {
      errEl.textContent = 'خطأ: ' + err.message;
      errEl.style.display = 'block';
      btn.classList.remove('loading');
      btn.textContent = 'تسجيل الدخول';
    }
    return false;
  }

  // ===== معالجة إنشاء الحساب =====
  async function handleRegister(e) {
    e.preventDefault();
    var errEl = document.getElementById('registerError');
    var sucEl = document.getElementById('registerSuccess');
    errEl.style.display = 'none';
    sucEl.style.display = 'none';

    var firstName = document.getElementById('regFirstName').value.trim();
    var lastName = document.getElementById('regLastName').value.trim();
    var email = document.getElementById('regEmail').value.trim();
    var phone = document.getElementById('regPhone').value.trim();
    var password = document.getElementById('regPassword').value;
    var confirm = document.getElementById('regPasswordConfirm').value;
    var terms = document.getElementById('regTerms').checked;
    var btn = document.querySelector('#registerForm .btn');

    if (!firstName || !lastName || !email || !phone || !password || !confirm) {
      errEl.textContent = 'يرجى تعبئة جميع الحقول';
      errEl.style.display = 'block';
      return false;
    }

    if (password.length < 6) {
      errEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      errEl.style.display = 'block';
      return false;
    }

    if (password !== confirm) {
      errEl.textContent = 'كلمة المرور غير متطابقة';
      errEl.style.display = 'block';
      return false;
    }

    if (!terms) {
      errEl.textContent = 'يجب الموافقة على شروط الاستخدام وسياسة الخصوصية';
      errEl.style.display = 'block';
      return false;
    }

    btn.classList.add('loading');
    btn.textContent = 'جاري إنشاء الحساب...';

    try {
      var result = await SAIDAT.auth.register({
        firstName: firstName,
        lastName: lastName,
        email: email,
        phone: phone,
        password: password
      });

      if (result.success) {
        window.location.href = 'dashboard.html';
      } else {
        errEl.textContent = result.message;
        errEl.style.display = 'block';
        btn.classList.remove('loading');
        btn.textContent = 'إنشاء حساب';
      }
    } catch(err) {
      errEl.textContent = 'خطأ: ' + err.message;
      errEl.style.display = 'block';
      btn.classList.remove('loading');
      btn.textContent = 'إنشاء حساب';
    }
    return false;
  }

  // ===== تسجيل دخول اجتماعي (غير متاح حالياً) =====
  function socialLogin(provider) {
    SAIDAT.ui.showToast('التسجيل عبر ' + provider + ' قريباً!', 'error');
  }

  // ===== كشف الدوال للـ onclick handlers =====
  window.switchTab = switchTab;
  window.togglePassword = togglePassword;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
  window.socialLogin = socialLogin;

})();
