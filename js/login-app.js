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

  // ===== Rate Limiting لمحاولات الدخول =====
  var _loginAttempts = 0;
  var _lockUntil = 0;

  // ===== معالجة تسجيل الدخول =====
  async function handleLogin(e) {
    e.preventDefault();
    var errEl = document.getElementById('loginError');
    errEl.style.display = 'none';

    // فحص القفل المؤقت
    if (Date.now() < _lockUntil) {
      var remaining = Math.ceil((_lockUntil - Date.now()) / 60000);
      errEl.textContent = 'تم قفل تسجيل الدخول مؤقتاً. حاول بعد ' + remaining + ' دقيقة';
      errEl.style.display = 'block';
      return false;
    }

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
        _loginAttempts = 0; // إعادة العداد عند النجاح

        // تذكرني — حفظ الإيميل في localStorage
        var rememberEl = document.getElementById('rememberMe');
        if (rememberEl && rememberEl.checked) {
          localStorage.setItem('sa_remember', '1');
          localStorage.setItem('sa_email', email);
        } else {
          localStorage.removeItem('sa_remember');
          localStorage.removeItem('sa_email');
        }

        window.location.href = 'dashboard.html';
      } else {
        _loginAttempts++;
        if (_loginAttempts >= 5) {
          _lockUntil = Date.now() + 900000; // قفل 15 دقيقة
          errEl.textContent = 'تم تجاوز الحد المسموح. تم قفل تسجيل الدخول لمدة 15 دقيقة';
        } else {
          errEl.textContent = result.message + ' (محاولة ' + _loginAttempts + '/5)';
        }
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

  // ===== تسجيل دخول اجتماعي =====
  async function socialLogin(provider) {
    provider = provider.toLowerCase();
    var sb = SAIDAT.utils.getSupabase();
    if (!sb) {
      SAIDAT.ui.showToast('خطأ في الاتصال بالخادم', 'error');
      return;
    }

    try {
      var res = await sb.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: window.location.origin + '/dashboard.html'
        }
      });

      if (res.error) {
        SAIDAT.ui.showToast('خطأ: ' + res.error.message, 'error');
      }
    } catch(e) {
      SAIDAT.ui.showToast('خطأ في تسجيل الدخول: ' + e.message, 'error');
    }
  }

  // ===== نسيت كلمة المرور =====
  function showForgotPassword() {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('tab-forgot').style.display = 'block';
    document.getElementById('tab-forgot').classList.add('active');
    document.getElementById('tab-reset').style.display = 'none';
    document.querySelector('.auth-tabs').style.display = 'none';
    document.getElementById('forgotError').style.display = 'none';
    document.getElementById('forgotSuccess').style.display = 'none';
  }

  function hideForgotPassword() {
    document.getElementById('tab-forgot').style.display = 'none';
    document.getElementById('tab-forgot').classList.remove('active');
    document.getElementById('tab-login').classList.add('active');
    document.querySelector('.auth-tabs').style.display = '';
  }

  async function sendResetEmail() {
    var errEl = document.getElementById('forgotError');
    var sucEl = document.getElementById('forgotSuccess');
    errEl.style.display = 'none';
    sucEl.style.display = 'none';

    var email = document.getElementById('forgotEmail').value.trim();
    if (!email) {
      errEl.textContent = 'يرجى إدخال البريد الإلكتروني';
      errEl.style.display = 'block';
      return;
    }

    var btn = document.querySelector('#tab-forgot .btn');
    btn.classList.add('loading');
    btn.textContent = 'جاري الإرسال...';

    try {
      var result = await SAIDAT.auth.resetPasswordForEmail(email);
      if (result.success) {
        sucEl.textContent = 'تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني. تحقق من صندوق الوارد.';
        sucEl.style.display = 'block';
      } else {
        errEl.textContent = result.message || 'حدث خطأ أثناء الإرسال';
        errEl.style.display = 'block';
      }
    } catch(e) {
      errEl.textContent = 'خطأ: ' + e.message;
      errEl.style.display = 'block';
    }
    btn.classList.remove('loading');
    btn.textContent = 'إرسال رابط التعيين';
  }

  // ===== إعادة تعيين كلمة المرور (بعد الضغط على الرابط في البريد) =====
  async function submitNewPassword() {
    var errEl = document.getElementById('resetError');
    var sucEl = document.getElementById('resetSuccess');
    errEl.style.display = 'none';
    sucEl.style.display = 'none';

    var pw = document.getElementById('resetPassword').value;
    var pw2 = document.getElementById('resetPasswordConfirm').value;

    if (!pw || pw.length < 6) {
      errEl.textContent = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
      errEl.style.display = 'block';
      return;
    }
    if (pw !== pw2) {
      errEl.textContent = 'كلمة المرور غير متطابقة';
      errEl.style.display = 'block';
      return;
    }

    var btn = document.querySelector('#tab-reset .btn');
    btn.classList.add('loading');
    btn.textContent = 'جاري التعيين...';

    try {
      var result = await SAIDAT.auth.updatePassword(pw);
      if (result.success) {
        sucEl.textContent = 'تم تعيين كلمة المرور بنجاح! جاري التوجيه...';
        sucEl.style.display = 'block';
        setTimeout(function() { window.location.href = 'dashboard.html'; }, 2000);
      } else {
        errEl.textContent = result.message || 'حدث خطأ أثناء التعيين';
        errEl.style.display = 'block';
      }
    } catch(e) {
      errEl.textContent = 'خطأ: ' + e.message;
      errEl.style.display = 'block';
    }
    btn.classList.remove('loading');
    btn.textContent = 'تعيين كلمة المرور';
  }

  // ===== كشف وضع إعادة التعيين عند العودة من رابط البريد =====
  function checkResetMode() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true' || window.location.hash === '#reset') {
      document.getElementById('tab-login').classList.remove('active');
      document.getElementById('tab-register').classList.remove('active');
      document.getElementById('tab-reset').style.display = 'block';
      document.getElementById('tab-reset').classList.add('active');
      document.querySelector('.auth-tabs').style.display = 'none';
    }
  }

  // ===== تذكرني — تحميل الإيميل المحفوظ =====
  (function loadRememberedEmail() {
    if (localStorage.getItem('sa_remember') === '1') {
      var savedEmail = localStorage.getItem('sa_email');
      var emailInput = document.getElementById('loginEmail');
      var rememberCheck = document.getElementById('rememberMe');
      if (savedEmail && emailInput) emailInput.value = savedEmail;
      if (rememberCheck) rememberCheck.checked = true;
    }
  })();

  // ===== التحقق من وضع إعادة التعيين عند التحميل =====
  checkResetMode();

  // ===== كشف الدوال للـ onclick handlers =====
  window.switchTab = switchTab;
  window.togglePassword = togglePassword;
  window.handleLogin = handleLogin;
  window.handleRegister = handleRegister;
  window.socialLogin = socialLogin;
  window.showForgotPassword = showForgotPassword;
  window.hideForgotPassword = hideForgotPassword;
  window.sendResetEmail = sendResetEmail;
  window.submitNewPassword = submitNewPassword;

})();
