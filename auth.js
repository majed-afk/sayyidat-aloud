// ===== auth.js - نظام المصادقة لمنصة صيدات العود (Supabase) =====

(function() {
  'use strict';

  // ===== AUTH Object =====
  window.AUTH = {

    _user: null,       // cached auth user
    _profile: null,    // cached profile from DB
    _initPromise: null,

    // ===== انتظار التهيئة =====
    ready: function() {
      return this._initPromise || Promise.resolve();
    },

    // ===== التهيئة =====
    init: async function() {
      var sb = SUPA.getClient();
      if (!sb) { console.warn('Supabase not available'); return; }

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
      sb.auth.onAuthStateChange(async function(event, session) {
        if (session && session.user) {
          AUTH._user = session.user;
          await AUTH._loadProfile();
        } else {
          AUTH._user = null;
          AUTH._profile = null;
        }
        AUTH.updateHeader();
      });

      this.updateHeader();
    },

    // تحميل بيانات البروفايل من جدول profiles
    _loadProfile: async function() {
      if (!this._user) return;
      var sb = SUPA.getClient();
      try {
        var res = await sb
          .from('profiles')
          .select('*')
          .eq('id', this._user.id)
          .single();
        if (res.data) this._profile = res.data;
      } catch(e) {
        console.warn('Profile load error:', e);
      }
    },

    // ===== تسجيل مستخدم جديد =====
    register: async function(data) {
      var sb = SUPA.getClient();
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
          // انتظر قليلاً ليتم إنشاء البروفايل من الـ trigger
          await new Promise(function(r) { setTimeout(r, 1500); });
          await this._loadProfile();
          return { success: true, user: this._formatUser() };
        }

        return { success: false, message: 'حدث خطأ غير متوقع' };
      } catch(e) {
        return { success: false, message: 'خطأ في الاتصال: ' + e.message };
      }
    },

    // ===== تسجيل الدخول =====
    login: async function(email, password) {
      var sb = SUPA.getClient();
      if (!sb) return { success: false, message: 'خطأ في الاتصال بالخادم' };

      try {
        var res = await sb.auth.signInWithPassword({
          email: email,
          password: password
        });

        if (res.error) {
          if (res.error.message.includes('Invalid login')) {
            return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
          }
          return { success: false, message: res.error.message };
        }

        if (res.data.user) {
          this._user = res.data.user;
          await this._loadProfile();

          // تحقق من التعليق
          if (this._profile && this._profile.suspended) {
            await sb.auth.signOut();
            this._user = null;
            this._profile = null;
            return { success: false, message: 'تم تعليق حسابك. تواصل مع إدارة الموقع.' };
          }

          return { success: true, user: this._formatUser() };
        }

        return { success: false, message: 'حدث خطأ غير متوقع' };
      } catch(e) {
        return { success: false, message: 'خطأ في الاتصال: ' + e.message };
      }
    },

    // ===== تسجيل الخروج =====
    logout: async function() {
      var sb = SUPA.getClient();
      if (sb) {
        await sb.auth.signOut();
      }
      this._user = null;
      this._profile = null;
      window.location.href = 'index.html';
    },

    // ===== المستخدم الحالي =====
    getCurrentUser: function() {
      if (!this._user || !this._profile) return null;
      return this._formatUser();
    },

    // تحويل البيانات لنفس الصيغة القديمة (للتوافق مع الصفحات)
    _formatUser: function() {
      var p = this._profile;
      if (!p) return null;
      return {
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        email: this._user ? this._user.email : '',
        phone: p.phone || '',
        role: p.role,
        verified: p.verified,
        suspended: p.suspended,
        createdAt: p.created_at ? p.created_at.split('T')[0] : '',
        storeName: p.store_name || '',
        storeDesc: p.store_desc || '',
        bankName: p.bank_name || '',
        iban: p.iban || '',
        bankHolder: p.bank_holder || '',
        balance: parseFloat(p.balance) || 0,
        totalSales: parseInt(p.total_sales) || 0,
        totalRevenue: parseFloat(p.total_revenue) || 0
      };
    },

    // ===== هل مسجل دخول؟ =====
    isLoggedIn: function() {
      return this._user !== null && this._profile !== null;
    },

    // ===== تحديث بيانات البروفايل =====
    updateUser: async function(updatedData) {
      var sb = SUPA.getClient();
      if (!sb || !this._user) return false;

      try {
        var updateObj = {};
        if (updatedData.firstName !== undefined) updateObj.first_name = updatedData.firstName;
        if (updatedData.lastName !== undefined) updateObj.last_name = updatedData.lastName;
        if (updatedData.phone !== undefined) updateObj.phone = updatedData.phone;
        if (updatedData.storeName !== undefined) updateObj.store_name = updatedData.storeName;
        if (updatedData.storeDesc !== undefined) updateObj.store_desc = updatedData.storeDesc;
        if (updatedData.bankName !== undefined) updateObj.bank_name = updatedData.bankName;
        if (updatedData.iban !== undefined) updateObj.iban = updatedData.iban;
        if (updatedData.bankHolder !== undefined) updateObj.bank_holder = updatedData.bankHolder;
        if (updatedData.balance !== undefined) updateObj.balance = updatedData.balance;
        if (updatedData.totalSales !== undefined) updateObj.total_sales = updatedData.totalSales;
        if (updatedData.totalRevenue !== undefined) updateObj.total_revenue = updatedData.totalRevenue;
        if (updatedData.verified !== undefined) updateObj.verified = updatedData.verified;
        if (updatedData.suspended !== undefined) updateObj.suspended = updatedData.suspended;
        if (updatedData.role !== undefined) updateObj.role = updatedData.role;

        // إذا لم يتم تحويل أي حقول، استخدم البيانات كما هي
        if (Object.keys(updateObj).length === 0) {
          updateObj = Object.assign({}, updatedData);
          delete updateObj.id;
          delete updateObj.email;
        }

        var targetId = updatedData.id || this._user.id;

        var res = await sb
          .from('profiles')
          .update(updateObj)
          .eq('id', targetId);

        if (res.error) {
          console.error('Update error:', res.error);
          return false;
        }

        if (targetId === this._user.id) {
          await this._loadProfile();
        }
        return true;
      } catch(e) {
        console.error('Update error:', e);
        return false;
      }
    },

    // ===== هل المستخدم الحالي أدمن؟ =====
    isAdmin: function() {
      return this._profile && this._profile.role === 'admin';
    },

    // ===== جلب جميع المستخدمين (للأدمن) =====
    getAllUsers: async function() {
      var sb = SUPA.getClient();
      if (!sb) return [];

      try {
        var res = await sb
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (res.error || !res.data) return [];

        return res.data.map(function(p) {
          return {
            id: p.id,
            firstName: p.first_name,
            lastName: p.last_name,
            email: '',
            phone: p.phone || '',
            role: p.role,
            verified: p.verified,
            suspended: p.suspended,
            createdAt: p.created_at ? p.created_at.split('T')[0] : '',
            storeName: p.store_name || '',
            storeDesc: p.store_desc || '',
            bankName: p.bank_name || '',
            iban: p.iban || '',
            bankHolder: p.bank_holder || '',
            balance: parseFloat(p.balance) || 0,
            totalSales: parseInt(p.total_sales) || 0,
            totalRevenue: parseFloat(p.total_revenue) || 0
          };
        });
      } catch(e) {
        console.error('getAllUsers error:', e);
        return [];
      }
    },

    // ===== حذف/تعليق مستخدم =====
    deleteUser: async function(userId) {
      var sb = SUPA.getClient();
      if (!sb) return;
      await sb.from('profiles').update({ suspended: true }).eq('id', userId);
    },

    // ===== DB: منتجات تاجر =====
    getProducts: async function(sellerId) {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var id = sellerId || (this._user ? this._user.id : null);
      if (!id) return [];
      var res = await sb.from('products').select('*').eq('seller_id', id).order('created_at', { ascending: false });
      return res.data || [];
    },

    // ===== DB: كل المنتجات النشطة =====
    getAllProducts: async function() {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var res = await sb.from('products').select('*, profiles(store_name, first_name, last_name, verified)').eq('active', true).order('created_at', { ascending: false });
      return res.data || [];
    },

    // ===== DB: منتج واحد =====
    getProduct: async function(productId) {
      var sb = SUPA.getClient();
      if (!sb) return null;
      var res = await sb.from('products').select('*, profiles(store_name, first_name, last_name, verified, phone)').eq('id', productId).single();
      return res.data || null;
    },

    // ===== DB: إضافة منتج =====
    addProduct: async function(product) {
      var sb = SUPA.getClient();
      if (!sb || !this._user) return null;
      product.seller_id = this._user.id;
      var res = await sb.from('products').insert(product).select().single();
      if (res.error) { console.error('addProduct:', res.error); return null; }
      return res.data;
    },

    // ===== DB: تحديث منتج =====
    updateProduct: async function(productId, updates) {
      var sb = SUPA.getClient();
      if (!sb) return false;
      var res = await sb.from('products').update(updates).eq('id', productId);
      return !res.error;
    },

    // ===== DB: حذف منتج =====
    deleteProduct: async function(productId) {
      var sb = SUPA.getClient();
      if (!sb) return false;
      var res = await sb.from('products').delete().eq('id', productId);
      return !res.error;
    },

    // ===== DB: طلبات تاجر =====
    getOrders: async function(sellerId) {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var id = sellerId || (this._user ? this._user.id : null);
      if (!id) return [];
      var res = await sb.from('orders').select('*').eq('seller_id', id).order('created_at', { ascending: false });
      return res.data || [];
    },

    // ===== DB: كل الطلبات =====
    getAllOrders: async function() {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var res = await sb.from('orders').select('*').order('created_at', { ascending: false });
      return res.data || [];
    },

    // ===== DB: تحديث طلب =====
    updateOrder: async function(orderId, updates) {
      var sb = SUPA.getClient();
      if (!sb) return false;
      var res = await sb.from('orders').update(updates).eq('id', orderId);
      return !res.error;
    },

    // ===== DB: إضافة طلب =====
    addOrder: async function(order) {
      var sb = SUPA.getClient();
      if (!sb) return null;
      var res = await sb.from('orders').insert(order).select().single();
      if (res.error) { console.error('addOrder:', res.error); return null; }
      return res.data;
    },

    // ===== DB: سجل حالة الطلب =====
    addOrderHistory: async function(orderId, status, note) {
      var sb = SUPA.getClient();
      if (!sb) return false;
      var res = await sb.from('order_status_history').insert({ order_id: orderId, status: status, note: note || '' });
      return !res.error;
    },

    getOrderHistory: async function(orderId) {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var res = await sb.from('order_status_history').select('*').eq('order_id', orderId).order('created_at', { ascending: true });
      return res.data || [];
    },

    // ===== DB: معاملات تاجر =====
    getTransactions: async function(sellerId) {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var id = sellerId || (this._user ? this._user.id : null);
      if (!id) return [];
      var res = await sb.from('transactions').select('*').eq('seller_id', id).order('created_at', { ascending: false });
      return res.data || [];
    },

    addTransaction: async function(transaction) {
      var sb = SUPA.getClient();
      if (!sb) return null;
      var res = await sb.from('transactions').insert(transaction).select().single();
      return res.data || null;
    },

    // ===== DB: مزايدات =====
    getBids: async function(productId) {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var res = await sb.from('bids').select('*').eq('product_id', productId).order('amount', { ascending: false });
      return res.data || [];
    },

    addBid: async function(bid) {
      var sb = SUPA.getClient();
      if (!sb) return null;
      var res = await sb.from('bids').insert(bid).select().single();
      return res.data || null;
    },

    // ===== DB: مبيعات شهرية =====
    getMonthlySales: async function(sellerId) {
      var sb = SUPA.getClient();
      if (!sb) return [];
      var id = sellerId || (this._user ? this._user.id : null);
      if (!id) return [];
      var res = await sb.from('monthly_sales').select('*').eq('seller_id', id).order('month', { ascending: true });
      return res.data || [];
    },

    // ===== DB: إعدادات الأدمن =====
    getAdminSettings: async function() {
      var sb = SUPA.getClient();
      if (!sb) return {};
      var res = await sb.from('admin_settings').select('*');
      var settings = {};
      if (res.data) { res.data.forEach(function(r) { settings[r.key] = r.value; }); }
      return settings;
    },

    setAdminSetting: async function(key, value) {
      var sb = SUPA.getClient();
      if (!sb) return false;
      var res = await sb.from('admin_settings').upsert({ key: key, value: value });
      return !res.error;
    },

    // ===== تحديث الهيدر =====
    updateHeader: function() {
      var user = this.getCurrentUser();
      var desktopActions = document.querySelector('.header > .container > .header-actions');
      var mobileActions = document.querySelector('.mobile-menu .header-actions');

      if (!desktopActions) return;

      if (user) {
        var initial = user.firstName ? user.firstName.charAt(0) : '?';
        var name = user.firstName || '';

        desktopActions.innerHTML =
          '<div class="user-menu-wrapper">' +
            '<button class="user-menu-btn" onclick="AUTH.toggleUserMenu()">' +
              '<span class="user-avatar-sm">' + initial + '</span>' +
              '<span class="user-name-sm">' + name + '</span>' +
              '<svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button>' +
            '<div class="user-dropdown" id="userDropdown">' +
              '<div class="dropdown-header">' +
                '<span class="dropdown-avatar">' + initial + '</span>' +
                '<div><div class="dropdown-name">' + (user.firstName || '') + ' ' + (user.lastName || '') + '</div>' +
                '<div class="dropdown-email">' + (user.email || '') + '</div></div>' +
              '</div>' +
              '<div class="dropdown-divider"></div>' +
              '<a href="dashboard.html" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg> لوحة التحكم</a>' +
              '<a href="dashboard.html#orders" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> طلباتي</a>' +
              '<a href="dashboard.html#profile" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> حسابي</a>' +
              '<div class="dropdown-divider"></div>' +
              '<a href="#" class="dropdown-item dropdown-logout" onclick="AUTH.logout(); return false;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg> تسجيل الخروج</a>' +
            '</div>' +
          '</div>';

        if (mobileActions) {
          mobileActions.innerHTML =
            '<a href="dashboard.html" class="btn btn-outline">لوحة التحكم</a>' +
            '<a href="#" class="btn btn-filled" onclick="AUTH.logout(); return false;">تسجيل الخروج</a>';
        }
      }
    },

    toggleUserMenu: function() {
      var dd = document.getElementById('userDropdown');
      if (dd) dd.classList.toggle('open');
    }
  };

  // إغلاق القائمة عند النقر خارجها
  document.addEventListener('click', function(e) {
    var dd = document.getElementById('userDropdown');
    var btn = e.target.closest('.user-menu-btn');
    if (dd && !btn && !e.target.closest('.user-dropdown')) {
      dd.classList.remove('open');
    }
  });

  // ===== CSS للهيدر =====
  var style = document.createElement('style');
  style.textContent = '' +
    '.user-menu-wrapper { position: relative; }' +
    '.user-menu-btn { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border: 1.5px solid #E8DDD0; border-radius: 50px; background: transparent; cursor: pointer; font-family: "IBM Plex Sans Arabic", sans-serif; font-size: 0.88rem; color: #2C1810; transition: all 0.3s ease; }' +
    '.user-menu-btn:hover { border-color: #C19A6B; background: #FAF7F2; }' +
    '.user-avatar-sm { width: 30px; height: 30px; border-radius: 50%; background: #C19A6B; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.82rem; flex-shrink: 0; }' +
    '.user-name-sm { font-weight: 600; }' +
    '.user-dropdown { position: absolute; top: calc(100% + 8px); left: 0; min-width: 260px; background: #fff; border: 1px solid #E8DDD0; border-radius: 12px; box-shadow: 0 12px 40px rgba(44,24,16,0.15); opacity: 0; visibility: hidden; transform: translateY(-8px); transition: all 0.25s ease; z-index: 1100; }' +
    '.user-dropdown.open { opacity: 1; visibility: visible; transform: translateY(0); }' +
    '.dropdown-header { display: flex; align-items: center; gap: 12px; padding: 16px; }' +
    '.dropdown-avatar { width: 40px; height: 40px; border-radius: 50%; background: #C19A6B; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; flex-shrink: 0; }' +
    '.dropdown-name { font-weight: 700; font-size: 0.92rem; color: #2C1810; }' +
    '.dropdown-email { font-size: 0.78rem; color: #4A2C1A; opacity: 0.7; margin-top: 2px; }' +
    '.dropdown-divider { height: 1px; background: #E8DDD0; margin: 0; }' +
    '.dropdown-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; text-decoration: none; color: #4A2C1A; font-size: 0.88rem; font-weight: 500; transition: all 0.2s ease; }' +
    '.dropdown-item:hover { background: #FAF7F2; color: #C19A6B; }' +
    '.dropdown-item svg { opacity: 0.6; }' +
    '.dropdown-item:hover svg { opacity: 1; }' +
    '.dropdown-logout { color: #C0392B; }' +
    '.dropdown-logout:hover { background: #FDF2F2; color: #C0392B; }' +
    '@media (max-width: 768px) { .user-name-sm { display: none; } .user-dropdown { left: auto; right: 0; min-width: 240px; } }';
  document.head.appendChild(style);

  // ===== تشغيل تلقائي =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { AUTH._initPromise = AUTH.init(); });
  } else {
    AUTH._initPromise = AUTH.init();
  }

})();
