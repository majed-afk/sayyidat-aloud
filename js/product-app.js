// ===== product-app.js — صفحة شراء المنتج + المزاد — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var esc = U.escapeHtml;
  var CFG = SAIDAT.config;

  // ===== HARDCODED FALLBACK DATA =====
  var fallbackProducts = [
    { id: 1, name: 'عود كمبودي بورسات فاخر', category: 'بخور', type: 'طبيعي', origin: 'كمبودي', weight: 50, unit: 'جرام', price: 285, rating: 4.8, seller: 'محمد العتيبي', verified: true, image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&h=500&fit=crop&q=80', description: 'عود كمبودي فاخر من غابات بورسات.' },
    { id: 2, name: 'دهن عود هندي أسامي', category: 'دهن عود', type: 'بيور', origin: 'هندي', weight: 1, unit: 'تولة', price: 650, rating: 4.9, seller: 'عبدالله الشمري', verified: true, image: 'https://images.unsplash.com/photo-1594035910387-fea081d36b4c?w=600&h=500&fit=crop&q=80', description: 'دهن عود هندي أسامي بيور.' },
    { id: 3, name: 'بخور لاوسي جبلي', category: 'بخور', type: 'طبيعي', origin: 'لاوسي', weight: 30, unit: 'جرام', price: 195, rating: 4.7, seller: 'خالد الدوسري', verified: false, image: 'https://images.unsplash.com/photo-1595535373192-fc8935bacd89?w=600&h=500&fit=crop&q=80', description: 'بخور لاوسي من مرتفعات لاوس الجبلية.' }
  ];

  // ===== STATE =====
  var currentStep = 1;
  var quantity = 1;
  var shippingCost = CFG.SHIPPING.STANDARD;
  var selectedPayment = 'card';
  var product = null;

  // Auction state
  var _isAuction = false;
  var _pollTimer = null;
  var _countdownTimer = null;
  var _currentHighBid = 0;
  var _bidCount = 0;
  var _auctionEnded = false;
  var _rawProduct = null; // raw DB row for auction fields

  // ===== NORMALIZE SUPABASE ROW =====
  function normalizeProduct(row) {
    if (row.seller && typeof row.seller === 'string') return row;

    var profile = row.profiles || {};
    var sellerName = profile.store_name || ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || 'تاجر';

    return {
      id: row.id,
      name: row.name || '',
      category: row.category || '',
      type: row.type || '',
      origin: row.origin || '',
      weight: row.weight || 0,
      unit: row.unit || '',
      price: row.price || 0,
      rating: row.rating || 0,
      seller: sellerName,
      sellerId: row.seller_id || '',
      verified: profile.verified || false,
      image: row.image_url || row.image || CFG.DEFAULT_IMAGE,
      description: row.description || '',
      // Auction fields
      listingType: row.listing_type || 'fixed',
      startPrice: row.start_price || 0,
      minBid: row.min_bid || CFG.AUCTION.MIN_BID_DEFAULT,
      auctionType: row.auction_type || 'timed',
      auctionEndDate: row.auction_end_date || null,
      auctionStartDate: row.auction_start_date || null,
      auctionStatus: row.auction_status || 'draft',
      buyNow: row.buy_now || 0,
      sellerPhone: profile.phone || '',
      // New auction feature fields
      autoExtend: row.auto_extend || false,
      winnerId: row.winner_id || null,
      cancelReason: row.cancel_reason || '',
      cancelledBy: row.cancelled_by || ''
    };
  }

  // ===== INIT =====
  async function init() {
    var params = new URLSearchParams(window.location.search);
    var id = params.get('id');

    // Try Supabase first
    try {
      if (id && SAIDAT.products && typeof SAIDAT.products.getOne === 'function') {
        var data = await SAIDAT.products.getOne(id);
        if (data) {
          // حماية: منع عرض منتج غير معتمد
          if (data.approval_status && data.approval_status !== 'approved') {
            var main = document.querySelector('.product-main') || document.querySelector('main');
            if (main) {
              main.innerHTML = '<div style="text-align:center;padding:80px 20px;">' +
                '<div style="font-size:3rem;margin-bottom:16px">\u26A0\uFE0F</div>' +
                '<h2 style="color:#2C1810;margin-bottom:8px">هذا المنتج غير متاح حالياً</h2>' +
                '<p style="color:#4A2C1A;opacity:0.7">المنتج بانتظار موافقة الإدارة</p>' +
                '<a href="market.html" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#C19A6B;color:#fff;border-radius:8px;text-decoration:none">تصفح السوق</a>' +
              '</div>';
            }
            return;
          }

          _rawProduct = data;
          product = normalizeProduct(data);
          _isAuction = (product.listingType === 'auction');

          // تنظيف المزادات المنتهية تلقائياً (fire-and-forget)
          try { SAIDAT.products.autoEndExpired(); } catch(e) { /* silent */ }

          renderProduct();
          renderReviews();

          if (_isAuction) {
            // فحص حالة المزاد قبل تهيئة الواجهة
            if (product.auctionStatus === 'cancelled') {
              initAuctionUI();
              showCancelledMessage();
              return;
            }
            if (product.auctionStatus === 'ended' || product.auctionStatus === 'sold') {
              initAuctionUI();
              await loadBidData();
              handleAuctionEnd();
              return;
            }

            initAuctionUI();
            await loadBidData();
            startCountdown();
            startPolling();
          } else {
            setupEventListeners();
          }
          return;
        }
      }
    } catch(e) {
      U.log('warn', 'Supabase fetch failed, using fallback:', e);
    }

    // Fallback to hardcoded
    var numId = parseInt(id) || 1;
    product = fallbackProducts.find(function(p) { return p.id === numId; }) || fallbackProducts[0];

    renderProduct();
    renderReviews();
    setupEventListeners();
  }

  function renderProduct() {
    document.getElementById('productName').textContent = product.name;
    document.getElementById('productImage').src = U.safeImageUrl(product.image);
    document.getElementById('productImage').alt = esc(product.name);
    document.getElementById('productBadge').textContent = product.category;
    document.getElementById('metaType').textContent = product.type;
    document.getElementById('metaOrigin').textContent = product.origin;
    document.getElementById('metaWeight').textContent = product.weight + ' ' + product.unit;
    document.getElementById('productDescription').textContent = product.description;

    // Rating
    document.getElementById('productStars').textContent = U.starsText(product.rating);
    document.getElementById('productRating').textContent = product.rating;

    // Seller
    document.getElementById('sellerName').textContent = product.seller;
    document.getElementById('sellerAvatar').textContent = product.seller.charAt(0);
    if (product.verified) {
      document.getElementById('verifiedBadge').style.display = 'inline-flex';
    }

    // Price display
    if (_isAuction) {
      document.getElementById('productPrice').textContent = U.formatNumber(product.startPrice);
      var vatNote = document.querySelector('.product-vat-note');
      if (vatNote) vatNote.textContent = 'السعر الابتدائي للمزاد';
    } else {
      document.getElementById('productPrice').textContent = U.formatNumber(product.price);
    }

    document.title = product.name + ' | صيدات العود';
  }

  // ===== AUCTION UI SETUP =====
  function initAuctionUI() {
    // Hide checkout stepper
    var stepperSection = document.querySelector('.stepper-section');
    if (stepperSection) stepperSection.style.display = 'none';

    // Hide quantity and step actions
    var qtySection = document.getElementById('quantitySection');
    if (qtySection) qtySection.style.display = 'none';

    var stepActions = document.getElementById('stepActions');
    if (stepActions) stepActions.style.display = 'none';

    // Show auction panel
    var auctionPanel = document.getElementById('auctionPanel');
    if (auctionPanel) auctionPanel.style.display = 'block';

    // Set auction type label
    var typeLabel = document.getElementById('auctionTypeLabel');
    if (typeLabel && CFG.AUCTION_TYPE_LABELS) {
      typeLabel.textContent = CFG.AUCTION_TYPE_LABELS[product.auctionType] || '';
    }

    // Set start price
    var startPriceEl = document.getElementById('startPriceValue');
    if (startPriceEl) {
      startPriceEl.textContent = U.formatNumber(product.startPrice) + ' ر.س';
    }

    // Check login for bid form
    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    var bidLoginMsg = document.getElementById('bidLoginMsg');
    var bidFormInner = document.getElementById('bidFormInner');

    if (!authUser) {
      if (bidLoginMsg) bidLoginMsg.style.display = 'block';
      if (bidFormInner) bidFormInner.style.display = 'none';
    } else {
      if (bidLoginMsg) bidLoginMsg.style.display = 'none';
      if (bidFormInner) bidFormInner.style.display = 'block';
    }

    // Buy now
    if (product.buyNow && product.buyNow > 0) {
      var buyNowCard = document.getElementById('buyNowCard');
      if (buyNowCard) {
        buyNowCard.style.display = 'block';
        var buyNowPrice = document.getElementById('buyNowPrice');
        if (buyNowPrice) buyNowPrice.textContent = U.formatNumber(product.buyNow);
      }
    }
  }

  // ===== عرض رسالة الإلغاء =====
  function showCancelledMessage() {
    _auctionEnded = true;

    // Update badge
    var badge = document.getElementById('auctionStatusBadge');
    if (badge) {
      badge.classList.add('ended');
      badge.style.background = '#6B7280';
      badge.innerHTML = 'تم إلغاء المزاد';
    }

    // Hide bid form
    var bidFormCard = document.querySelector('.bid-form-card');
    if (bidFormCard) bidFormCard.style.display = 'none';

    // Hide buy now
    var buyNowCard = document.getElementById('buyNowCard');
    if (buyNowCard) buyNowCard.style.display = 'none';

    // Show cancellation message
    var auctionPanel = document.getElementById('auctionPanel');
    if (auctionPanel) {
      var reason = product.cancelReason ? (' — السبب: ' + esc(product.cancelReason)) : '';
      var cancelledByText = product.cancelledBy === 'admin' ? 'الإدارة' : 'التاجر';

      var msgHTML = '<div class="auction-cancelled-msg" style="background:#FEF2F2;border:1px solid #FECACA;border-radius:12px;padding:24px;text-align:center;margin-top:16px;">' +
        '<div style="font-size:2.5rem;margin-bottom:12px;">🚫</div>' +
        '<h3 style="color:#DC2626;font-weight:700;margin-bottom:8px;">تم إلغاء هذا المزاد</h3>' +
        '<p style="color:#991B1B;font-size:0.9rem;">ألغي بواسطة ' + cancelledByText + reason + '</p>' +
        '<a href="market.html" class="btn btn-filled" style="margin-top:16px;display:inline-block;padding:10px 24px;background:#C19A6B;color:#fff;border-radius:8px;text-decoration:none;">تصفح السوق</a>' +
      '</div>';

      auctionPanel.insertAdjacentHTML('beforeend', msgHTML);
    }

    // Set countdown to zeros
    var gridEl = document.getElementById('countdownGrid');
    if (gridEl) {
      gridEl.innerHTML = '<div style="text-align:center;width:100%;padding:8px 0;color:rgba(255,255,255,0.7);font-size:0.95rem;">تم إلغاء المزاد</div>';
    }
  }

  // ===== معالجة انتهاء المزاد =====
  function handleAuctionEnd() {
    _auctionEnded = true;
    clearInterval(_countdownTimer);
    stopPolling();

    // Set countdown to zeros
    var cdDays = document.getElementById('cdDays');
    if (cdDays) cdDays.textContent = '00';
    var cdHours = document.getElementById('cdHours');
    if (cdHours) cdHours.textContent = '00';
    var cdMinutes = document.getElementById('cdMinutes');
    if (cdMinutes) cdMinutes.textContent = '00';
    var cdSeconds = document.getElementById('cdSeconds');
    if (cdSeconds) cdSeconds.textContent = '00';

    // Update badge
    var badge = document.getElementById('auctionStatusBadge');
    if (badge) {
      badge.classList.add('ended');
      badge.innerHTML = 'انتهى المزاد';
    }

    // Disable bid form
    var submitBtn = document.getElementById('bidSubmitBtn');
    if (submitBtn) submitBtn.disabled = true;
    var bidInputEl = document.getElementById('bidAmount');
    if (bidInputEl) bidInputEl.disabled = true;

    // Hide buy now
    var buyNowCard = document.getElementById('buyNowCard');
    if (buyNowCard) buyNowCard.style.display = 'none';

    // Check if current user is the winner
    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;

    if (_currentHighBid > 0) {
      // There was at least one bid
      if (product.auctionStatus === 'sold') {
        showAuctionEndMessage('تم بيع هذا المنتج عبر المزاد');
      } else if (authUser && product.winnerId && authUser.id === product.winnerId) {
        // Current user is the winner
        showWinnerPanel(_currentHighBid);

          // إشعار للفائز
          if (SAIDAT.notifications) {
            SAIDAT.notifications.create({
              user_id: SAIDAT.auth.getAuthUser().id,
              type: 'auction_won',
              title: 'مبروك! فزت بالمزاد',
              body: 'فزت بمزاد ' + (product.name || 'المنتج') + ' بمبلغ ' + U.formatCurrency(_currentHighBid),
              link: 'product.html?id=' + product.id
            });
          }
      } else if (authUser) {
        // Check if the highest bidder is the current user
        checkIfWinner(authUser);
      } else {
        showAuctionEndMessage('انتهى المزاد — أعلى مزايدة: ' + U.formatNumber(_currentHighBid) + ' ر.س');
      }
    } else {
      showAuctionEndMessage('انتهى المزاد بدون مزايدات');
    }
  }

  // فحص إذا كان المستخدم الحالي هو الفائز
  async function checkIfWinner(authUser) {
    try {
      var highest = await SAIDAT.bids.getHighest(product.id);
      if (highest && highest.bidder_id === authUser.id) {
        showWinnerPanel(highest.amount);
      } else {
        showAuctionEndMessage('انتهى المزاد — أعلى مزايدة: ' + U.formatNumber(_currentHighBid) + ' ر.س');
      }
    } catch(e) {
      showAuctionEndMessage('انتهى المزاد — أعلى مزايدة: ' + U.formatNumber(_currentHighBid) + ' ر.س');
    }
  }

  // ===== لوحة الفائز =====
  function showWinnerPanel(amount) {
    // Hide bid form
    var bidFormCard = document.querySelector('.bid-form-card');
    if (bidFormCard) bidFormCard.style.display = 'none';

    var auctionPanel = document.getElementById('auctionPanel');
    if (!auctionPanel) return;

    var winnerHTML = '<div class="winner-panel" style="background:linear-gradient(135deg,#065F46,#059669);border-radius:12px;padding:28px;text-align:center;margin-top:16px;color:#fff;">' +
      '<div style="font-size:2.5rem;margin-bottom:12px;">🎉</div>' +
      '<h3 style="font-weight:800;font-size:1.3rem;margin-bottom:8px;">مبروك! أنت الفائز بالمزاد</h3>' +
      '<p style="opacity:0.9;margin-bottom:4px;">مزايدتك الفائزة: <strong>' + U.formatNumber(amount) + ' ر.س</strong></p>' +
      '<p style="opacity:0.7;font-size:0.85rem;margin-bottom:20px;">أكمل عملية الشراء الآن لتأكيد طلبك</p>' +
      '<button onclick="completeAuctionPurchase(' + amount + ')" class="btn" style="background:#fff;color:#065F46;padding:14px 36px;border-radius:8px;font-weight:700;font-size:1rem;border:none;cursor:pointer;">' +
        'أكمل الشراء' +
      '</button>' +
    '</div>';

    auctionPanel.insertAdjacentHTML('beforeend', winnerHTML);
  }

  // ===== رسالة انتهاء المزاد (لغير الفائز) =====
  function showAuctionEndMessage(msg) {
    var bidFormCard = document.querySelector('.bid-form-card');
    if (bidFormCard) bidFormCard.style.display = 'none';

    var auctionPanel = document.getElementById('auctionPanel');
    if (!auctionPanel) return;

    var msgHTML = '<div class="auction-end-msg" style="background:var(--bg-beige);border:1px solid var(--border-taupe);border-radius:12px;padding:24px;text-align:center;margin-top:16px;">' +
      '<div style="font-size:2rem;margin-bottom:12px;">⏰</div>' +
      '<p style="color:var(--text-deep);font-weight:600;font-size:1rem;">' + esc(msg) + '</p>' +
      '<a href="market.html" class="btn btn-filled" style="margin-top:16px;display:inline-block;padding:10px 24px;background:#C19A6B;color:#fff;border-radius:8px;text-decoration:none;">تصفح السوق</a>' +
    '</div>';

    auctionPanel.insertAdjacentHTML('beforeend', msgHTML);
  }

  // ===== إكمال شراء المزاد (الفائز) =====
  function completeAuctionPurchase(winningAmount) {
    // Switch product price to winning bid amount
    product.price = winningAmount;
    quantity = 1;

    // Hide auction panel
    var auctionPanel = document.getElementById('auctionPanel');
    if (auctionPanel) auctionPanel.style.display = 'none';

    // Show stepper section
    var stepperSection = document.querySelector('.stepper-section');
    if (stepperSection) stepperSection.style.display = '';

    // Update the displayed price
    document.getElementById('productPrice').textContent = U.formatNumber(winningAmount);
    var vatNote = document.querySelector('.product-vat-note');
    if (vatNote) vatNote.textContent = 'سعر المزايدة الفائزة';

    // Setup event listeners for the purchase flow
    setupEventListeners();

    // Go directly to step 2 (address & shipping)
    goToStep(2);

    SAIDAT.ui.showToast('أكمل بيانات الشحن لإتمام الشراء', 'success');
  }

  // ===== التمديد التلقائي =====
  async function checkAutoExtend() {
    if (!product.autoExtend || !product.auctionEndDate) return;

    var endDate = new Date(product.auctionEndDate);
    var now = new Date();
    var remaining = endDate - now;

    // لو المزايدة في آخر 5 دقائق → مدّد 5 دقائق
    if (remaining > 0 && remaining <= CFG.AUCTION.AUTO_EXTEND_THRESHOLD) {
      var newEndDate = new Date(endDate.getTime() + CFG.AUCTION.AUTO_EXTEND_DURATION);
      try {
        var ok = await SAIDAT.products.update(product.id, {
          auction_end_date: newEndDate.toISOString()
        });
        if (ok) {
          product.auctionEndDate = newEndDate.toISOString();
          U.log('log', 'Auto-extend: auction extended to', newEndDate.toISOString());
          SAIDAT.ui.showToast('تم تمديد المزاد 5 دقائق تلقائياً', 'info');
        }
      } catch(e) {
        U.log('error', 'Auto-extend error:', e);
      }
    }
  }

  // ===== LOAD BID DATA =====
  async function loadBidData() {
    if (!SAIDAT.bids || !product) return;

    try {
      var bids = await SAIDAT.bids.getForProduct(product.id);
      _bidCount = bids.length;

      if (bids.length > 0) {
        _currentHighBid = bids[0].amount;
      } else {
        _currentHighBid = 0;
      }

      renderBidInfo();
      renderBidHistory(bids);
    } catch(e) {
      U.log('error', 'loadBidData error:', e);
    }
  }

  function renderBidInfo() {
    // Highest bid
    var highEl = document.getElementById('highestBidValue');
    if (highEl) {
      if (_currentHighBid > 0) {
        highEl.textContent = U.formatNumber(_currentHighBid) + ' ر.س';
      } else {
        highEl.textContent = 'لا توجد مزايدات';
      }
    }

    // Min next bid
    var minNextEl = document.getElementById('minNextBidValue');
    if (minNextEl) {
      var minNext = _currentHighBid > 0
        ? _currentHighBid + (product.minBid || CFG.AUCTION.MIN_BID_DEFAULT)
        : product.startPrice;
      minNextEl.textContent = U.formatNumber(minNext) + ' ر.س';
    }

    // Bid count
    var countEl = document.getElementById('bidCountValue');
    if (countEl) {
      countEl.textContent = _bidCount;
    }

    // Update bid hint
    var hintEl = document.getElementById('bidHint');
    if (hintEl) {
      var minAmount = _currentHighBid > 0
        ? _currentHighBid + (product.minBid || CFG.AUCTION.MIN_BID_DEFAULT)
        : product.startPrice;
      hintEl.textContent = 'الحد الأدنى للمزايدة: ' + U.formatNumber(minAmount) + ' ر.س';
    }
  }

  function renderBidHistory(bids) {
    var listEl = document.getElementById('bidHistoryList');
    if (!listEl) return;

    if (!bids || bids.length === 0) {
      listEl.innerHTML = '<p class="bid-empty-msg">لا توجد مزايدات حتى الآن</p>';
      return;
    }

    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    var html = '';

    bids.forEach(function(bid, index) {
      var bidderName = bid.bidder_name || 'مزايد';
      var initial = bidderName.charAt(0);
      var isTop = (index === 0);
      var timeAgo = getTimeAgo(bid.created_at);

      // فحص هل يمكن سحب المزايدة (خلال 5 دقائق فقط ومن نفس المزايد)
      var retractBtn = '';
      if (!_auctionEnded && authUser && bid.bidder_id === authUser.id) {
        var bidTime = new Date(bid.created_at);
        var now = new Date();
        var elapsed = now - bidTime;
        if (elapsed <= CFG.AUCTION.BID_RETRACT_WINDOW) {
          retractBtn = '<button class="bid-retract-btn" onclick="retractBid(\'' + esc(bid.id) + '\')" title="سحب المزايدة">&times;</button>';
        }
      }

      html += '<div class="bid-history-item' + (isTop ? ' top-bid' : '') + '">' +
        '<div class="bid-avatar">' + esc(initial) + '</div>' +
        '<div class="bid-details">' +
          '<div class="bid-bidder-name">' +
            esc(bidderName) +
            (isTop ? ' <span class="bid-top-label">الأعلى</span>' : '') +
          '</div>' +
          '<div class="bid-time">' + esc(timeAgo) + '</div>' +
        '</div>' +
        '<div class="bid-amount">' + U.formatNumber(bid.amount) + ' ر.س</div>' +
        retractBtn +
      '</div>';
    });

    listEl.innerHTML = html;
  }

  function getTimeAgo(dateStr) {
    if (!dateStr) return '';
    var now = new Date();
    var then = new Date(dateStr);
    var diffMs = now - then;
    var diffSec = Math.floor(diffMs / 1000);
    var diffMin = Math.floor(diffSec / 60);
    var diffHr = Math.floor(diffMin / 60);
    var diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'الآن';
    if (diffMin < 60) return 'منذ ' + diffMin + ' دقيقة';
    if (diffHr < 24) return 'منذ ' + diffHr + ' ساعة';
    return 'منذ ' + diffDay + ' يوم';
  }

  // ===== سحب مزايدة =====
  async function retractBid(bidId) {
    if (!confirm('هل أنت متأكد من سحب مزايدتك؟')) return;

    try {
      var ok = await SAIDAT.bids.retract(bidId);
      if (ok) {
        SAIDAT.ui.showToast('تم سحب مزايدتك بنجاح', 'success');
        await loadBidData();
      } else {
        SAIDAT.ui.showToast('لم يتم سحب المزايدة — ربما انتهت المهلة', 'error');
      }
    } catch(e) {
      U.log('error', 'retractBid error:', e);
      SAIDAT.ui.showToast('حدث خطأ أثناء سحب المزايدة', 'error');
    }
  }

  // ===== COUNTDOWN =====
  function startCountdown() {
    if (!product.auctionEndDate) {
      // Until sold — no countdown needed
      if (product.auctionType === 'until_sold') {
        var gridEl = document.getElementById('countdownGrid');
        if (gridEl) {
          gridEl.innerHTML = '<div style="text-align:center;width:100%;padding:8px 0;color:rgba(255,255,255,0.7);font-size:0.95rem;">مزاد مفتوح — ينتهي بالبيع</div>';
        }
      }
      return;
    }

    updateCountdown(); // immediate first tick
    _countdownTimer = setInterval(updateCountdown, CFG.AUCTION.COUNTDOWN_UPDATE);
  }

  function updateCountdown() {
    var endDate = new Date(product.auctionEndDate);
    var now = new Date();
    var diff = endDate - now;

    if (diff <= 0) {
      // Auction ended
      handleAuctionEnd();
      return;
    }

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((diff % (1000 * 60)) / 1000);

    document.getElementById('cdDays').textContent = String(days).padStart(2, '0');
    document.getElementById('cdHours').textContent = String(hours).padStart(2, '0');
    document.getElementById('cdMinutes').textContent = String(minutes).padStart(2, '0');
    document.getElementById('cdSeconds').textContent = String(seconds).padStart(2, '0');
  }

  // ===== POLLING =====
  function startPolling() {
    _pollTimer = setInterval(async function() {
      if (_auctionEnded) return;

      await loadBidData();

      // تحديث حالة المزاد من DB (لجميع المزادات — ليس فقط autoExtend)
      if (product.id) {
        try {
          var freshData = await SAIDAT.products.getOne(product.id);
          if (freshData) {
            // تمديد تلقائي (فقط لمزادات autoExtend)
            if (product.autoExtend && freshData.auction_end_date && freshData.auction_end_date !== product.auctionEndDate) {
              product.auctionEndDate = freshData.auction_end_date;
              U.log('log', 'Polling: auction_end_date updated to', product.auctionEndDate);
            }
            // فحص حالة المزاد (لجميع المزادات)
            if (freshData.auction_status === 'cancelled') {
              product.auctionStatus = 'cancelled';
              product.cancelReason = freshData.cancel_reason || '';
              product.cancelledBy = freshData.cancelled_by || '';
              _auctionEnded = true;
              clearInterval(_countdownTimer);
              stopPolling();
              showCancelledMessage();
            } else if (freshData.auction_status === 'ended' && product.auctionStatus === 'live') {
              product.auctionStatus = 'ended';
              product.winnerId = freshData.winner_id || null;
              handleAuctionEnd();
            } else if (freshData.auction_status === 'sold') {
              product.auctionStatus = 'sold';
              _auctionEnded = true;
              clearInterval(_countdownTimer);
              stopPolling();
              handleAuctionEnd();
            }
          }
        } catch(e) {
          U.log('warn', 'Polling: could not refresh product:', e);
        }
      }
    }, CFG.AUCTION.POLL_INTERVAL);
  }

  function stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  }

  // ===== SUBMIT BID =====
  var _bidSubmitting = false; // قفل لمنع الإرسال المزدوج
  var _orderSubmitting = false; // قفل لمنع تكرار تأكيد الطلب
  var _lastBidTime = 0;

  async function submitBid() {
    // Rate Limiting — 5 ثواني بين كل مزايدة
    if (Date.now() - _lastBidTime < 5000) {
      alert('يرجى الانتظار 5 ثواني بين كل مزايدة');
      return;
    }

    // قفل — منع ضغطتين بنفس الوقت
    if (_bidSubmitting) return;

    if (_auctionEnded) {
      SAIDAT.ui.showToast('المزاد انتهى', 'error');
      return;
    }

    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    if (!authUser) {
      SAIDAT.ui.showToast('يجب تسجيل الدخول للمزايدة', 'error');
      return;
    }

    // Prevent self-bidding
    if (product.sellerId && product.sellerId === authUser.id) {
      SAIDAT.ui.showToast('لا يمكنك المزايدة على منتجك', 'error');
      return;
    }

    var bidInput = document.getElementById('bidAmount');
    var amount = parseFloat(bidInput.value);

    if (isNaN(amount) || amount <= 0) {
      SAIDAT.ui.showToast('أدخل مبلغ صحيح', 'error');
      return;
    }

    // تفعيل القفل + تعطيل الزر
    _bidSubmitting = true;
    _lastBidTime = Date.now();
    var submitBtn = document.getElementById('bidSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'جاري الإرسال...';

    try {
      // إعادة جلب أعلى مزايدة من DB قبل الإرسال (حماية من Race Condition)
      var freshHighest = await SAIDAT.bids.getHighest(product.id);
      var freshHighBid = freshHighest ? freshHighest.amount : 0;
      var minRequired = freshHighBid > 0
        ? freshHighBid + (product.minBid || CFG.AUCTION.MIN_BID_DEFAULT)
        : product.startPrice;

      if (amount < minRequired) {
        // شخص زايد قبلك! نحدّث الشاشة
        _currentHighBid = freshHighBid;
        await loadBidData();
        SAIDAT.ui.showToast('شخص زايد قبلك! الحد الأدنى الآن: ' + U.formatNumber(minRequired) + ' ر.س', 'error');
        return;
      }

      // Get bidder name from profile
      var bidderName = 'مزايد';
      try {
        var profile = SAIDAT.auth.getRawProfile();
        if (profile) {
          bidderName = profile.first_name
            ? (profile.first_name + ' ' + (profile.last_name || '')).trim()
            : (profile.store_name || 'مزايد');
        }
      } catch(e) {
        U.log('warn', 'Could not load bidder profile:', e);
      }

      // إرسال المزايدة
      var result = await SAIDAT.bids.place({
        product_id: product.id,
        bidder_name: bidderName,
        amount: amount
      });

      if (result) {
        SAIDAT.ui.showToast('تم تقديم مزايدتك بنجاح!', 'success');
        bidInput.value = '';
        await loadBidData(); // تحديث فوري

        // فحص التمديد التلقائي بعد نجاح المزايدة
        await checkAutoExtend();

        // إشعار للمزايد السابق (تم تجاوز مزايدتك)
        if (SAIDAT.notifications && freshHighest && freshHighest.bidder_id && freshHighest.bidder_id !== SAIDAT.auth.getAuthUser().id) {
          SAIDAT.notifications.create({
            user_id: freshHighest.bidder_id,
            type: 'outbid',
            title: 'تم تجاوز مزايدتك',
            body: 'تم تقديم مزايدة أعلى على ' + (product.name || 'المنتج'),
            link: 'product.html?id=' + product.id
          });
        }
        // إشعار للبائع (مزايدة جديدة)
        if (SAIDAT.notifications && product.sellerId) {
          SAIDAT.notifications.create({
            user_id: product.sellerId,
            type: 'new_order',
            title: 'مزايدة جديدة',
            body: U.formatCurrency(amount) + ' على ' + (product.name || 'المنتج'),
            link: 'product.html?id=' + product.id
          });
        }
      } else {
        // لو الـ DB trigger رفض (مزايدة أقل من الموجود)
        await loadBidData();
        SAIDAT.ui.showToast('لم تتم المزايدة — ربما سبقك أحد. حاول مرة أخرى', 'error');
      }
    } catch(e) {
      U.log('error', 'submitBid error:', e);
      await loadBidData();
      SAIDAT.ui.showToast('حدث خطأ. حاول مرة أخرى', 'error');
    } finally {
      // فك القفل + تفعيل الزر
      _bidSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg> زايد الآن';
    }
  }

  // ===== BUY NOW =====
  function buyNow() {
    if (_auctionEnded) {
      SAIDAT.ui.showToast('المزاد انتهى', 'error');
      return;
    }

    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    if (!authUser) {
      SAIDAT.ui.showToast('يجب تسجيل الدخول للشراء', 'error');
      return;
    }

    // Switch product price to buy_now price and quantity = 1
    product.price = product.buyNow;
    quantity = 1;

    // Stop auction polling/countdown (user chose to buy now)
    stopPolling();
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }

    // Hide auction panel
    var auctionPanel = document.getElementById('auctionPanel');
    if (auctionPanel) auctionPanel.style.display = 'none';

    // Show stepper section
    var stepperSection = document.querySelector('.stepper-section');
    if (stepperSection) stepperSection.style.display = '';

    // Update the displayed price to buy_now
    document.getElementById('productPrice').textContent = U.formatNumber(product.buyNow);
    var vatNote = document.querySelector('.product-vat-note');
    if (vatNote) vatNote.textContent = 'سعر الشراء الفوري';

    // Setup event listeners for the purchase flow
    setupEventListeners();

    // Go directly to step 2 (address & shipping)
    goToStep(2);

    SAIDAT.ui.showToast('أكمل بيانات الشحن لإتمام الشراء', 'success');
  }

  // ===== CLEANUP =====
  window.addEventListener('beforeunload', function() {
    stopPolling();
    if (_countdownTimer) {
      clearInterval(_countdownTimer);
      _countdownTimer = null;
    }
  });

  // ===== Visibility API — إيقاف polling عند إخفاء الصفحة =====
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      stopPolling();
      if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }
    } else {
      if (!_auctionEnded && product && product.auctionEndDate) {
        startPolling();
        startCountdown();
      }
    }
  });

  function setupEventListeners() {
    // Quantity
    document.getElementById('qtyPlus').addEventListener('click', function() {
      if (quantity < 10) {
        quantity++;
        document.getElementById('qtyValue').textContent = quantity;
      }
    });

    document.getElementById('qtyMinus').addEventListener('click', function() {
      if (quantity > 1) {
        quantity--;
        document.getElementById('qtyValue').textContent = quantity;
      }
    });

    // Card number formatting
    document.getElementById('cardNumber').addEventListener('input', function(e) {
      var val = e.target.value.replace(/\D/g, '').substring(0, 16);
      var formatted = val.replace(/(.{4})/g, '$1 ').trim();
      e.target.value = formatted;
    });

    // Card expiry formatting
    document.getElementById('cardExpiry').addEventListener('input', function(e) {
      var val = e.target.value.replace(/\D/g, '').substring(0, 4);
      if (val.length >= 2) {
        val = val.substring(0, 2) + '/' + val.substring(2);
      }
      e.target.value = val;
    });

    // CVV
    document.getElementById('cardCVV').addEventListener('input', function(e) {
      e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
    });

    // Phone formatting
    document.getElementById('phone').addEventListener('input', function(e) {
      var val = e.target.value.replace(/[^\d+]/g, '');
      if (!val.startsWith('+966') && !val.startsWith('+')) {
        if (val.startsWith('05')) {
          val = '+966' + val.substring(1);
        } else if (val.startsWith('5')) {
          val = '+966' + val;
        } else if (val.length > 0 && !val.startsWith('+')) {
          val = '+966' + val;
        }
      }
      e.target.value = val;
    });

    // Receipt upload
    document.getElementById('receiptUpload').addEventListener('change', function(e) {
      if (e.target.files.length > 0) {
        document.getElementById('uploadFileName').textContent = '\u2713 ' + e.target.files[0].name;
      }
    });
  }

  // ===== MOBILE MENU =====
  U.initMobileMenu('mobileToggle', 'mobileMenu', 'open');

  // ===== NAVIGATION =====
  function goToStep(step) {
    if (step === currentStep) return;

    // Hide current
    document.getElementById('step' + currentStep).classList.remove('active');

    // Update stepper
    var steps = document.querySelectorAll('.step-item');
    var connectors = document.querySelectorAll('.step-connector');

    steps.forEach(function(s, i) {
      s.classList.remove('active', 'completed');
      if (i + 1 < step) {
        s.classList.add('completed');
      } else if (i + 1 === step) {
        s.classList.add('active');
      }
    });

    connectors.forEach(function(c, i) {
      c.classList.remove('completed');
      if (i + 1 < step) {
        c.classList.add('completed');
      }
    });

    currentStep = step;

    // Update payment summary if going to step 4
    if (step === 4) {
      updateOrderSummary();
      updateInstallments();
    }

    // Show new step
    var el = document.getElementById('step' + step);
    el.classList.add('active');

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ===== VALIDATION =====
  function validateStep2() {
    var valid = true;
    var fields = [
      { id: 'fullName', errId: 'fullNameError', check: function(v) { return v.trim().length >= 3; } },
      { id: 'phone', errId: 'phoneError', check: function(v) { return /^\+966[0-9]{8,9}$/.test(v.replace(/\s/g, '')); } },
      { id: 'city', errId: 'cityError', check: function(v) { return v !== ''; } },
      { id: 'district', errId: 'districtError', check: function(v) { return v.trim().length >= 2; } },
      { id: 'street', errId: 'streetError', check: function(v) { return v.trim().length >= 5; } }
    ];

    fields.forEach(function(f) {
      var el = document.getElementById(f.id);
      var err = document.getElementById(f.errId);
      if (!f.check(el.value)) {
        el.classList.add('error');
        err.classList.add('show');
        valid = false;
      } else {
        el.classList.remove('error');
        err.classList.remove('show');
      }
    });

    if (valid) {
      goToStep(3);
    }
  }

  // ===== SHIPPING =====
  function selectShipping(el, cost) {
    document.querySelectorAll('.shipping-option').forEach(function(opt) {
      opt.classList.remove('selected');
    });
    el.classList.add('selected');
    el.querySelector('input[type="radio"]').checked = true;
    shippingCost = (product.freeShipping || product.free_shipping) ? 0 : cost;
  }

  // ===== TERMS =====
  function toggleTerms() {
    var cb = document.getElementById('termsCheck');
    var wrapper = document.getElementById('termsCheckbox');
    var btn = document.getElementById('termsNextBtn');

    cb.checked = !cb.checked;

    if (cb.checked) {
      wrapper.classList.add('checked');
      btn.disabled = false;
    } else {
      wrapper.classList.remove('checked');
      btn.disabled = true;
    }
  }

  // ===== PAYMENT =====
  function selectPayment(method, el) {
    document.querySelectorAll('.payment-option').forEach(function(opt) {
      opt.classList.remove('selected');
    });
    el.classList.add('selected');
    el.querySelector('input[type="radio"]').checked = true;
    selectedPayment = method;

    // Hide all panels
    document.querySelectorAll('.payment-detail-panel').forEach(function(p) {
      p.classList.remove('active');
    });

    // Show selected panel
    var panelMap = {
      card: 'panelCard',
      apple: 'panelApple',
      bank: 'panelBank',
      tabby: 'panelTabby',
      tamara: 'panelTamara'
    };
    document.getElementById(panelMap[method]).classList.add('active');
  }

  // ===== ORDER SUMMARY =====
  function updateOrderSummary() {
    var subtotal = product.price * quantity;
    var vat = (subtotal + shippingCost) * CFG.VAT_RATE;
    var total = subtotal + shippingCost + vat;

    document.getElementById('summaryProductName').textContent = product.name;
    document.getElementById('summaryProductQty').textContent = quantity + ' x ' + U.formatCurrency(product.price);
    document.getElementById('summarySubtotal').textContent = U.formatCurrency(subtotal);
    document.getElementById('summaryShipping').textContent = U.formatCurrency(shippingCost);
    document.getElementById('summaryVAT').textContent = U.formatCurrencyDecimal(vat);
    document.getElementById('summaryTotal').textContent = U.formatCurrencyDecimal(total);
  }

  function updateInstallments() {
    var subtotal = product.price * quantity;
    var vat = (subtotal + shippingCost) * CFG.VAT_RATE;
    var total = subtotal + shippingCost + vat;

    // Tabby: 4 installments
    var tabbyContainer = document.getElementById('tabbyBreakdown');
    tabbyContainer.innerHTML = '';
    var perTabby = total / 4;
    var tabbyLabels = ['اليوم', 'بعد شهر', 'بعد شهرين', 'بعد 3 أشهر'];
    for (var i = 0; i < 4; i++) {
      tabbyContainer.innerHTML += '<div class="installment-item"><div class="inst-num">' + tabbyLabels[i] + '</div><div class="inst-amount">' + U.formatCurrencyDecimal(perTabby) + '</div></div>';
    }

    // Tamara: 30 day + 3 installments
    document.getElementById('tamara30Day').textContent = U.formatCurrencyDecimal(total);

    var perTamara = total / 3;
    document.getElementById('tamara3Inst').textContent = U.formatCurrencyDecimal(perTamara) + ' / شهر';

    var tamaraContainer = document.getElementById('tamaraBreakdown');
    tamaraContainer.innerHTML = '';
    var tamaraLabels = ['اليوم', 'بعد شهر', 'بعد شهرين'];
    for (var j = 0; j < 3; j++) {
      tamaraContainer.innerHTML += '<div class="installment-item"><div class="inst-num">' + tamaraLabels[j] + '</div><div class="inst-amount">' + U.formatCurrencyDecimal(perTamara) + '</div></div>';
    }
  }

  // ===== CONFIRM ORDER =====
  async function confirmOrder() {
    // قفل — منع ضغطتين بنفس الوقت
    if (_orderSubmitting) return;

    var user = SAIDAT.auth.getAuthUser();
    if (!user) {
      SAIDAT.ui.showToast('يجب تسجيل الدخول لإتمام الطلب', 'error');
      setTimeout(function() { window.location.href = 'login.html'; }, 1500);
      return;
    }

    _orderSubmitting = true;
    var confirmBtn = document.querySelector('[onclick*="confirmOrder"]');
    var _origBtnText = '';
    if (confirmBtn) { _origBtnText = confirmBtn.textContent; confirmBtn.disabled = true; confirmBtn.textContent = 'جاري التنفيذ...'; }

    try {
    var orderNum = 'SA-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
    var subtotal = product.price * quantity;
    var vat = (subtotal + shippingCost) * CFG.VAT_RATE;
    var total = subtotal + shippingCost + vat;

    var orderData = {
      id: orderNum,
      seller_id: product.sellerId || product.seller_id,
      product_id: product.id,
      product_name: product.name,
      buyer_id: user.id,
      buyer_name: document.getElementById('fullName').value.trim(),
      buyer_phone: document.getElementById('phone').value.trim(),
      buyer_city: document.getElementById('city').value.trim(),
      buyer_district: (document.getElementById('district').value || '').trim(),
      buyer_street: (document.getElementById('street').value || '').trim(),
      qty: quantity,
      price: product.price,
      shipping: shippingCost,
      vat: Math.round(vat * 100) / 100,
      total: Math.round(total * 100) / 100,
      shipping_method: (document.querySelector('input[name="shipping"]:checked') || {}).value || 'standard',
      status: 'new'
    };

    var saved = await SAIDAT.orders.add(orderData);
    if (!saved) {
      SAIDAT.ui.showToast('حدث خطأ أثناء حفظ الطلب. يرجى المحاولة مرة أخرى.', 'error');
      return;
    }

    // إشعار للبائع (طلب جديد)
    if (SAIDAT.notifications && product.sellerId) {
      SAIDAT.notifications.create({
        user_id: product.sellerId,
        type: 'new_order',
        title: 'طلب جديد!',
        body: 'طلب جديد على ' + (product.name || 'المنتج'),
        link: 'dashboard.html#orders'
      });
    }

    // لو مزاد → إكمال الشراء عبر RPC آمن (يحدث الحالة + يزيد عداد البائع)
    if (_isAuction && product.id) {
      try {
        var rpcResult = await SAIDAT.products.completeAuctionPurchase(product.id, orderNum);
        if (rpcResult && !rpcResult.success) {
          U.log('warn', 'completeAuctionPurchase returned:', rpcResult.error);
        }
      } catch(e) {
        U.log('warn', 'Could not complete auction purchase:', e);
      }
    }

    document.getElementById('orderNumber').textContent = orderNum;

    // إضافة زر طباعة الفاتورة في نافذة النجاح
    var fullName = document.getElementById('fullName').value.trim();
    var phone = document.getElementById('phone').value.trim();
    var city = document.getElementById('city').value.trim();
    var existingInvoiceBtn = document.getElementById('invoicePrintBtn');
    if (existingInvoiceBtn) existingInvoiceBtn.remove();
    var invoiceBtn = document.createElement('button');
    invoiceBtn.id = 'invoicePrintBtn';
    invoiceBtn.className = 'btn btn-outline';
    invoiceBtn.style.marginTop = '12px';
    invoiceBtn.textContent = 'طباعة الفاتورة';
    invoiceBtn.onclick = function() {
      SAIDAT.invoice.print({
        orderId: orderData.id,
        productName: product.name || '',
        price: subtotal,
        shipping: shippingCost,
        vat: vat,
        total: total,
        buyerName: fullName,
        buyerPhone: phone,
        buyerCity: city
      });
    };
    var modalContent = document.querySelector('#successModal .success-state, #successModal .modal-content, #successModal > div');
    if (modalContent) modalContent.appendChild(invoiceBtn);

    document.getElementById('successModal').classList.add('active');
    } finally {
      _orderSubmitting = false;
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = _origBtnText || 'تأكيد الطلب'; }
    }
  }

  // Close modal on overlay click
  document.addEventListener('click', function(e) {
    if (e.target.id === 'successModal') {
      document.getElementById('successModal').classList.remove('active');
    }
  });

  // ===== REVIEWS SECTION =====
  var _selectedRating = 0;

  function setReviewRating(rating) {
    _selectedRating = rating;
    var stars = document.querySelectorAll('.star-selector span');
    stars.forEach(function(star, i) {
      if (i < rating) {
        star.classList.add('active');
      } else {
        star.classList.remove('active');
      }
    });
  }

  async function renderReviews() {
    if (!product || !product.id) return;
    if (!SAIDAT.reviews) return;

    // Find or create reviews container
    var container = document.getElementById('reviewsSection');
    if (!container) {
      // Create the container after the product layout (inside step1)
      var step1 = document.getElementById('step1');
      if (!step1) return;
      container = document.createElement('div');
      container.id = 'reviewsSection';
      container.className = 'reviews-section';
      step1.appendChild(container);
    }

    // Fetch reviews
    var reviews = [];
    try {
      reviews = await SAIDAT.reviews.getForProduct(product.id);
    } catch(e) {
      U.log('error', 'renderReviews: getForProduct error:', e);
    }

    var html = '<h3><svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor" stroke="none"/></svg> التقييمات والمراجعات</h3>';

    // Display existing reviews
    if (reviews.length > 0) {
      reviews.forEach(function(review) {
        var profile = review.profiles || {};
        var reviewerName = ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || profile.store_name || 'مستخدم';
        var rating = review.rating || 0;
        var starsHtml = '';
        for (var s = 0; s < 5; s++) {
          starsHtml += (s < rating) ? '\u2605' : '\u2606';
        }
        var dateStr = '';
        if (review.created_at) {
          var d = new Date(review.created_at);
          dateStr = d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
        }

        html += '<div class="review-card">' +
          '<div class="review-header">' +
            '<span class="review-author">' + esc(reviewerName) + '</span>' +
            '<span class="review-date">' + esc(dateStr) + '</span>' +
          '</div>' +
          '<div class="review-stars">' + starsHtml + '</div>' +
          (review.comment ? '<div class="review-comment">' + esc(review.comment) + '</div>' : '') +
        '</div>';
      });
    } else {
      html += '<div class="reviews-empty">لا توجد تقييمات لهذا المنتج حتى الآن</div>';
    }

    // Check if the current user can submit a review
    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    if (authUser) {
      try {
        // Find completed orders for this user on this product
        var sb = U.getSupabase();
        if (sb) {
          var orderRes = await sb
            .from('orders')
            .select('id')
            .eq('buyer_id', authUser.id)
            .eq('product_id', product.id)
            .eq('status', 'delivered');
          var completedOrders = orderRes.data || [];

          // Check each completed order to see if already reviewed
          for (var i = 0; i < completedOrders.length; i++) {
            var canReview = await SAIDAT.reviews.canReview(completedOrders[i].id);
            if (canReview) {
              // Show review form for this order
              html += '<div class="review-form">' +
                '<h4>أضف تقييمك</h4>' +
                '<input type="hidden" id="reviewOrderId" value="' + esc(completedOrders[i].id) + '">' +
                '<div class="star-selector">' +
                  '<span onclick="setReviewRating(1)">&#9733;</span>' +
                  '<span onclick="setReviewRating(2)">&#9733;</span>' +
                  '<span onclick="setReviewRating(3)">&#9733;</span>' +
                  '<span onclick="setReviewRating(4)">&#9733;</span>' +
                  '<span onclick="setReviewRating(5)">&#9733;</span>' +
                '</div>' +
                '<textarea id="reviewComment" class="review-textarea" placeholder="شاركنا تجربتك مع هذا المنتج..."></textarea>' +
                '<button class="review-submit-btn" onclick="submitReview()">' +
                  '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg>' +
                  ' إرسال التقييم' +
                '</button>' +
              '</div>';
              break; // Only show one form
            }
          }
        }
      } catch(e) {
        U.log('warn', 'renderReviews: order check error:', e);
      }
    }

    container.innerHTML = html;
  }

  async function submitReview() {
    if (!SAIDAT.reviews || !product) return;

    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    if (!authUser) {
      SAIDAT.ui.showToast('يجب تسجيل الدخول لإرسال التقييم', 'error');
      return;
    }

    if (_selectedRating === 0) {
      SAIDAT.ui.showToast('يرجى اختيار عدد النجوم', 'error');
      return;
    }

    var commentEl = document.getElementById('reviewComment');
    var comment = commentEl ? commentEl.value.trim() : '';

    var orderIdEl = document.getElementById('reviewOrderId');
    var orderId = orderIdEl ? orderIdEl.value : '';

    if (!orderId) {
      SAIDAT.ui.showToast('حدث خطأ — لم يتم العثور على الطلب', 'error');
      return;
    }

    try {
      var result = await SAIDAT.reviews.submit({
        product_id: product.id,
        order_id: orderId,
        seller_id: product.sellerId || product.seller_id || '',
        rating: _selectedRating,
        comment: comment
      });

      if (result) {
        SAIDAT.ui.showToast('تم إرسال تقييمك بنجاح!', 'success');
        _selectedRating = 0;
        await renderReviews(); // Re-render to show the new review
      } else {
        SAIDAT.ui.showToast('حدث خطأ أثناء إرسال التقييم', 'error');
      }
    } catch(e) {
      U.log('error', 'submitReview error:', e);
      SAIDAT.ui.showToast('حدث خطأ أثناء إرسال التقييم', 'error');
    }
  }

  // ===== EXPOSE TO WINDOW (for onclick handlers in HTML) =====
  window.goToStep = goToStep;
  window.validateStep2 = validateStep2;
  window.selectShipping = selectShipping;
  window.toggleTerms = toggleTerms;
  window.selectPayment = selectPayment;
  window.confirmOrder = confirmOrder;
  window.submitBid = submitBid;
  window.buyNow = buyNow;
  window.retractBid = retractBid;
  window.completeAuctionPurchase = completeAuctionPurchase;
  window.submitReview = submitReview;
  window.setReviewRating = setReviewRating;

  // ===== INITIAL LOAD =====
  init();

})();
