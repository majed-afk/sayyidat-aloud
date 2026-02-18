// ===== auth.js — وحدة المصادقة فقط — صيدات العود =====
// المسؤوليات: تسجيل دخول/خروج، تسجيل حساب، إدارة الجلسة
// لا يحتوي على: منتجات، طلبات، معاملات، UI

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.auth = {

    _user: null,
    _profile: null,
    _initPromise: null,

    // ===== انتظار التهيئة =====
    ready: function() {
      return this._initPromise || Promise.resolve();
    },

    // ===== التهيئة =====
    init: async function() {
      var sb = U.getSupabase();
      if (!sb) return;

      // استرجاع الجلسة الحالية
      try {
        var res = await sb.auth.getSession();
        var session = res.data.session;
        if (session && session.user) {
          this._user = session.user;
          await this._loadProfile();
        }
      } catch(e) {
        console.warn('Auth init error:', e);
      }

      // الاستماع لتغييرات الجلسة
      var self = this;
      sb.auth.onAuthStateChange(async function(event, session) {
        console.log('Auth event:', event, !!session);
        if (event === 'SIGNED_OUT') {
          // فقط SIGNED_OUT يصفّر المستخدم — TOKEN_REFRESHED لا يطرد
          self._user = null;
          self._profile = null;
        } else if (session && session.user) {
          self._user = session.user;
          await self._loadProfile();
        }
        if (SAIDAT.header && SAIDAT.header.update) {
          SAIDAT.header.update();
        }
      });

      if (SAIDAT.header && SAIDAT.header.update) {
        SAIDAT.header.update();
      }
    },

    // ===== تحميل البروفايل =====
    _loadProfile: async function() {
      if (!this._user) return;
      var sb = U.getSupabase();
      if (!sb) return;
      try {
        var res = await sb.from('profiles').select('*').eq('id', this._user.id).single();
        if (res.data) this._profile = res.data;
      } catch(e) {
        console.warn('Profile load error:', e);
      }
    },

    // ===== تسجيل مستخدم جديد =====
    register: async function(data) {
      var sb = U.getSupabase();
      if (!sb) return { success: false, message: 'خطأ في الاتصال بالخادم' };

      try {
        var res = await sb.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              first_name: data.firstName,
              last_name: data.lastName,
              phone: data.phone,
              role: 'seller'
            }
          }
        });

        if (res.error) {
          if (res.error.message.includes('already registered')) {
            return { success: false, message: 'البريد الإلكتروني مسجل مسبقاً' };
          }
          return { success: false, message: res.error.message };
        }

        if (res.data.user) {
          this._user = res.data.user;
          // انتظار trigger إنشاء البروفايل — polling بدل تأخير ثابت
          await this._waitForProfile(5, 500);
          return { success: true, user: this.getCurrentUser() };
        }

        return { success: false, message: 'حدث خطأ غير متوقع' };
      } catch(e) {
        return { success: false, message: 'خطأ في الاتصال: ' + e.message };
      }
    },

    /**
     * انتظار إنشاء البروفايل من trigger
     * يحاول عدة مرات بدل التأخير الثابت 1500ms
     */
    _waitForProfile: async function(maxAttempts, delayMs) {
      for (var i = 0; i < maxAttempts; i++) {
        await new Promise(function(r) { setTimeout(r, delayMs); });
        await this._loadProfile();
        if (this._profile) return true;
      }
      return false;
    },

    // ===== تسجيل الدخول =====
    login: async function(email, password) {
      var sb = U.getSupabase();
      if (!sb) return { success: false, message: 'خطأ في الاتصال بالخادم' };

      try {
        var res = await sb.auth.signInWithPassword({ email: email, password: password });

        if (res.error) {
          if (res.error.message.includes('Invalid login')) {
            return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
          }
          return { success: false, message: res.error.message };
        }

        if (res.data.user) {
          this._user = res.data.user;
          await this._loadProfile();

          if (this._profile && this._profile.suspended) {
            await sb.auth.signOut();
            this._user = null;
            this._profile = null;
            return { success: false, message: 'تم تعليق حسابك. تواصل مع إدارة الموقع.' };
          }

          return { success: true, user: this.getCurrentUser() };
        }

        return { success: false, message: 'حدث خطأ غير متوقع' };
      } catch(e) {
        return { success: false, message: 'خطأ في الاتصال: ' + e.message };
      }
    },

    // ===== تسجيل الخروج =====
    logout: async function() {
      var sb = U.getSupabase();
      if (sb) await sb.auth.signOut();
      this._user = null;
      this._profile = null;
      window.location.href = 'index.html';
    },

    // ===== المستخدم الحالي (camelCase) =====
    getCurrentUser: function() {
      if (!this._user || !this._profile) return null;
      return SAIDAT.profiles.formatUser(this._profile, this._user);
    },

    // ===== الملف الخام (snake_case) =====
    getRawProfile: function() {
      return this._profile;
    },

    // ===== auth user =====
    getAuthUser: function() {
      return this._user;
    },

    // ===== هل مسجل دخول؟ =====
    isLoggedIn: function() {
      return this._user !== null && this._profile !== null;
    },

    // ===== هل أدمن؟ =====
    isAdmin: function() {
      return this._profile && this._profile.role === 'admin';
    },

    // ===== إعادة تحميل البروفايل =====
    reloadProfile: async function() {
      await this._loadProfile();
    }
  };

  // ===== التوافق العكسي =====
  window.AUTH = SAIDAT.auth;

  // ===== تشغيل تلقائي =====
  // _initPromise يُعيّن فوراً حتى يعمل ready() بشكل صحيح في كل الصفحات
  SAIDAT.auth._initPromise = new Promise(function(resolve) {
    function startInit() {
      SAIDAT.auth.init().then(resolve).catch(resolve);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startInit);
    } else {
      startInit();
    }
  });

})();
