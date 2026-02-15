// ===== utils.js — أدوات مشتركة لمنصة صيدات العود =====

window.SAIDAT = window.SAIDAT || {};

SAIDAT.utils = {

  // ===== الأمان =====

  /**
   * حماية من XSS — تحويل النص لـ HTML آمن
   * @param {string} str
   * @returns {string}
   */
  escapeHtml: function(str) {
    if (str === null || str === undefined) return '';
    var s = String(str);
    var map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return s.replace(/[&<>"']/g, function(c) { return map[c]; });
  },

  /**
   * التحقق من صحة رابط صورة (يجب أن يبدأ بـ https)
   * @param {string} url
   * @returns {boolean}
   */
  isValidImageUrl: function(url) {
    if (!url || typeof url !== 'string') return false;
    return /^https:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url) ||
           /^https:\/\/images\.unsplash\.com\/.+$/i.test(url);
  },

  /**
   * رابط صورة آمن (يرجع الافتراضي لو غير صالح)
   * @param {string} url
   * @returns {string}
   */
  safeImageUrl: function(url) {
    return this.isValidImageUrl(url) ? url : SAIDAT.config.DEFAULT_IMAGE;
  },

  // ===== تنسيق الأرقام =====

  /**
   * تنسيق رقم بصيغة عربية
   * @param {number} n
   * @returns {string}
   */
  formatNumber: function(n) {
    return Number(n || 0).toLocaleString('ar-SA');
  },

  /**
   * تنسيق مبلغ مالي (رقم + ر.س)
   * @param {number} n
   * @returns {string}
   */
  formatCurrency: function(n) {
    return this.formatNumber(n) + ' ر.س';
  },

  /**
   * تنسيق مبلغ مع كسرين عشريين
   * @param {number} n
   * @returns {string}
   */
  formatCurrencyDecimal: function(n) {
    return Number(n || 0).toLocaleString('ar-SA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + ' ر.س';
  },

  // ===== تسميات الحالات =====

  /**
   * HTML شارة حالة الطلب (مع حماية XSS)
   * @param {string} status
   * @returns {string}
   */
  statusLabel: function(status) {
    var safe = this.escapeHtml(status);
    var label = SAIDAT.config.STATUS_LABELS[status] || safe;
    return '<span class="status status-' + safe + '"><span class="status-dot"></span>' + this.escapeHtml(label) + '</span>';
  },

  /**
   * HTML شارة نوع المعاملة (مع حماية XSS)
   * @param {string} type
   * @returns {string}
   */
  typeLabel: function(type) {
    var safe = this.escapeHtml(type);
    var label = SAIDAT.config.TYPE_LABELS[type] || safe;
    return '<span class="status status-' + safe + '">' + this.escapeHtml(label) + '</span>';
  },

  /**
   * HTML شارة نوع القائمة (سوق / مزاد)
   * @param {string} type - 'auction' أو 'market'
   * @returns {string}
   */
  listingBadge: function(type) {
    if (type === 'auction') {
      return '<span class="listing-badge badge-auction"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg> مزاد</span>';
    }
    return '<span class="listing-badge badge-market"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/></svg> سوق</span>';
  },

  // ===== تحويل snake_case ↔ camelCase =====

  /**
   * تحويل كائن من snake_case إلى camelCase
   * يستخدم خريطة الحقول من config.js
   * @param {object} obj - كائن بمفاتيح snake_case
   * @param {object} [extra] - حقول إضافية تُضاف للنتيجة
   * @returns {object}
   */
  snakeToCamel: function(obj, extra) {
    if (!obj) return null;
    var map = SAIDAT.config.FIELD_MAP;
    var reverseMap = {};
    var key;
    for (key in map) {
      if (map.hasOwnProperty(key)) {
        reverseMap[map[key]] = key;
      }
    }
    var result = {};
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        var camelKey = reverseMap[key] || key;
        result[camelKey] = obj[key];
      }
    }
    if (extra) {
      for (key in extra) {
        if (extra.hasOwnProperty(key)) {
          result[key] = extra[key];
        }
      }
    }
    return result;
  },

  /**
   * تحويل كائن من camelCase إلى snake_case
   * يحوّل فقط الحقول الموجودة في خريطة الحقول
   * @param {object} obj - كائن بمفاتيح camelCase
   * @returns {object}
   */
  camelToSnake: function(obj) {
    if (!obj) return {};
    var map = SAIDAT.config.FIELD_MAP;
    var result = {};
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
        var snakeKey = map[key] || key;
        result[snakeKey] = obj[key];
      }
    }
    return result;
  },

  // ===== Supabase helper =====

  /**
   * الحصول على Supabase client مع تحقق
   * @returns {object|null}
   */
  getSupabase: function() {
    var sb = SUPA.getClient();
    if (!sb) {
      console.warn('Supabase غير متوفر');
    }
    return sb;
  },

  // ===== القائمة المتنقلة =====

  /**
   * تهيئة قائمة الجوال
   * @param {string} toggleId - ID زر التبديل
   * @param {string} menuId - ID القائمة
   * @param {string} mode - 'show-active' أو 'open'
   */
  initMobileMenu: function(toggleId, menuId, mode) {
    var toggle = document.getElementById(toggleId);
    var menu = document.getElementById(menuId);
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function() {
      if (mode === 'open') {
        var isOpen = menu.classList.contains('open');
        menu.classList.toggle('open', !isOpen);
        toggle.innerHTML = !isOpen ? '&#10005;' : '&#9776;';
      } else {
        menu.classList.toggle('show');
        requestAnimationFrame(function() {
          requestAnimationFrame(function() {
            menu.classList.toggle('active');
          });
        });
        toggle.textContent = menu.classList.contains('show') ? '\u2715' : '\u2630';
      }
    });

    menu.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        if (mode === 'open') {
          menu.classList.remove('open');
          toggle.innerHTML = '&#9776;';
        } else {
          menu.classList.remove('show', 'active');
          toggle.textContent = '\u2630';
        }
      });
    });
  },

  // ===== أنيميشن التمرير =====

  /**
   * تهيئة أنيميشن الظهور عند التمرير
   * @param {string} selectors - CSS selectors مفصولة بفاصلة
   */
  initScrollAnimations: function(selectors) {
    if (!('IntersectionObserver' in window)) return;

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll(selectors).forEach(function(el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(el);
    });
  },

  /**
   * مراقبة وإظهار البطاقات بتأثير تتابعي
   * @param {string} selector
   * @param {number} delay - تأخير بين كل بطاقة (مللي ثانية)
   */
  observeCardsStaggered: function(selector, delay) {
    var cards = document.querySelectorAll(selector);
    if (!('IntersectionObserver' in window)) {
      cards.forEach(function(card) { card.classList.add('visible'); });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var card = entry.target;
          var cardIndex = Array.from(cards).indexOf(card);
          setTimeout(function() {
            card.classList.add('visible');
          }, cardIndex * (delay || 60));
          observer.unobserve(card);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    cards.forEach(function(card) {
      observer.observe(card);
    });
  },

  // ===== نجوم التقييم =====

  /**
   * إنشاء نص نجوم التقييم
   * @param {number} rating
   * @returns {string}
   */
  starsText: function(rating) {
    var full = Math.floor(rating);
    var half = rating % 1 >= 0.5;
    var stars = '';
    for (var i = 0; i < full; i++) stars += '\u2605';
    if (half) stars += '\u2605';
    for (var j = full + (half ? 1 : 0); j < 5; j++) stars += '\u2606';
    return stars;
  }
};
