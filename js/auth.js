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
    _initResolve: null,  // resolve function للـ init promise
    _initDone: false,    // هل اكتملت التهيئة؟

    // ===== انتظار التهيئة =====
    ready: function() {
      return this._initPromise || Promise.resolve();
    },

    // ===== التهيئة =====
    // تعتمد على onAuthStateChange بدل getSession — أكثر استقراراً
    init: async function() {
      var sb = U.getSupabase();
      if (!sb) {
        console.warn('Auth: no Supabase client');
        return;
      }

      console.log('Auth: init started');
      var self = this;

      // onAuthStateChange يُطلق INITIAL_SESSION فوراً — نعتمد عليه
      sb.auth.onAuthStateChange(function(event, session) {
        console.log('Auth event:', event, !!session);

        if (event === 'SIGNED_OUT') {
          self._user = null;
          self._profile = null;
        } else if (session && session.user) {
          self._user = session.user;
        }
        // session = null بدون SIGNED_OUT → لا نصفّر (مثل token refresh failure)

        // أول حدث → نحل الـ initPromise فوراً (بدون انتظار profile)
        // ثم نحمّل البروفايل في الخلفية
        if (!self._initDone) {
          self._initDone = true;

          if (self._user) {
            // نحمّل البروفايل مع timeout 5 ثوانٍ — ثم نحل الـ promise
            var profileTimeout = new Promise(function(r) { setTimeout(r, 5000); });
            Promise.race([self._loadProfile(), profileTimeout]).then(function() {
              console.log('Auth: init complete, user:', !!self._user, 'profile:', !!self._profile);
              if (self._initResolve) {
                self._initResolve();
                self._initResolve = null;
              }
              if (SAIDAT.header && SAIDAT.header.update) {
                SAIDAT.header.update();
              }
            });
          } else {
            console.log('Auth: init complete, no user');
            if (self._initResolve) {
              self._initResolve();
              self._initResolve = null;
            }
          }
        } else {
          // أحداث لاحقة (مش أول حدث) — نحمّل البروفايل ونحدّث الهيدر
          if (session && session.user) {
            self._loadProfile().then(function() {
              if (SAIDAT.header && SAIDAT.header.update) {
                SAIDAT.header.update();
              }
            });
          } else {
            if (SAIDAT.header && SAIDAT.header.update) {
              SAIDAT.header.update();
            }
          }
        }
      });

      // Safety timeout — إذا onAuthStateChange ما أطلق خلال 8 ثوانٍ، نكمل بدون مستخدم
      setTimeout(function() {
        if (!self._initDone) {
          self._initDone = true;
          console.warn('Auth: init timeout — proceeding without user');
          if (self._initResolve) {
            self._initResolve();
            self._initResolve = null;
          }
        }
      }, 8000);
    },

    // ===== تحميل البروفايل (مع timeout 5 ثوانٍ) =====
    _loadProfile: async function() {
      if (!this._user) return;
      var sb = U.getSupabase();
      if (!sb) return;
      try {
        console.log('Auth: loading profile for', this._user.id);
        var query = sb.from('profiles').select('*').eq('id', this._user.id).single();

        // timeout 5 ثوانٍ — لو الـ query علّق نكمل بدون بروفايل
        var timeout = new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('Profile query timeout 5s')); }, 5000);
        });

        var res = await Promise.race([query, timeout]);
        if (res.data) {
          this._profile = res.data;
          console.log('Auth: profile loaded, role:', res.data.role);
        } else if (res.error) {
          console.warn('Auth: profile query error:', res.error.message);
        }
      } catch(e) {
        console.warn('Auth: profile load error:', e.message);
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
  // _initPromise يُعيّن فوراً — يتحل عند أول حدث من onAuthStateChange
  SAIDAT.auth._initPromise = new Promise(function(resolve) {
    SAIDAT.auth._initResolve = resolve;
    function startInit() {
      SAIDAT.auth.init().catch(function(e) {
        console.error('Auth init fatal:', e);
        resolve(); // حتى لو فشلت — نحل الـ promise
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', startInit);
    } else {
      startInit();
    }
  });

})();
