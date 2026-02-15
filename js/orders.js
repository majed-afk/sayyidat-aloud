// ===== orders.js — وحدة الطلبات — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.orders = {

    /**
     * جلب طلبات تاجر معين
     * @param {string} [sellerId]
     * @returns {Promise<Array>}
     */
    getForSeller: async function(sellerId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      var id = sellerId || (SAIDAT.auth.getAuthUser() ? SAIDAT.auth.getAuthUser().id : null);
      if (!id) return [];

      try {
        var res = await sb.from('orders').select('*').eq('seller_id', id).order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        console.error('getOrders error:', e);
        return [];
      }
    },

    /**
     * جلب كل الطلبات (للأدمن)
     * @returns {Promise<Array>}
     */
    getAll: async function() {
      var sb = U.getSupabase();
      if (!sb) return [];

      try {
        var res = await sb.from('orders').select('*').order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        console.error('getAllOrders error:', e);
        return [];
      }
    },

    /**
     * إضافة طلب جديد
     * @param {object} order
     * @returns {Promise<object|null>}
     */
    add: async function(order) {
      var sb = U.getSupabase();
      if (!sb) return null;

      try {
        var res = await sb.from('orders').insert(order).select().single();
        if (res.error) {
          console.error('addOrder:', res.error);
          return null;
        }
        return res.data;
      } catch(e) {
        console.error('addOrder error:', e);
        return null;
      }
    },

    /**
     * تحديث طلب
     * @param {string} orderId
     * @param {object} updates
     * @returns {Promise<boolean>}
     */
    update: async function(orderId, updates) {
      var sb = U.getSupabase();
      if (!sb) return false;

      try {
        var res = await sb.from('orders').update(updates).eq('id', orderId);
        return !res.error;
      } catch(e) {
        console.error('updateOrder error:', e);
        return false;
      }
    },

    /**
     * إضافة سجل حالة للطلب
     * @param {string} orderId
     * @param {string} status
     * @param {string} [note]
     * @returns {Promise<boolean>}
     */
    addHistory: async function(orderId, status, note) {
      var sb = U.getSupabase();
      if (!sb) return false;

      try {
        var res = await sb.from('order_status_history').insert({
          order_id: orderId,
          status: status,
          note: note || ''
        });
        return !res.error;
      } catch(e) {
        console.error('addHistory error:', e);
        return false;
      }
    },

    /**
     * جلب سجل حالات الطلب
     * @param {string} orderId
     * @returns {Promise<Array>}
     */
    getHistory: async function(orderId) {
      var sb = U.getSupabase();
      if (!sb) return [];

      try {
        var res = await sb
          .from('order_status_history')
          .select('*')
          .eq('order_id', orderId)
          .order('created_at', { ascending: true });
        return res.data || [];
      } catch(e) {
        console.error('getHistory error:', e);
        return [];
      }
    }
  };

})();
