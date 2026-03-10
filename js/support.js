// ===== support.js — نظام تذاكر الدعم الفني — صيدات العود =====
// يعتمد على: utils.js, auth.js

(function() {
  'use strict';

  var U = SAIDAT.utils;

  var CATEGORY_LABELS = {
    'order_issue': 'مشكلة في الطلب',
    'payment_issue': 'مشكلة في الدفع',
    'product_complaint': 'شكوى منتج',
    'account_issue': 'مشكلة في الحساب',
    'technical_issue': 'مشكلة تقنية',
    'other': 'أخرى'
  };

  var STATUS_LABELS = {
    'open': 'مفتوحة',
    'in_progress': 'قيد المعالجة',
    'resolved': 'تم الحل',
    'closed': 'مغلقة'
  };

  var PRIORITY_LABELS = {
    'low': 'منخفضة',
    'normal': 'عادية',
    'high': 'عالية',
    'urgent': 'عاجلة'
  };

  SAIDAT.support = {

    CATEGORY_LABELS: CATEGORY_LABELS,
    STATUS_LABELS: STATUS_LABELS,
    PRIORITY_LABELS: PRIORITY_LABELS,

    /**
     * توليد رقم تذكرة فريد: TK-XXXXXX
     */
    generateTicketNumber: function() {
      var ts = Date.now().toString(36).toUpperCase();
      var rand = Math.random().toString(36).substring(2, 5).toUpperCase();
      return 'TK-' + ts.slice(-4) + rand;
    },

    /**
     * إنشاء تذكرة جديدة
     * @param {object} ticket - { category, subject, description, order_id? }
     */
    create: async function(ticket) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return null;
      try {
        ticket.user_id = SAIDAT.auth.getAuthUser().id;
        ticket.ticket_number = this.generateTicketNumber();
        var res = await sb.from('support_tickets').insert(ticket).select().single();
        if (res.error) {
          U.log('error', 'support.create error:', res.error.message);
          return null;
        }
        return res.data;
      } catch(e) {
        U.log('error', 'support.create exception:', e);
        return null;
      }
    },

    /**
     * جلب تذاكر المستخدم الحالي
     */
    getForUser: async function() {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return [];
      try {
        var res = await sb
          .from('support_tickets')
          .select('*')
          .eq('user_id', SAIDAT.auth.getAuthUser().id)
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'support.getForUser error:', e);
        return [];
      }
    },

    /**
     * جلب كل التذاكر (أدمن) مع بيانات المستخدم
     */
    getAll: async function() {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('support_tickets')
          .select('*, user:user_id(first_name, last_name, store_name)')
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'support.getAll error:', e);
        return [];
      }
    },

    /**
     * جلب تذكرة واحدة بالمعرف
     */
    getById: async function(ticketId) {
      var sb = U.getSupabase();
      if (!sb) return null;
      try {
        var res = await sb
          .from('support_tickets')
          .select('*, user:user_id(first_name, last_name, store_name)')
          .eq('id', ticketId)
          .single();
        return res.data || null;
      } catch(e) {
        U.log('error', 'support.getById error:', e);
        return null;
      }
    },

    /**
     * جلب رسائل تذكرة
     */
    getMessages: async function(ticketId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('ticket_messages')
          .select('*, sender:sender_id(first_name, last_name, role)')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });
        return res.data || [];
      } catch(e) {
        U.log('error', 'support.getMessages error:', e);
        return [];
      }
    },

    /**
     * إضافة رسالة لتذكرة
     */
    addMessage: async function(ticketId, message, isAdmin) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return null;
      try {
        var res = await sb.from('ticket_messages').insert({
          ticket_id: ticketId,
          sender_id: SAIDAT.auth.getAuthUser().id,
          is_admin: !!isAdmin,
          message: message
        }).select().single();
        if (res.error) {
          U.log('error', 'support.addMessage error:', res.error.message);
          return null;
        }
        // تحديث updated_at للتذكرة
        await sb.from('support_tickets')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', ticketId);
        return res.data;
      } catch(e) {
        U.log('error', 'support.addMessage exception:', e);
        return null;
      }
    },

    /**
     * تحديث حالة التذكرة
     */
    updateStatus: async function(ticketId, status) {
      var sb = U.getSupabase();
      if (!sb) return false;
      try {
        var updates = { status: status };
        if (status === 'resolved' || status === 'closed') {
          updates.resolved_at = new Date().toISOString();
        }
        var res = await sb.from('support_tickets').update(updates).eq('id', ticketId);
        if (res.error) {
          U.log('error', 'support.updateStatus error:', res.error.message);
          return false;
        }
        return true;
      } catch(e) {
        U.log('error', 'support.updateStatus exception:', e);
        return false;
      }
    },

    /**
     * تحديث أولوية التذكرة (أدمن)
     */
    updatePriority: async function(ticketId, priority) {
      var sb = U.getSupabase();
      if (!sb) return false;
      try {
        var res = await sb.from('support_tickets')
          .update({ priority: priority })
          .eq('id', ticketId);
        return !res.error;
      } catch(e) {
        U.log('error', 'support.updatePriority exception:', e);
        return false;
      }
    },

    /**
     * شارة الحالة HTML
     */
    statusBadge: function(status) {
      var colors = {
        'open': { bg: 'rgba(193,154,107,0.12)', color: '#C19A6B', dot: '#C19A6B' },
        'in_progress': { bg: 'rgba(193,122,58,0.12)', color: '#C17A3A', dot: '#C17A3A' },
        'resolved': { bg: 'rgba(74,124,89,0.12)', color: '#4A7C59', dot: '#4A7C59' },
        'closed': { bg: 'rgba(120,120,120,0.12)', color: '#888', dot: '#888' }
      };
      var c = colors[status] || colors['open'];
      var label = STATUS_LABELS[status] || status;
      return '<span class="status" style="background:' + c.bg + ';color:' + c.color + '">' +
             '<span class="status-dot" style="background:' + c.dot + '"></span>' +
             U.escapeHtml(label) + '</span>';
    },

    /**
     * شارة الأولوية HTML
     */
    priorityBadge: function(priority) {
      var colors = {
        'low': { bg: 'rgba(120,120,120,0.12)', color: '#888' },
        'normal': { bg: 'rgba(193,154,107,0.12)', color: '#C19A6B' },
        'high': { bg: 'rgba(193,122,58,0.12)', color: '#C17A3A' },
        'urgent': { bg: 'rgba(181,64,58,0.12)', color: '#B5403A' }
      };
      var c = colors[priority] || colors['normal'];
      var label = PRIORITY_LABELS[priority] || priority;
      return '<span class="status" style="background:' + c.bg + ';color:' + c.color + '">' +
             U.escapeHtml(label) + '</span>';
    },

    /**
     * ترجمة التصنيف
     */
    categoryLabel: function(category) {
      return CATEGORY_LABELS[category] || category;
    }
  };

})();
