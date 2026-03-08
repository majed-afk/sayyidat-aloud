// ===== invoice.js — نظام الفواتير — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var esc = U.escapeHtml;
  var CFG = SAIDAT.config;

  SAIDAT.invoice = {

    /**
     * إنشاء رقم فاتورة تسلسلي
     */
    generateNumber: function() {
      var now = new Date();
      var y = now.getFullYear();
      var m = String(now.getMonth() + 1).padStart(2, '0');
      var rand = String(Math.floor(Math.random() * 9000) + 1000);
      return 'INV-' + y + m + '-' + rand;
    },

    /**
     * طباعة الفاتورة — يفتح نافذة طباعة مع HTML الفاتورة
     * @param {object} opts — { orderId, productName, price, shipping, vat, total, buyerName, buyerPhone, buyerCity, buyerStreet, sellerName, sellerStore, date }
     */
    print: function(opts) {
      var invoiceNum = opts.invoiceNumber || this.generateNumber();
      var dateStr = opts.date || new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

      var subtotal = Number(opts.price || 0);
      var shippingCost = Number(opts.shipping || 0);
      var vatRate = CFG.VAT_RATE || 0.15;
      var vatAmount = Number(opts.vat || ((subtotal + shippingCost) * vatRate));
      var total = Number(opts.total || (subtotal + shippingCost + vatAmount));

      var html = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">' +
        '<title>فاتورة ' + esc(invoiceNum) + '</title>' +
        '<style>' +
        '* { margin: 0; padding: 0; box-sizing: border-box; }' +
        'body { font-family: "IBM Plex Sans Arabic", "Segoe UI", sans-serif; padding: 40px; color: #2C1810; background: #fff; font-size: 14px; direction: rtl; }' +
        '.invoice-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #C19A6B; }' +
        '.logo-side h1 { font-size: 24px; color: #C19A6B; margin-bottom: 4px; }' +
        '.logo-side p { color: #666; font-size: 12px; }' +
        '.invoice-meta { text-align: left; }' +
        '.invoice-meta h2 { font-size: 20px; color: #2C1810; margin-bottom: 8px; }' +
        '.invoice-meta p { font-size: 13px; color: #555; margin-bottom: 4px; }' +
        '.parties { display: flex; gap: 40px; margin-bottom: 32px; }' +
        '.party { flex: 1; background: #FAF7F2; padding: 16px; border-radius: 8px; }' +
        '.party h3 { font-size: 14px; color: #C19A6B; margin-bottom: 8px; }' +
        '.party p { font-size: 13px; margin-bottom: 4px; }' +
        'table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }' +
        'th { background: #2C1810; color: #fff; padding: 10px 16px; text-align: right; font-size: 13px; }' +
        'td { padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 13px; }' +
        '.totals { width: 300px; margin-right: auto; }' +
        '.totals tr td { padding: 8px 16px; }' +
        '.totals .total-row { font-weight: 700; font-size: 16px; background: #FAF7F2; border-radius: 8px; }' +
        '.footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; padding-top: 20px; border-top: 1px solid #eee; }' +
        '@media print { body { padding: 20px; } }' +
        '</style></head><body>' +

        '<div class="invoice-header">' +
          '<div class="logo-side"><h1>صيدات العود</h1><p>منصة العود والبخور الأولى</p></div>' +
          '<div class="invoice-meta">' +
            '<h2>فاتورة ضريبية</h2>' +
            '<p><strong>رقم الفاتورة:</strong> ' + esc(invoiceNum) + '</p>' +
            '<p><strong>التاريخ:</strong> ' + esc(dateStr) + '</p>' +
            '<p><strong>رقم الطلب:</strong> ' + esc(opts.orderId || '') + '</p>' +
          '</div>' +
        '</div>' +

        '<div class="parties">' +
          '<div class="party">' +
            '<h3>البائع</h3>' +
            '<p><strong>' + esc(opts.sellerStore || opts.sellerName || '') + '</strong></p>' +
            '<p>' + esc(opts.sellerName || '') + '</p>' +
          '</div>' +
          '<div class="party">' +
            '<h3>المشتري</h3>' +
            '<p><strong>' + esc(opts.buyerName || '') + '</strong></p>' +
            '<p>' + esc(opts.buyerPhone || '') + '</p>' +
            '<p>' + esc(opts.buyerCity || '') + (opts.buyerStreet ? ' — ' + esc(opts.buyerStreet) : '') + '</p>' +
          '</div>' +
        '</div>' +

        '<table>' +
          '<thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th></tr></thead>' +
          '<tbody>' +
            '<tr><td>1</td><td>' + esc(opts.productName || '') + '</td><td>' + esc(String(opts.quantity || 1)) + '</td><td>' + U.formatCurrencyDecimal(subtotal) + '</td></tr>' +
          '</tbody>' +
        '</table>' +

        '<table class="totals">' +
          '<tr><td>المبلغ الفرعي</td><td>' + U.formatCurrencyDecimal(subtotal) + '</td></tr>' +
          '<tr><td>الشحن</td><td>' + U.formatCurrencyDecimal(shippingCost) + '</td></tr>' +
          '<tr><td>ضريبة القيمة المضافة (15%)</td><td>' + U.formatCurrencyDecimal(vatAmount) + '</td></tr>' +
          '<tr class="total-row"><td>الإجمالي</td><td>' + U.formatCurrencyDecimal(total) + '</td></tr>' +
        '</table>' +

        '<div class="footer">' +
          '<p>صيدات العود — منصة سعودية متخصصة في بيع العود والبخور</p>' +
          '<p>الرقم الضريبي: 000000000000000 | رقم السجل: 0000000000</p>' +
        '</div>' +

        '</body></html>';

      var win = window.open('', '_blank', 'width=800,height=600');
      if (win) {
        win.document.write(html);
        win.document.close();
        setTimeout(function() { win.print(); }, 500);
      }
    }
  };

})();
