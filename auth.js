// ===== auth.js - نظام المصادقة لمنصة صيدات العود =====

(function() {
  'use strict';

  var USERS_KEY = 'saidat_users';
  var SESSION_KEY = 'saidat_session';

  var DATA_VERSION = 'v2_auction';

  // ===== مستخدم تجريبي افتراضي =====
  function initDefaultUsers() {
    // Reset data if version changed (to include auction products)
    if (localStorage.getItem('saidat_data_version') !== DATA_VERSION) {
      localStorage.removeItem(USERS_KEY);
      localStorage.setItem('saidat_data_version', DATA_VERSION);
    }
    var users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
    if (users.length === 0) {
      users.push({
        id: 'u_' + Date.now(),
        firstName: 'ماجد',
        lastName: 'الخضير',
        email: 'test@test.com',
        phone: '+966554165165',
        password: btoa('123456'),
        role: 'seller',
        verified: true,
        createdAt: '2026-01-15',
        storeName: 'متجر ماجد للعود',
        storeDesc: 'متخصصون في أجود أنواع العود الكمبودي والهندي منذ أكثر من 10 سنوات',
        bankName: 'بنك الراجحي',
        iban: 'SA4420000001234567891234',
        bankHolder: 'ماجد عبدالله الخضير',
        balance: 12500,
        totalSales: 45,
        totalRevenue: 38750,
        products: [
          { id: 'p1', name: 'عود كمبودي بورسات فاخر', listingType: 'market', category: 'بخور', type: 'طبيعي', origin: 'كمبودي', weight: 50, unit: 'جرام', price: 285, stock: 12, active: true, image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=300&fit=crop&q=80', description: 'عود كمبودي فاخر من غابات بورسات', createdAt: '2026-01-20' },
          { id: 'p2', name: 'دهن عود هندي أسامي', listingType: 'market', category: 'دهن عود', type: 'بيور', origin: 'هندي', weight: 1, unit: 'تولة', price: 650, stock: 5, active: true, image: 'https://images.unsplash.com/photo-1594035910387-fea081d36b4c?w=400&h=300&fit=crop&q=80', description: 'دهن عود هندي أسامي بيور من ولاية آسام', createdAt: '2026-01-25' },
          { id: 'p3', name: 'بخور لاوسي جبلي', listingType: 'market', category: 'بخور', type: 'طبيعي', origin: 'لاوسي', weight: 30, unit: 'جرام', price: 195, stock: 20, active: true, image: 'https://images.unsplash.com/photo-1595535373192-fc8935bacd89?w=400&h=300&fit=crop&q=80', description: 'بخور لاوسي من المرتفعات الجبلية', createdAt: '2026-02-01' },
          { id: 'p4', name: 'دهن عود فيتنامي خاص', listingType: 'auction', auctionType: 'timed', auctionStatus: 'live', startPrice: 500, minBid: 50, auctionDuration: 7, buyNow: 1200, auctionStartDate: '2026-02-12', auctionEndDate: '2026-02-19', bids: [{bidder:'خالد الحربي',amount:500,date:'2026-02-12T10:00:00'},{bidder:'ناصر القحطاني',amount:550,date:'2026-02-12T14:30:00'},{bidder:'تركي الشمري',amount:650,date:'2026-02-13T09:15:00'},{bidder:'سعود الدوسري',amount:750,date:'2026-02-13T16:45:00'},{bidder:'خالد الحربي',amount:800,date:'2026-02-14T08:20:00'}], category: 'دهن عود', type: 'بيور', origin: 'فيتنامي', weight: 1, unit: 'تولة', price: 800, stock: 1, active: true, image: 'https://images.unsplash.com/photo-1616949755610-8c9c1e378a56?w=400&h=300&fit=crop&q=80', description: 'دهن عود فيتنامي نادر من الدرجة الأولى', createdAt: '2026-02-05' },
          { id: 'p5', name: 'عود ماليزي سوبر', listingType: 'market', category: 'بخور', type: 'محسن', origin: 'ماليزي', weight: 100, unit: 'جرام', price: 150, stock: 30, active: true, image: 'https://images.unsplash.com/photo-1602836831852-ef75b5311391?w=400&h=300&fit=crop&q=80', description: 'عود ماليزي محسن بجودة عالية', createdAt: '2026-02-08' },
          { id: 'p6', name: 'دهن عود بورمي ملكي', listingType: 'auction', auctionType: 'until_sold', auctionStatus: 'live', startPrice: 800, minBid: 100, auctionDuration: 0, buyNow: 0, auctionStartDate: '2026-02-10', auctionEndDate: null, bids: [{bidder:'محمد الزهراني',amount:800,date:'2026-02-10T12:00:00'},{bidder:'عمر السبيعي',amount:900,date:'2026-02-11T10:00:00'},{bidder:'بندر الراشد',amount:1050,date:'2026-02-12T15:30:00'}], category: 'دهن عود', type: 'بيور', origin: 'بورمي', weight: 0.25, unit: 'تولة', price: 1050, stock: 1, active: true, image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=300&fit=crop&q=80', description: 'دهن عود بورمي ملكي نادر', createdAt: '2026-02-10' },
          { id: 'p7', name: 'بخور إندونيسي كلمنتان', listingType: 'market', category: 'بخور', type: 'طبيعي', origin: 'إندونيسي', weight: 50, unit: 'جرام', price: 220, stock: 15, active: true, image: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=400&h=300&fit=crop&q=80', description: 'بخور إندونيسي طبيعي من جزيرة كلمنتان', createdAt: '2026-02-12' },
          { id: 'p8', name: 'دهن عود هندي كلاكاسي', listingType: 'market', category: 'دهن عود', type: 'بيور', origin: 'هندي', weight: 0.25, unit: 'تولة', price: 2100, stock: 1, active: true, image: 'https://images.unsplash.com/photo-1617500603321-a3ee9e934eee?w=400&h=300&fit=crop&q=80', description: 'أعلى مراتب دهن العود الهندي', createdAt: '2026-02-14' }
        ],
        orders: [
          { id: 'SA-847291', productName: 'عود كمبودي بورسات فاخر', productId: 'p1', buyer: 'عبدالرحمن السالم', buyerPhone: '+966551234567', buyerCity: 'الرياض', buyerDistrict: 'النرجس', buyerStreet: 'شارع الأمير سلطان 45', qty: 2, price: 285, total: 570, shipping: 25, status: 'new', date: '2026-02-14', shippingMethod: 'عادي' },
          { id: 'SA-736184', productName: 'دهن عود هندي أسامي', productId: 'p2', buyer: 'فيصل العمري', buyerPhone: '+966559876543', buyerCity: 'جدة', buyerDistrict: 'الحمراء', buyerStreet: 'شارع فلسطين 12', qty: 1, price: 650, total: 650, shipping: 45, status: 'processing', date: '2026-02-13', shippingMethod: 'سريع' },
          { id: 'SA-625073', productName: 'بخور لاوسي جبلي', productId: 'p3', buyer: 'سعود الدوسري', buyerPhone: '+966553216549', buyerCity: 'الدمام', buyerDistrict: 'الشاطئ', buyerStreet: 'شارع الخليج 8', qty: 3, price: 195, total: 585, shipping: 25, status: 'completed', date: '2026-02-12', shippingMethod: 'عادي' },
          { id: 'SA-514962', productName: 'دهن عود فيتنامي خاص', productId: 'p4', buyer: 'خالد الحربي', buyerPhone: '+966557894561', buyerCity: 'مكة', buyerDistrict: 'العزيزية', buyerStreet: 'شارع إبراهيم الخليل 22', qty: 1, price: 890, total: 890, shipping: 75, status: 'completed', date: '2026-02-11', shippingMethod: 'يوم واحد' },
          { id: 'SA-403851', productName: 'عود ماليزي سوبر', productId: 'p5', buyer: 'تركي الشمري', buyerPhone: '+966556547891', buyerCity: 'المدينة', buyerDistrict: 'السلام', buyerStreet: 'شارع أبو بكر 5', qty: 5, price: 150, total: 750, shipping: 25, status: 'completed', date: '2026-02-10', shippingMethod: 'عادي' },
          { id: 'SA-392740', productName: 'بخور إندونيسي كلمنتان', productId: 'p7', buyer: 'ناصر القحطاني', buyerPhone: '+966552345678', buyerCity: 'أبها', buyerDistrict: 'المنسك', buyerStreet: 'شارع الملك فيصل 30', qty: 2, price: 220, total: 440, shipping: 45, status: 'new', date: '2026-02-14', shippingMethod: 'سريع' },
          { id: 'SA-281639', productName: 'دهن عود هندي كلاكاسي', productId: 'p8', buyer: 'محمد الزهراني', buyerPhone: '+966558765432', buyerCity: 'الطائف', buyerDistrict: 'الشهداء', buyerStreet: 'شارع شبرا 15', qty: 1, price: 2100, total: 2100, shipping: 75, status: 'processing', date: '2026-02-13', shippingMethod: 'يوم واحد' }
        ],
        transactions: [
          { id: 't1', type: 'sale', amount: 585, date: '2026-02-12', ref: 'SA-625073', status: 'completed', description: 'بيع: بخور لاوسي جبلي × 3' },
          { id: 't2', type: 'commission', amount: -29.25, date: '2026-02-12', ref: 'SA-625073', status: 'completed', description: 'عمولة المنصة 5%' },
          { id: 't3', type: 'sale', amount: 890, date: '2026-02-11', ref: 'SA-514962', status: 'completed', description: 'بيع: دهن عود فيتنامي خاص × 1' },
          { id: 't4', type: 'commission', amount: -44.50, date: '2026-02-11', ref: 'SA-514962', status: 'completed', description: 'عمولة المنصة 5%' },
          { id: 't5', type: 'sale', amount: 750, date: '2026-02-10', ref: 'SA-403851', status: 'completed', description: 'بيع: عود ماليزي سوبر × 5' },
          { id: 't6', type: 'commission', amount: -37.50, date: '2026-02-10', ref: 'SA-403851', status: 'completed', description: 'عمولة المنصة 5%' },
          { id: 't7', type: 'withdrawal', amount: -5000, date: '2026-02-08', ref: 'W-001', status: 'completed', description: 'سحب إلى بنك الراجحي' },
          { id: 't8', type: 'sale', amount: 1425, date: '2026-02-05', ref: 'SA-192528', status: 'completed', description: 'بيع: عود كمبودي فاخر × 5' },
          { id: 't9', type: 'commission', amount: -71.25, date: '2026-02-05', ref: 'SA-192528', status: 'completed', description: 'عمولة المنصة 5%' },
          { id: 't10', type: 'withdrawal', amount: -3000, date: '2026-01-28', ref: 'W-002', status: 'completed', description: 'سحب إلى بنك الراجحي' }
        ],
        monthlySales: [
          { month: 'سبتمبر', amount: 2800 },
          { month: 'أكتوبر', amount: 4200 },
          { month: 'نوفمبر', amount: 5100 },
          { month: 'ديسمبر', amount: 7800 },
          { month: 'يناير', amount: 9500 },
          { month: 'فبراير', amount: 9350 }
        ]
      });
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
  }

  // ===== AUTH Object =====
  window.AUTH = {

    init: function() {
      initDefaultUsers();
      this.updateHeader();
    },

    // تسجيل مستخدم جديد
    register: function(data) {
      var users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');

      // تحقق من وجود البريد
      var exists = users.some(function(u) { return u.email === data.email; });
      if (exists) {
        return { success: false, message: 'البريد الإلكتروني مسجل مسبقاً' };
      }

      var user = {
        id: 'u_' + Date.now(),
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        password: btoa(data.password),
        role: 'seller',
        verified: false,
        createdAt: new Date().toISOString().split('T')[0],
        storeName: '',
        storeDesc: '',
        bankName: '',
        iban: '',
        bankHolder: '',
        balance: 0,
        totalSales: 0,
        totalRevenue: 0,
        products: [],
        orders: [],
        transactions: [],
        monthlySales: [
          { month: 'سبتمبر', amount: 0 },
          { month: 'أكتوبر', amount: 0 },
          { month: 'نوفمبر', amount: 0 },
          { month: 'ديسمبر', amount: 0 },
          { month: 'يناير', amount: 0 },
          { month: 'فبراير', amount: 0 }
        ]
      };

      users.push(user);
      localStorage.setItem(USERS_KEY, JSON.stringify(users));

      // تسجيل دخول تلقائي
      localStorage.setItem(SESSION_KEY, user.id);

      return { success: true, user: user };
    },

    // تسجيل الدخول
    login: function(email, password) {
      var users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      var user = users.find(function(u) {
        return u.email === email && u.password === btoa(password);
      });

      if (!user) {
        return { success: false, message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' };
      }

      localStorage.setItem(SESSION_KEY, user.id);
      return { success: true, user: user };
    },

    // تسجيل الخروج
    logout: function() {
      localStorage.removeItem(SESSION_KEY);
      window.location.href = 'index.html';
    },

    // المستخدم الحالي
    getCurrentUser: function() {
      var sessionId = localStorage.getItem(SESSION_KEY);
      if (!sessionId) return null;

      var users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      return users.find(function(u) { return u.id === sessionId; }) || null;
    },

    // هل مسجل دخول؟
    isLoggedIn: function() {
      return this.getCurrentUser() !== null;
    },

    // تحديث بيانات المستخدم
    updateUser: function(updatedUser) {
      var users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
      var index = users.findIndex(function(u) { return u.id === updatedUser.id; });
      if (index !== -1) {
        users[index] = updatedUser;
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
        return true;
      }
      return false;
    },

    // ===== تحديث الهيدر =====
    updateHeader: function() {
      var user = this.getCurrentUser();
      // Desktop header actions
      var desktopActions = document.querySelector('.header > .container > .header-actions');
      // Mobile header actions
      var mobileActions = document.querySelector('.mobile-menu .header-actions');

      if (!desktopActions) return;

      if (user) {
        var initial = user.firstName.charAt(0);
        var name = user.firstName;

        // Desktop
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
                '<div><div class="dropdown-name">' + user.firstName + ' ' + user.lastName + '</div>' +
                '<div class="dropdown-email">' + user.email + '</div></div>' +
              '</div>' +
              '<div class="dropdown-divider"></div>' +
              '<a href="dashboard.html" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg> لوحة التحكم</a>' +
              '<a href="dashboard.html#orders" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg> طلباتي</a>' +
              '<a href="dashboard.html#profile" class="dropdown-item"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg> حسابي</a>' +
              '<div class="dropdown-divider"></div>' +
              '<a href="#" class="dropdown-item dropdown-logout" onclick="AUTH.logout(); return false;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg> تسجيل الخروج</a>' +
            '</div>' +
          '</div>';

        // Mobile
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

  // ===== CSS للهيدر المحدث =====
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
    document.addEventListener('DOMContentLoaded', function() { AUTH.init(); });
  } else {
    AUTH.init();
  }

})();
