// ===== admin-api.js — دوال الأدمن — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.admin = {

    /**
     * جلب المزايدات لمنتج معين
     * @param {string} productId
     * @returns {Promise<Array>}
     */
    getBids: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return [];

      try {
        var res = await sb.from('bids').select('*').eq('product_id', productId).order('amount', { ascending: false });
        return res.data || [];
      } catch(e) {
        console.error('getBids error:', e);
        return [];
      }
    },

    /**
     * إضافة مزايدة
     * @param {object} bid
     * @returns {Promise<object|null>}
     */
    addBid: async function(bid) {
      var sb = U.getSupabase();
      if (!sb) return null;

      try {
        var res = await sb.from('bids').insert(bid).select().single();
        return res.data || null;
      } catch(e) {
        console.error('addBid error:', e);
        return null;
      }
    },

    /**
     * جلب إعدادات الأدمن
     * @returns {Promise<object>}
     */
    getSettings: async function() {
      var sb = U.getSupabase();
      if (!sb) return {};

      try {
        var res = await sb.from('admin_settings').select('*');
        var settings = {};
        if (res.data) {
          res.data.forEach(function(r) { settings[r.key] = r.value; });
        }
        return settings;
      } catch(e) {
        console.error('getSettings error:', e);
        return {};
      }
    },

    /**
     * تعيين إعداد أدمن
     * @param {string} key
     * @param {*} value
     * @returns {Promise<boolean>}
     */
    setSetting: async function(key, value) {
      var sb = U.getSupabase();
      if (!sb) return false;

      try {
        var res = await sb.from('admin_settings').upsert({ key: key, value: value });
        return !res.error;
      } catch(e) {
        console.error('setSetting error:', e);
        return false;
      }
    }
  };

})();
