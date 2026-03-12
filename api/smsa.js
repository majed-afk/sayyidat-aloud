// ===== api/smsa.js — SMSA Express REST Proxy — صيدات العود =====
// Vercel Serverless Function — POST only, JWT verified, server-side data fetch
// Reserve/Commit pattern — no client data for shipments
// Uses SMSA REST API (JSON) — https://track.smsaexpress.com/SecomRestWebApi

var SMSA_REST_BASE = 'https://track.smsaexpress.com/SecomRestWebApi';
var TIMEOUT = 45000;

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

// ===== SMSA REST Client =====
async function smsaRestRequest(method, path, options) {
  options = options || {};
  var url = SMSA_REST_BASE + path;

  // Append query params for GET requests
  if (options.query) {
    var params = Object.keys(options.query)
      .map(function(k) { return encodeURIComponent(k) + '=' + encodeURIComponent(options.query[k]); })
      .join('&');
    url += '?' + params;
  }

  var controller = new AbortController();
  var timer = setTimeout(function() { controller.abort(); }, TIMEOUT);

  try {
    var fetchOptions = {
      method: method,
      signal: controller.signal
    };

    if (method === 'POST' && options.body) {
      fetchOptions.headers = { 'Content-Type': 'application/json' };
      fetchOptions.body = JSON.stringify(options.body);
    }

    var res = await fetch(url, fetchOptions);
    clearTimeout(timer);

    if (!res.ok) {
      return { success: false, error: 'smsa_http_' + res.status };
    }

    // For getPDF — return raw bytes as base64
    if (options.rawResponse) {
      var buffer = await res.arrayBuffer();
      var base64 = Buffer.from(buffer).toString('base64');
      return { success: true, data: base64 };
    }

    // Check content type
    var contentType = res.headers.get('content-type') || '';

    if (contentType.indexOf('application/json') !== -1) {
      var json = await res.json();
      return { success: true, data: json };
    }

    // Plain text response (addship returns AWB string)
    var text = await res.text();
    return { success: true, data: text };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { success: false, error: 'timeout' };
    }
    return { success: false, error: 'network_error' };
  }
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
  // ★ P2 FIX: Re-fetch AWB from DB to avoid stale data race
  if (reserveRes.note === 'already_finalized') {
    var freshOrder = await supabaseQuery(
      'orders?id=eq.' + encodeURIComponent(orderId) + '&select=awb_number',
      { single: true }
    );
    var freshAwb = (freshOrder.data && freshOrder.data.awb_number) || order.awb_number;
    return { status: 200, body: { success: true, awbNumber: freshAwb, note: 'already_done' } };
  }
  // ★ If already reserved (creating), another request is in-flight — prevent double AWB
  if (reserveRes.note === 'already_reserved') {
    return { status: 409, body: { success: false, error: 'يتم إنشاء بوليصة لهذا الطلب حالياً. انتظر قليلاً ثم حاول مجدداً' } };
  }

  // 5. ★ Call SMSA REST addship — NO DB LOCK held
  var passKey = process.env.SMSA_PASS_KEY;
  var shipperName = process.env.SMSA_SHIPPER_NAME || 'صيدات العود';
  var shipperPhone = process.env.SMSA_SHIPPER_PHONE || '';
  var shipperCity = process.env.SMSA_SHIPPER_CITY || 'Riyadh';
  var shipperAddr = process.env.SMSA_SHIPPER_ADDR || '';

  var codAmount = order.payment_method === 'cod' ? (order.total || 0) : 0;

  var shipBody = {
    passkey:      passKey,
    refno:        orderId,
    sentDate:     new Date().toISOString().split('T')[0],
    idNo:         '',
    cName:        normalizeText(order.buyer_name, 60),
    cntry:        'SA',
    cCity:        normalizeText(order.buyer_city, 30),
    cZip:         '',
    cPOBox:       '',
    cMobile:      normalizePhone(order.buyer_phone),
    cTel1:        normalizePhone(order.buyer_phone),
    cTel2:        '',
    cAddr1:       normalizeText(order.buyer_district, 60),
    cAddr2:       normalizeText(order.buyer_street, 60),
    cEmail:       '',
    shipType:     'DLV',
    PCs:          '1',
    carrValue:    '0',
    carrCurr:     'SAR',
    codAmt:       String(codAmount),
    weight:       '1',
    custVal:      '0',
    custCurr:     'SAR',
    insrAmt:      '0',
    insrCurr:     'SAR',
    itemDesc:     normalizeText(order.product_name, 50),
    sName:        shipperName,
    sContact:     shipperName,
    sAddr1:       shipperAddr,
    sAddr2:       '',
    sCity:        shipperCity,
    sPhone:       shipperPhone,
    sCntry:       'SA',
    prefDelvDate: '',
    gpsPoints:    '',
    shortCode:    ''
  };

  var smsaRes = await smsaRestRequest('POST', '/api/addship', { body: shipBody });

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

  // Parse AWB number from REST response (plain string)
  var awbNumber = (typeof smsaRes.data === 'string') ? smsaRes.data.trim() : '';
  // .NET Web API may wrap string responses in quotes
  if (awbNumber.startsWith('"') && awbNumber.endsWith('"')) {
    awbNumber = awbNumber.slice(1, -1);
  }

  // ★ P0 FIX: SMSA returns error messages as plain text with 200 status
  // e.g. "Failed :: Invalid Passkey", "Failed :: Invalid City"
  // Valid AWB is purely numeric (typically 10-15 digits)
  var isValidAwb = awbNumber && awbNumber.length >= 5 && /^\d+$/.test(awbNumber);

  if (!isValidAwb) {
    // SMSA returned invalid/error response — rollback
    var smsaErrDetail = awbNumber || 'empty response';
    await supabaseRpc('rollback_shipping', {
      p_order_id: orderId,
      p_caller_id: callerId
    });
    await logReconcile(orderId, '', 'smsa_addship_invalid: ' + smsaErrDetail);
    // Map known SMSA errors to user-friendly messages
    var userMsg = 'فشل إنشاء البوليصة. تأكد من صحة بيانات العنوان';
    if (awbNumber.toLowerCase().indexOf('passkey') !== -1) {
      userMsg = 'خطأ في إعدادات شركة الشحن. تواصل مع الإدارة';
    } else if (awbNumber.toLowerCase().indexOf('city') !== -1) {
      userMsg = 'المدينة غير صالحة. تأكد من اسم مدينة المستلم';
    } else if (awbNumber.toLowerCase().indexOf('phone') !== -1) {
      userMsg = 'رقم الجوال غير صالح. تأكد من رقم جوال المستلم';
    }
    return { status: 502, body: { success: false, error: userMsg } };
  }

  // 6. ★ COMMIT — creating → finalized + save AWB
  var commitRes = await supabaseRpc('commit_shipping', {
    p_order_id: orderId,
    p_awb: awbNumber,
    p_caller_id: callerId
  });

  if (commitRes.error || commitRes.success === false) {
    // AWB was created but commit failed — ★ move to needs_reconcile state
    try {
      await supabaseQuery(
        'orders?id=eq.' + encodeURIComponent(orderId),
        { method: 'PATCH', body: { shipment_state: 'needs_reconcile' } }
      );
    } catch (e) { /* best-effort */ }
    await logReconcile(orderId, awbNumber, 'commit_failed: ' + (commitRes.error || commitRes.error_msg || 'unknown'));
    // Still return AWB since it was created in SMSA
    return {
      status: 200,
      body: {
        success: true,
        awbNumber: awbNumber,
        shipmentState: 'needs_reconcile',
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

  // Call SMSA REST getPDF (GET with query params, raw byte response)
  var smsaRes = await smsaRestRequest('GET', '/api/getPDF', {
    query: { passKey: process.env.SMSA_PASS_KEY, awbno: awb },
    rawResponse: true
  });

  if (!smsaRes.success) {
    return { status: 502, body: { success: false, error: 'فشل تحميل ملف البوليصة' } };
  }

  // Validate response — a valid PDF base64 is at least 100 chars
  if (!smsaRes.data || smsaRes.data.length < 100) {
    return { status: 502, body: { success: false, error: 'لم يتم العثور على ملف البوليصة' } };
  }

  return { status: 200, body: { success: true, pdfBase64: smsaRes.data } };
}


// ================================================================
// ===== ACTION: cancelShipment (internal only — REST API has no cancel) =====
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

  // ★ Internal cancel only — SMSA REST API does not expose cancel endpoint
  // The cancel_shipping RPC handles: finalized → cancelled + refund + shipping_refund tx

  var cancelRes = await supabaseRpc('cancel_shipping', {
    p_order_id: orderId,
    p_caller_id: callerId
  });

  if (cancelRes.error || cancelRes.success === false) {
    await logReconcile(orderId, orderRes.data.awb_number || '', 'cancel_refund_failed: ' + (cancelRes.error || 'unknown'));
    return { status: 200, body: { success: true, warning: 'تم إلغاء الشحنة لكن حدث خطأ في الاسترجاع. الإدارة ستتابع' } };
  }

  // Log for manual SMSA portal cancellation follow-up
  await logReconcile(orderId, orderRes.data.awb_number || '', 'smsa_manual_cancel_needed');

  return {
    status: 200,
    body: {
      success: true,
      refunded: cancelRes.refunded,
      note: 'يُرجى إلغاء الشحنة يدوياً من بوابة SMSA'
    }
  };
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

  // Call SMSA REST getTracking (GET with query params)
  var smsaRes = await smsaRestRequest('GET', '/api/getTracking', {
    query: { awbNo: awb, passkey: process.env.SMSA_PASS_KEY }
  });

  if (!smsaRes.success) {
    return { status: 502, body: { success: false, error: 'فشل جلب حالة الشحنة' } };
  }

  // Extract status — REST returns JSON object (defensive extraction)
  var trackingData = smsaRes.data;
  var status = 'غير متاح';
  if (trackingData) {
    if (typeof trackingData === 'string') {
      status = trackingData || 'غير متاح';
    } else if (trackingData.Activity) {
      status = trackingData.Activity;
    } else if (trackingData.Status) {
      status = trackingData.Status;
    }
  }

  return { status: 200, body: { success: true, trackingStatus: status } };
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

  // ★ P2 FIX: Check ALL required env vars
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY || !process.env.SUPABASE_ANON_KEY) {
    return res.status(500).json({ success: false, error: 'إعدادات الخادم غير مكتملة' });
  }
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
