// ===== api/smsa.js — SMSA Express SOAP Proxy — صيدات العود =====
// Vercel Serverless Function — POST only, JWT verified, server-side data fetch
// Reserve/Commit pattern — no client data for shipments

var SMSA_URL = 'https://track.smsaexpress.com/SECOM/SMSAwebService.asmx';
var SMSA_NS  = 'http://track.smsaexpress.com/secom/';
var TIMEOUT  = 45000;

// ===== XML Escaping (mandatory for all user text) =====
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ===== Input Normalization =====
function normalizePhone(phone) {
  var p = (phone || '').replace(/[^0-9]/g, '');
  if (p.startsWith('966')) p = '0' + p.slice(3);
  if (p.length === 9 && !p.startsWith('0')) p = '0' + p;
  return p;
}

function normalizeText(str, maxLen) {
  return (str || '').trim().substring(0, maxLen || 100);
}

// ===== SOAP Envelope Builder =====
function buildSoapEnvelope(method, bodyXml) {
  return '<?xml version="1.0" encoding="utf-8"?>' +
    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
    'xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
    '<soap:Body>' + bodyXml + '</soap:Body>' +
    '</soap:Envelope>';
}

// ===== SOAP Request =====
async function soapRequest(method, bodyXml) {
  var envelope = buildSoapEnvelope(method, bodyXml);
  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, TIMEOUT);

  try {
    var res = await fetch(SMSA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': SMSA_NS + method
      },
      body: envelope,
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { success: false, error: 'smsa_http_' + res.status };
    }
    var text = await res.text();
    return { success: true, body: text };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { success: false, error: 'timeout' };
    }
    return { success: false, error: 'network_error' };
  }
}

// ===== Parse SOAP Response =====
function extractTag(xml, tag) {
  var re = new RegExp('<' + tag + '>(.*?)</' + tag + '>', 's');
  var m = xml.match(re);
  return m ? m[1] : '';
}

// ===== Supabase Helpers =====
async function verifyJwt(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  var token = authHeader.replace('Bearer ', '');

  try {
    var res = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { 'Authorization': 'Bearer ' + token, 'apikey': process.env.SUPABASE_ANON_KEY }
    });
    if (!res.ok) return null;
    var user = await res.json();
    return user && user.id ? user.id : null;
  } catch (e) {
    return null;
  }
}

