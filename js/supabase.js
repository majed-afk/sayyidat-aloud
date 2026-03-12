// ===== Supabase Configuration — صيدات العود =====
// هذا الملف يربط الموقع بقاعدة بيانات Supabase

(function() {
  'use strict';

  var SUPABASE_URL = 'https://sgszrpfbetxkgtbnnzsw.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_7-iiMD7Ra3L9QCQ1oaJVow_dPVyH6v5';

  // Initialize Supabase client
  var _supabase = null;

  function getClient() {
    if (!_supabase) {
      if (typeof window.supabase === 'undefined' || !window.supabase.createClient) {
        if (typeof console !== 'undefined') console.warn('[SAIDAT] Supabase SDK not loaded');
        return null;
      }
      _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          // تعطيل Navigator.LockManager — يسبب timeout/deadlock عند فتح تابات متعددة
          // بدل استخدام navigator.locks.request → ننفّذ الدالة مباشرة بدون lock
          lock: function(name, acquireTimeout, fn) {
            return fn();
          },
          // حفظ الجلسة في localStorage
          persistSession: true,
          detectSessionInUrl: true
        }
      });
    }
    return _supabase;
  }

  // ===== Expose globally =====
  // ★ F-08 FIX: لا نكشف url/key على window — فقط getClient
  window.SUPA = {
    getClient: getClient
  };

})();
