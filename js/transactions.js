// ===== transactions.js — وحدة المعاملات المالية — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.transactions = {

    /**
     * جلب معاملات تاجر معين
     * @param {string} [sellerId]
     * @returns {Promise<Array>}
     */
    getForSeller: async function(sellerId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      var id = sellerId || (SAIDAT.auth.getAuthUser() ? SAIDAT.auth.getAuthUser().id : null);
      if (!id) return [];

      try {
        var res = await sb.from('transactions').select('*').eq('seller_id', id).order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        console.error('getTransactions error:', e);
        return [];
      }
    },

    /**
     * إضافة معاملة جديدة
     * @param {object} transaction
     * @returns {Promise<object|null>}
     */
    add: async function(transaction) {
      var sb = U.getSupabase();
      if (!sb) return null;

      try {
        var res = await sb.from('transactions').insert(transaction).select().single();
        return res.data || null;
      } catch(e) {
        console.error('addTransaction error:', e);
        return null;
      }
    },

    /**
     * جلب المبيعات الشهرية
     * @param {string} [sellerId]
     * @returns {Promise<Array>}
     */
    getMonthlySales: async function(sellerId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      var id = sellerId || (SAIDAT.auth.getAuthUser() ? SAIDAT.auth.getAuthUser().id : null);
      if (!id) return [];

      try {
        var res = await sb.from('monthly_sales').select('*').eq('seller_id', id).order('month', { ascending: true });
        return res.data || [];
      } catch(e) {
        console.error('getMonthlySales error:', e);
        return [];
      }
    }
  };

})();