async function supabaseQuery(path, options) {
  var url = process.env.SUPABASE_URL + '/rest/v1/' + path;
  var headers = {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  if (options && options.single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  var res = await fetch(url, {
    method: options && options.method ? options.method : 'GET',
    headers: headers,
    body: options && options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) {
    var errText = await res.text();
    return { error: errText };
  }
  var data = await res.json();
  return { data: data };
}

async function supabaseRpc(fnName, params) {
  var url = process.env.SUPABASE_URL + '/rest/v1/rpc/' + fnName;
  var res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(params)
  });
  if (!res.ok) {
    var errText = await res.text();
    return { error: errText };
  }
  var data = await res.json();
  return data;
}

// ===== Reconcile Logger =====
async function logReconcile(orderId, awb, reason) {
  try {
    await supabaseQuery('shipment_reconcile_log', {
      method: 'POST',
      body: { order_id: orderId, awb_number: awb || '', failure_reason: reason }
    });
  } catch (e) {
    // silent — best-effort logging
  }
}


// ================================================================
// ===== ACTION: createShipment — Reserve/Call/Commit Pattern =====
// ================================================================
async function handleCreateShipment(callerId, body) {
  var orderId = body.orderId;
  if (!orderId || typeof orderId !== 'string') {
    return { status: 400, body: { success: false, error: 'معرّف الطلب مطلوب' } };
  }

  // 1. Fetch order server-side
  var orderRes = await supabaseQuery(
    'orders?id=eq.' + encodeURIComponent(orderId) + '&select=*',
    { single: true }
  );
  if (orderRes.error || !orderRes.data) {
    return { status: 404, body: { success: false, error: 'الطلب غير موجود' } };
  }
  var order = orderRes.data;

  // 2. Validate ownership + status
  if (order.seller_id !== callerId) {
    return { status: 403, body: { success: false, error: 'ليس لديك صلاحية على هذا الطلب' } };
  }
  if (order.status !== 'processing') {
    return { status: 400, body: { success: false, error: 'الطلب ليس في حالة المعالجة' } };
  }

  // 3. Fetch shipping cost from admin_settings
  var costRes = await supabaseQuery(
    'admin_settings?key=eq.shipping_standard&select=value',
    { single: true }
  );
  var shippingCost = 25; // default
  if (costRes.data && costRes.data.value) {
    shippingCost = parseFloat(costRes.data.value) || 25;
  }

  // 4. ★ RESERVE — deduct balance + set state to 'creating' (quick lock)
  var reserveRes = await supabaseRpc('reserve_shipping', {
    p_order_id: orderId,
    p_cost: shippingCost,
    p_caller_id: callerId
  });
  if (reserveRes.error) {
    return { status: 500, body: { success: false, error: 'خطأ في حجز تكلفة الشحن' } };
  }
  if (reserveRes.success === false) {
    var errorMap = {
      'not_found': 'الطلب غير موجود',
      'not_owner': 'ليس لديك صلاحية',
      'invalid_status': 'حالة الطلب غير صالحة',
      'invalid_state': 'حالة الشحن غير صالحة',
      'insufficient_balance': 'رصيدك غير كافٍ لتغطية تكلفة الشحن'
    };
    return { status: 400, body: { success: false, error: errorMap[reserveRes.error] || 'خطأ في الحجز' } };
  }
  // If already finalized, return success immediately
  if (reserveRes.note === 'already_finalized') {
    return { status: 200, body: { success: true, awbNumber: order.awb_number, note: 'already_done' } };
  }

  // 5. ★ Call SMSA addShip — NO DB LOCK held
  var passKey = process.env.SMSA_PASS_KEY;
  var shipperName = process.env.SMSA_SHIPPER_NAME || 'صيدات العود';
  var shipperPhone = process.env.SMSA_SHIPPER_PHONE || '';
  var shipperCity = process.env.SMSA_SHIPPER_CITY || 'Riyadh';
  var shipperAddr = process.env.SMSA_SHIPPER_ADDR || '';

  var codAmount = order.payment_method === 'cod' ? (order.total || 0) : 0;

  var addShipXml =
    '<addShip xmlns="' + SMSA_NS + '">' +
    '<passKey>' + escapeXml(passKey) + '</passKey>' +
    '<refNo>' + escapeXml(orderId) + '</refNo>' +
    '<sentDate>' + new Date().toISOString().split('T')[0] + '</sentDate>' +
    '<idNo></idNo>' +
    '<cName>' + escapeXml(normalizeText(order.buyer_name, 60)) + '</cName>' +
    '<cntry>SA</cntry>' +
    '<cCity>' + escapeXml(normalizeText(order.buyer_city, 30)) + '</cCity>' +
    '<cZip></cZip>' +
    '<cPOBox></cPOBox>' +
    '<cMobile>' + escapeXml(normalizePhone(order.buyer_phone)) + '</cMobile>' +
    '<cTel1>' + escapeXml(normalizePhone(order.buyer_phone)) + '</cTel1>' +
    '<cTel2></cTel2>' +
    '<cAddr1>' + escapeXml(normalizeText(order.buyer_district, 60)) + '</cAddr1>' +
    '<cAddr2>' + escapeXml(normalizeText(order.buyer_street, 60)) + '</cAddr2>' +
    '<shipType>DLV</shipType>' +
    '<PCs>1</PCs>' +
    '<cEmail></cEmail>' +
    '<carrValue>0</carrValue>' +
    '<carrCurr>SAR</carrCurr>' +
    '<codAmt>' + codAmount + '</codAmt>' +
    '<weight>1</weight>' +
    '<custVal>0</custVal>' +
    '<custCurr>SAR</custCurr>' +
    '<insrAmt>0</insrAmt>' +
    '<insrCurr>SAR</insrCurr>' +
    '<itemDesc>' + escapeXml(normalizeText(order.product_name, 50)) + '</itemDesc>' +
    '<sName>' + escapeXml(shipperName) + '</sName>' +
    '<sContact>' + escapeXml(shipperName) + '</sContact>' +
    '<sAddr1>' + escapeXml(shipperAddr) + '</sAddr1>' +
    '<sAddr2></sAddr2>' +
    '<sCity>' + escapeXml(shipperCity) + '</sCity>' +
    '<sPhone>' + escapeXml(shipperPhone) + '</sPhone>' +
    '<sCntry>SA</sCntry>' +
    '<prefDelvDate></prefDelvDate>' +
    '<gpsPoints></gpsPoints>' +
    '<ShortCode></ShortCode>' +
    '</addShip>';

  var smsaRes = await soapRequest('addShip', addShipXml);

  if (!smsaRes.success) {
    // ★ ROLLBACK — SMSA failed, refund balance
    await supabaseRpc('rollback_shipping', {
      p_order_id: orderId,
      p_caller_id: callerId
    });
    var errMsg = smsaRes.error === 'timeout'
      ? 'انتهى الوقت أثناء الاتصال بسمسا. حاول مرة أخرى'
      : 'خدمة SMSA غير متاحة حالياً. استخدم الخيار اليدوي';
    return { status: 502, body: { success: false, error: errMsg } };
  }

  // Parse AWB number
  var awbNumber = extractTag(smsaRes.body, 'addShipResult');
  if (!awbNumber || awbNumber.length < 5) {
    // SMSA returned invalid/empty AWB — rollback
    await supabaseRpc('rollback_shipping', {
      p_order_id: orderId,
      p_caller_id: callerId
    });
    return { status: 502, body: { success: false, error: 'فشل إنشاء البوليصة. تأكد من صحة بيانات العنوان' } };
  }

  // 6. ★ COMMIT — creating → finalized + save AWB
  var commitRes = await supabaseRpc('commit_shipping', {
    p_order_id: orderId,
    p_awb: awbNumber,
    p_caller_id: callerId
  });

  if (commitRes.error || commitRes.success === false) {
    // AWB was created but commit failed — needs_reconcile
    await logReconcile(orderId, awbNumber, 'commit_failed: ' + (commitRes.error || commitRes.error_msg || 'unknown'));
    // Still return AWB since it was created in SMSA
    return {
      status: 200,
      body: {
        success: true,
        awbNumber: awbNumber,
        warning: 'تم إنشاء البوليصة لكن حدث خطأ في التحديث. الإدارة ستتابع'
      }
    };
  }

  return { status: 200, body: { success: true, awbNumber: awbNumber } };
}


// ================================================================
// ===== ACTION: getPDF =====
// ================================================================
async function handleGetPDF(callerId, body) {
  var orderId = body.orderId;
  if (!orderId) {
    return { status: 400, body: { success: false, error: 'معرّف الطلب مطلوب' } };
  }

  // Fetch order — verify ownership
  var orderRes = await supabaseQuery(
    'orders?id=eq.' + encodeURIComponent(orderId) + '&select=seller_id,awb_number',
    { single: true }
  );
  if (orderRes.error || !orderRes.data) {
    return { status: 404, body: { success: false, error: 'الطلب غير موجود' } };
  }
  if (orderRes.data.seller_id !== callerId) {
    return { status: 403, body: { success: false, error: 'ليس لديك صلاحية' } };
  }
  var awb = orderRes.data.awb_number;
  if (!awb) {
    return { status: 400, body: { success: false, error: 'لا توجد بوليصة لهذا الطلب' } };
  }

  // Call SMSA getPDF
  var pdfXml =
    '<getPDF xmlns="' + SMSA_NS + '">' +
    '<awbNo>' + escapeXml(awb) + '</awbNo>' +
    '<passKey>' + escapeXml(process.env.SMSA_PASS_KEY) + '</passKey>' +
    '</getPDF>';

  var smsaRes = await soapRequest('getPDF', pdfXml);
  if (!smsaRes.success) {
    return { status: 502, body: { success: false, error: 'فشل تحميل ملف البوليصة' } };
  }

  var pdfBase64 = extractTag(smsaRes.body, 'getPDFResult');
  if (!pdfBase64) {
    return { status: 502, body: { success: false, error: 'لم يتم العثور على ملف البوليصة' } };
  }

  return { status: 200, body: { success: true, pdfBase64: pdfBase64 } };
}


// ================================================================
// ===== ACTION: cancelShipment =====
// ================================================================
async function handleCancelShipment(callerId, body) {
  var orderId = body.orderId;
  if (!orderId) {
    return { status: 400, body: { success: false, error: 'معرّف الطلب مطلوب' } };
  }

  // Fetch order
  var orderRes = await supabaseQuery(
    'orders?id=eq.' + encodeURIComponent(orderId) + '&select=seller_id,awb_number,shipment_state',
    { single: true }
  );
  if (orderRes.error || !orderRes.data) {
    return { status: 404, body: { success: false, error: 'الطلب غير موجود' } };
  }
  if (orderRes.data.seller_id !== callerId) {
    return { status: 403, body: { success: false, error: 'ليس لديك صلاحية' } };
  }
  if (orderRes.data.shipment_state !== 'finalized') {
    return { status: 400, body: { success: false, error: 'لا يمكن إلغاء شحنة غير مؤكدة' } };
  }
  var awb = orderRes.data.awb_number;

  // Call SMSA cancelShipment
  var cancelXml =
    '<cancelShipment xmlns="' + SMSA_NS + '">' +
    '<awbNo>' + escapeXml(awb) + '</awbNo>' +
    '<passkey>' + escapeXml(process.env.SMSA_PASS_KEY) + '</passkey>' +
    '<reas>Seller cancelled</reas>' +
    '</cancelShipment>';

  var smsaRes = await soapRequest('cancelShipment', cancelXml);
  if (!smsaRes.success) {
    return { status: 502, body: { success: false, error: 'فشل إلغاء الشحنة في SMSA' } };
  }

  // RPC cancel_shipping — finalized → cancelled + refund
  var cancelRes = await supabaseRpc('cancel_shipping', {
    p_order_id: orderId,
    p_caller_id: callerId
  });

  if (cancelRes.error || cancelRes.success === false) {
    await logReconcile(orderId, awb, 'cancel_refund_failed: ' + (cancelRes.error || 'unknown'));
    return { status: 200, body: { success: true, warning: 'تم إلغاء الشحنة لكن حدث خطأ في الاسترجاع. الإدارة ستتابع' } };
  }

  return { status: 200, body: { success: true, refunded: cancelRes.refunded } };
}


// ================================================================
// ===== ACTION: getTracking =====
// ================================================================
async function handleGetTracking(callerId, body) {
  var orderId = body.orderId;
  if (!orderId) {
    return { status: 400, body: { success: false, error: 'معرّف الطلب مطلوب' } };
  }

  var orderRes = await supabaseQuery(
    'orders?id=eq.' + encodeURIComponent(orderId) + '&select=seller_id,awb_number',
    { single: true }
  );
  if (orderRes.error || !orderRes.data) {
    return { status: 404, body: { success: false, error: 'الطلب غير موجود' } };
  }
  if (orderRes.data.seller_id !== callerId) {
    return { status: 403, body: { success: false, error: 'ليس لديك صلاحية' } };
  }
  var awb = orderRes.data.awb_number;
  if (!awb) {
    return { status: 400, body: { success: false, error: 'لا توجد بوليصة' } };
  }

  var statusXml =
    '<getStatus xmlns="' + SMSA_NS + '">' +
    '<awbNo>' + escapeXml(awb) + '</awbNo>' +
    '<passkey>' + escapeXml(process.env.SMSA_PASS_KEY) + '</passkey>' +
    '</getStatus>';

  var smsaRes = await soapRequest('getStatus', statusXml);
  if (!smsaRes.success) {
    return { status: 502, body: { success: false, error: 'فشل جلب حالة الشحنة' } };
  }

  var status = extractTag(smsaRes.body, 'getStatusResult');
  return { status: 200, body: { success: true, trackingStatus: status || 'غير متاح' } };
}


// ================================================================
// ===== MAIN HANDLER =====
// ================================================================
module.exports = async function handler(req, res) {
  // Security headers
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  // POST only
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Verify JWT
  var callerId = await verifyJwt(req.headers.authorization);
  if (!callerId) {
    return res.status(401).json({ success: false, error: 'غير مصرّح' });
  }

  // Parse body
  var body = req.body;
  if (!body || !body.action) {
    return res.status(400).json({ success: false, error: 'action مطلوب' });
  }

  // Validate action
  var validActions = ['createShipment', 'getPDF', 'cancelShipment', 'getTracking'];
  if (validActions.indexOf(body.action) === -1) {
    return res.status(400).json({ success: false, error: 'action غير صالح' });
  }

  // Check env vars
  if (!process.env.SMSA_PASS_KEY) {
    return res.status(500).json({ success: false, error: 'خدمة الشحن غير مُعدّة' });
  }

  try {
    var result;
    switch (body.action) {
      case 'createShipment':
        result = await handleCreateShipment(callerId, body);
        break;
      case 'getPDF':
        result = await handleGetPDF(callerId, body);
        break;
      case 'cancelShipment':
        result = await handleCancelShipment(callerId, body);
        break;
      case 'getTracking':
        result = await handleGetTracking(callerId, body);
        break;
    }
    return res.status(result.status).json(result.body);
  } catch (e) {
    // ★ Never return raw errors
    return res.status(500).json({ success: false, error: 'حدث خطأ غير متوقع. حاول مرة أخرى' });
  }
};
