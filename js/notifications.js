// ===== notifications.js — نظام الإشعارات — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.notifications = {

    /**
     * جلب الإشعارات غير المقروءة (آخر 20)
     */
    getUnread: async function() {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return [];
      try {
        var res = await sb
          .from('notifications')
          .select('*')
          .eq('user_id', SAIDAT.auth.getAuthUser().id)
          .eq('is_read', false)
          .order('created_at', { ascending: false })
          .limit(20);
        return res.data || [];
      } catch(e) {
        U.log('error', 'notifications.getUnread error:', e);
        return [];
      }
    },

    /**
     * جلب كل الإشعارات (مع حد)
     */
    getAll: async function(limit) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return [];
      try {
        var res = await sb
          .from('notifications')
          .select('*')
          .eq('user_id', SAIDAT.auth.getAuthUser().id)
          .order('created_at', { ascending: false })
          .limit(limit || 50);
        return res.data || [];
      } catch(e) {
        U.log('error', 'notifications.getAll error:', e);
        return [];
      }
    },

    /**
     * عدد غير المقروءة
     */
    getUnreadCount: async function() {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return 0;
      try {
        var res = await sb
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', SAIDAT.auth.getAuthUser().id)
          .eq('is_read', false);
        return res.count || 0;
      } catch(e) {
        U.log('error', 'notifications.getUnreadCount error:', e);
        return 0;
      }
    },

    /**
     * تحديد إشعار كمقروء
     */
    markRead: async function(id) {
      var sb = U.getSupabase();
      if (!sb) return false;
      try {
        await sb.from('notifications').update({ is_read: true }).eq('id', id);
        return true;
      } catch(e) {
        U.log('error', 'notifications.markRead error:', e);
        return false;
      }
    },

    /**
     * تحديد الكل كمقروء
     */
    markAllRead: async function() {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return false;
      try {
        await sb
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', SAIDAT.auth.getAuthUser().id)
          .eq('is_read', false);
        return true;
      } catch(e) {
        U.log('error', 'notifications.markAllRead error:', e);
        return false;
      }
    },

    /**
     * إنشاء إشعار جديد
     * @param {object} notif - { user_id, type, title, body, link }
     */
    create: async function(notif) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return null;
      try {
        var res = await sb.from('notifications').insert(notif).select().single();
        if (res.error) {
          U.log('error', 'notifications.create DB error:', res.error.message);
          return null;
        }
        return res.data;
      } catch(e) {
        U.log('error', 'notifications.create error:', e);
        return null;
      }
    },

    /**
     * حذف إشعار
     */
    remove: async function(id) {
      var sb = U.getSupabase();
      if (!sb) return false;
      try {
        await sb.from('notifications').delete().eq('id', id);
        return true;
      } catch(e) {
        U.log('error', 'notifications.remove error:', e);
        return false;
      }
    }
  };

})();
