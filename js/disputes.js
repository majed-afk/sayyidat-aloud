// ===== disputes.js — نظام النزاعات — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.disputes = {

    /**
     * إنشاء نزاع جديد
     * @param {object} dispute - { order_id, buyer_id, seller_id, reason }
     */
    create: async function(dispute) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return null;
      try {
        dispute.buyer_id = SAIDAT.auth.getAuthUser().id;
        var res = await sb.from('disputes').insert(dispute).select().single();
        if (res.error) {
          U.log('error', 'disputes.create DB error:', res.error.message);
          return null;
        }
        return res.data;
      } catch(e) {
        U.log('error', 'disputes.create error:', e);
        return null;
      }
    },

    /**
     * جلب نزاع لطلب معين
     */
    getForOrder: async function(orderId) {
      var sb = U.getSupabase();
      if (!sb) return null;
      try {
        var res = await sb
          .from('disputes')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle();
        return res.data || null;
      } catch(e) {
        U.log('error', 'disputes.getForOrder error:', e);
        return null;
      }
    },

    /**
     * جلب نزاعات المستخدم (بائع أو مشتري)
     */
    getForUser: async function() {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return [];
      var uid = SAIDAT.auth.getAuthUser().id;
      try {
        var res = await sb
          .from('disputes')
          .select('*, orders:order_id(order_id, product_name, total)')
          .or('buyer_id.eq.' + uid + ',seller_id.eq.' + uid)
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'disputes.getForUser error:', e);
        return [];
      }
    },

    /**
     * جلب كل النزاعات (أدمن)
     */
    getAll: async function() {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('disputes')
          .select('*, orders:order_id(order_id, product_name, total), buyer:buyer_id(first_name, last_name), seller:seller_id(first_name, last_name, store_name)')
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'disputes.getAll error:', e);
        return [];
      }
    },

    /**
     * حل نزاع (أدمن)
     * @param {string} id
     * @param {string} status - 'resolved' | 'rejected'
     * @param {string} resolution
     * @param {string} adminNotes
     */
    resolve: async function(id, status, resolution, adminNotes) {
      var sb = U.getSupabase();
      if (!sb) return false;
      try {
        var res = await sb
          .from('disputes')
          .update({
            status: status,
            resolution: resolution || '',
            admin_notes: adminNotes || '',
            resolved_at: new Date().toISOString()
          })
          .eq('id', id);
        if (res.error) {
          U.log('error', 'disputes.resolve DB error:', res.error.message);
          return false;
        }
        return true;
      } catch(e) {
        U.log('error', 'disputes.resolve error:', e);
        return false;
      }
    }
  };

})();
