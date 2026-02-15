// ===== ui.js — عناصر واجهة مشتركة — صيدات العود =====

(function() {
  'use strict';

  SAIDAT.ui = {

    /**
     * إظهار إشعار Toast
     * @param {string} msg - الرسالة
     * @param {string} [type='success'] - 'success' أو 'error'
     */
    showToast: function(msg, type) {
      type = type || 'success';

      // إزالة أي toast سابق
      var old = document.querySelector('.toast');
      if (old) old.remove();

      var toast = document.createElement('div');
      toast.className = 'toast ' + type;
      toast.textContent = msg;
      document.body.appendChild(toast);

      requestAnimationFrame(function() {
        toast.classList.add('show');
      });

      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() { toast.remove(); }, 400);
      }, 3000);
    },

    /**
     * إغلاق Modal
     * @param {string} id - ID الـ overlay
     */
    closeModal: function(id) {
      var overlay = document.getElementById(id);
      if (overlay) overlay.classList.remove('open');
    },

    /**
     * فتح Modal
     * @param {string} id - ID الـ overlay
     */
    openModal: function(id) {
      var overlay = document.getElementById(id);
      if (overlay) overlay.classList.add('open');
    },

    /**
     * تبديل السايدبار (dashboard/admin)
     */
    toggleSidebar: function() {
      var sidebar = document.getElementById('sidebar');
      var overlay = document.getElementById('sidebarOverlay');
      if (sidebar) sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
    },

    /**
     * تبديل الأقسام (بنمط dashboard)
     * @param {string} section - اسم القسم
     * @param {object} [titles] - خريطة أسماء الأقسام { overview: 'لوحة التحكم', ... }
     */
    switchSection: function(section, titles) {
      // إخفاء كل الأقسام
      document.querySelectorAll('.section-panel').forEach(function(p) {
        p.classList.remove('active');
      });

      // إظهار القسم المطلوب
      var target = document.getElementById('section-' + section);
      if (target) target.classList.add('active');

      // تحديث العنوان
      if (titles) {
        var h1 = document.querySelector('.content-header h1');
        if (h1) h1.textContent = titles[section] || section;
      }

      // تحديث القائمة الجانبية
      document.querySelectorAll('.nav-item[data-section]').forEach(function(item) {
        item.classList.toggle('active', item.getAttribute('data-section') === section);
      });

      // إغلاق السايدبار على الجوال
      var sidebar = document.getElementById('sidebar');
      if (sidebar && sidebar.classList.contains('open')) {
        SAIDAT.ui.toggleSidebar();
      }
    }
  };

  // كشف للتوافق العكسي مع onclick handlers
  window.toggleSidebar = SAIDAT.ui.toggleSidebar;

})();
