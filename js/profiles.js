// ===== profiles.js — وحدة الملفات الشخصية — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.profiles = {

    /**
     * تحويل ملف شخصي من snake_case إلى camelCase
     * مصدر واحد بدل التكرار في _formatUser و getAllUsers
     * @param {object} profile - بيانات البروفايل (snake_case)
     * @param {object} [authUser] - auth user للحصول على الإيميل
     * @returns {object}
     */
    formatUser: function(profile, authUser) {
      if (!profile) return null;
      var p = profile;
      return {
        id: p.id,
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        email: authUser ? (authUser.email || '') : '',
        phone: p.phone || '',
        role: p.role || 'seller',
        merchantVerified: p.merchant_verified || false,
        sellerVerified: p.seller_verified || false,
        verified: (p.merchant_verified || p.seller_verified) || false,
        commercialRegister: p.commercial_register || '',
        completedAuctions: parseInt(p.completed_auctions) || 0,
        suspended: p.suspended || false,
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

    /**
     * تحديث بيانات الملف الشخصي
     * يستخدم camelToSnake بدل 17 if-statement يدوي
     * @param {object} updatedData - بيانات camelCase + id
     * @returns {Promise<boolean>}
     */
    update: async function(updatedData) {
      var sb = U.getSupabase();
      if (!sb) return false;

      try {
        var targetId = updatedData.id || (SAIDAT.auth.getAuthUser() ? SAIDAT.auth.getAuthUser().id : null);
        if (!targetId) return false;

        // تحويل الحقول
        var updateObj = U.camelToSnake(updatedData);
        delete updateObj.id;
        delete updateObj.email;

        if (Object.keys(updateObj).length === 0) return false;

        var res = await sb.from('profiles').update(updateObj).eq('id', targetId);

        if (res.error) {
          console.error('Profile update error:', res.error);
          return false;
        }

        // إعادة تحميل البروفايل إذا كان المستخدم الحالي
        var authUser = SAIDAT.auth.getAuthUser();
        if (authUser && targetId === authUser.id) {
          await SAIDAT.auth.reloadProfile();
        }
        return true;
      } catch(e) {
        console.error('Profile update error:', e);
        return false;
      }
    },

    /**
     * جلب جميع المستخدمين (للأدمن)
     * @returns {Promise<Array>}
     */
    getAll: async function() {
      var sb = U.getSupabase();
      if (!sb) return [];

      try {
        var res = await sb.from('profiles').select('*').order('created_at', { ascending: false });
        if (res.error || !res.data) return [];

        return res.data.map(function(p) {
          return SAIDAT.profiles.formatUser(p, null);
        });
      } catch(e) {
        console.error('getAllUsers error:', e);
        return [];
      }
    },

    /**
     * تعليق مستخدم
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    suspend: async function(userId) {
      var sb = U.getSupabase();
      if (!sb) return false;
      var res = await sb.from('profiles').update({ suspended: true }).eq('id', userId);
      return !res.error;
    }
  };

})();
