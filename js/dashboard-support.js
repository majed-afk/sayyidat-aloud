// ===== dashboard-support.js — تذاكر الدعم الفني — صيدات العود =====
// يعتمد على: config.js, utils.js, auth.js, support.js, notifications.js, ui.js
// يصدّر: SAIDAT.dashboard.support

(function() {
  'use strict';

  SAIDAT.dashboard = SAIDAT.dashboard || {};
  SAIDAT.dashboard.state = SAIDAT.dashboard.state || {};

  var U = SAIDAT.utils;

  // حالة محلية
  var allTickets = [];
  var currentTicketFilter = 'all';
  var currentOpenTicketId = null;

  // ===== عرض تذاكر الدعم =====
  async function renderSupportTickets() {
    if (!SAIDAT.support) return;
    try {
      allTickets = await SAIDAT.support.getForUser();
    } catch(e) {
      allTickets = [];
    }
    renderTicketTable();
  }

  function renderTicketTable() {
    var tbody = document.getElementById('supportTicketsBody');
    if (!tbody) return;

    // عدادات
    var counts = { all: allTickets.length, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    allTickets.forEach(function(t) { if (counts[t.status] !== undefined) counts[t.status]++; });
    var ce = function(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; };
    ce('ticketCountAll', counts.all);
    ce('ticketCountOpen', counts.open);
    ce('ticketCountProgress', counts.in_progress);
    ce('ticketCountResolved', counts.resolved);
    ce('ticketCountClosed', counts.closed);

    // فلتر
    var filtered = currentTicketFilter === 'all' ? allTickets :
      allTickets.filter(function(t) { return t.status === currentTicketFilter; });

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:32px;opacity:0.5;">' +
        (allTickets.length === 0 ? 'لا توجد تذاكر دعم بعد' : 'لا توجد تذاكر بهذه الحالة') + '</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(function(t) {
      var date = new Date(t.created_at).toLocaleDateString('ar-SA');
      return '<tr>' +
        '<td><strong>' + U.escapeHtml(t.ticket_number) + '</strong></td>' +
        '<td>' + U.escapeHtml(SAIDAT.support.categoryLabel(t.category)) + '</td>' +
        '<td>' + U.escapeHtml(t.subject) + '</td>' +
        '<td>' + SAIDAT.support.statusBadge(t.status) + '</td>' +
        '<td>' + date + '</td>' +
        '<td><button class="btn btn-outline btn-sm" onclick="openTicketDetail(\'' + t.id + '\')">عرض</button></td>' +
        '</tr>';
    }).join('');
  }

  function filterTickets(filter) {
    currentTicketFilter = filter;
    document.querySelectorAll('#section-support .tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === filter);
    });
    renderTicketTable();
  }

  // ===== إنشاء تذكرة جديدة =====
  function openNewTicketModal() {
    document.getElementById('ticketCategory').value = '';
    document.getElementById('ticketOrderId').value = '';
    document.getElementById('ticketSubject').value = '';
    document.getElementById('ticketDescription').value = '';
    SAIDAT.ui.openModal('newTicketModal');
  }

  function closeNewTicketModal() {
    SAIDAT.ui.closeModal('newTicketModal');
  }

  async function submitNewTicket() {
    var category = document.getElementById('ticketCategory').value;
    var orderId = document.getElementById('ticketOrderId').value.trim();
    var subject = document.getElementById('ticketSubject').value.trim();
    var description = document.getElementById('ticketDescription').value.trim();

    if (!category) { SAIDAT.ui.showToast('اختر تصنيف المشكلة', 'error'); return; }
    if (!subject) { SAIDAT.ui.showToast('أدخل موضوع التذكرة', 'error'); return; }
    if (!description || description.length < 10) { SAIDAT.ui.showToast('اشرح المشكلة بالتفصيل (10 أحرف على الأقل)', 'error'); return; }

    var ticket = { category: category, subject: subject, description: description };
    if (orderId) ticket.order_id = orderId;

    var result = await SAIDAT.support.create(ticket);
    if (result) {
      SAIDAT.ui.showToast('تم إرسال التذكرة بنجاح', 'success');
      closeNewTicketModal();
      await renderSupportTickets();

      // إشعار الأدمن
      try {
        var sb = U.getSupabase();
        if (sb && SAIDAT.notifications) {
          var admins = await sb.rpc('get_admin_ids');
          if (admins.data) {
            admins.data.forEach(function(a) {
              SAIDAT.notifications.create({
                user_id: a,
                type: 'ticket_new',
                title: 'تذكرة دعم جديدة',
                body: result.ticket_number + ' — ' + subject,
                link: 'admin#support'
              });
            });
          }
        }
      } catch(e) { U.log('warn', 'notify admin error:', e); }
    } else {
      SAIDAT.ui.showToast('حدث خطأ أثناء إرسال التذكرة', 'error');
    }
  }

  // ===== تفاصيل التذكرة =====
  async function openTicketDetail(ticketId) {
    currentOpenTicketId = ticketId;
    var ticket = await SAIDAT.support.getById(ticketId);
    var messages = await SAIDAT.support.getMessages(ticketId);
    if (!ticket) { SAIDAT.ui.showToast('تعذّر تحميل التذكرة', 'error'); return; }

    var titleEl = document.getElementById('ticketDetailTitle');
    if (titleEl) titleEl.textContent = 'تذكرة ' + ticket.ticket_number;

    var body = document.getElementById('ticketDetailBody');
    var footer = document.getElementById('ticketDetailFooter');

    // معلومات التذكرة
    var html = '<div class="ticket-info-box">' +
      '<div><strong>الرقم:</strong> ' + U.escapeHtml(ticket.ticket_number) + '</div>' +
      '<div><strong>التصنيف:</strong> ' + U.escapeHtml(SAIDAT.support.categoryLabel(ticket.category)) + '</div>' +
      '<div><strong>الحالة:</strong> ' + SAIDAT.support.statusBadge(ticket.status) + '</div>' +
      '<div><strong>التاريخ:</strong> ' + new Date(ticket.created_at).toLocaleDateString('ar-SA') + '</div>' +
      (ticket.order_id ? '<div style="grid-column:1/-1"><strong>رقم الطلب:</strong> ' + U.escapeHtml(ticket.order_id) + '</div>' : '') +
      '<div style="grid-column:1/-1"><strong>الوصف:</strong> ' + U.escapeHtml(ticket.description) + '</div>' +
      '</div>';

    // سلسلة الرسائل
    if (messages.length > 0) {
      html += '<div class="ticket-thread">';
      messages.forEach(function(m) {
        var isAdmin = m.is_admin;
        var senderName = isAdmin ? 'الدعم الفني' :
          (m.sender ? (m.sender.first_name + ' ' + m.sender.last_name) : 'أنت');
        var time = new Date(m.created_at).toLocaleString('ar-SA');
        html += '<div class="ticket-msg ' + (isAdmin ? 'ticket-msg-admin' : 'ticket-msg-user') + '">' +
          '<div class="ticket-msg-sender">' + U.escapeHtml(senderName) + '</div>' +
          '<div class="ticket-msg-text">' + U.escapeHtml(m.message) + '</div>' +
          '<div class="ticket-msg-time">' + time + '</div>' +
          '</div>';
      });
      html += '</div>';
    } else {
      html += '<p style="text-align:center;opacity:0.5;margin:16px 0;">لا توجد ردود بعد</p>';
    }

    body.innerHTML = html;

    // نموذج الرد
    if (ticket.status === 'open' || ticket.status === 'in_progress') {
      footer.innerHTML = '<div class="ticket-reply-form">' +
        '<textarea class="form-textarea" id="ticketReplyText" rows="2" placeholder="اكتب ردك..."></textarea>' +
        '<button class="btn btn-primary" onclick="submitTicketReply()">إرسال</button>' +
        '</div>';
    } else {
      footer.innerHTML = '<p style="text-align:center;opacity:0.5;">هذه التذكرة مغلقة</p>';
    }

    SAIDAT.ui.openModal('ticketDetailModal');
  }

  async function submitTicketReply() {
    if (!currentOpenTicketId) return;
    var textarea = document.getElementById('ticketReplyText');
    var message = textarea ? textarea.value.trim() : '';
    if (!message) { SAIDAT.ui.showToast('اكتب رسالة الرد', 'error'); return; }

    var result = await SAIDAT.support.addMessage(currentOpenTicketId, message, false);
    if (result) {
      SAIDAT.ui.showToast('تم إرسال الرد', 'success');
      // إشعار الأدمن
      try {
        var ticket = await SAIDAT.support.getById(currentOpenTicketId);
        var sb = U.getSupabase();
        if (sb && SAIDAT.notifications && ticket) {
          var admins = await sb.rpc('get_admin_ids');
          if (admins.data) {
            admins.data.forEach(function(a) {
              SAIDAT.notifications.create({
                user_id: a,
                type: 'ticket_reply',
                title: 'رد جديد على تذكرة',
                body: ticket.ticket_number,
                link: 'admin#support'
              });
            });
          }
        }
      } catch(e) { U.log('warn', 'notify admin reply error:', e); }
      openTicketDetail(currentOpenTicketId);
    } else {
      SAIDAT.ui.showToast('حدث خطأ أثناء إرسال الرد', 'error');
    }
  }

  function closeTicketDetail() {
    SAIDAT.ui.closeModal('ticketDetailModal');
    currentOpenTicketId = null;
  }

  // ===== تصدير عبر namespace =====
  SAIDAT.dashboard.support = {
    render: renderSupportTickets,
    filterTickets: filterTickets,
    openNewTicketModal: openNewTicketModal,
    closeNewTicketModal: closeNewTicketModal,
    submitNewTicket: submitNewTicket,
    openTicketDetail: openTicketDetail,
    submitTicketReply: submitTicketReply,
    closeTicketDetail: closeTicketDetail
  };

  // ===== Compatibility layer — window wrappers لـ inline onclick =====
  window.renderSupportTickets = renderSupportTickets;
  window.filterTickets = filterTickets;
  window.openNewTicketModal = openNewTicketModal;
  window.closeNewTicketModal = closeNewTicketModal;
  window.submitNewTicket = submitNewTicket;
  window.openTicketDetail = openTicketDetail;
  window.submitTicketReply = submitTicketReply;
  window.closeTicketDetail = closeTicketDetail;

})();
