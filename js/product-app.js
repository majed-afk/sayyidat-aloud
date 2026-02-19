// ===== product-app.js — صفحة شراء المنتج + المزاد — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var esc = U.escapeHtml;
  var CFG = SAIDAT.config;

  // ===== HARDCODED FALLBACK DATA =====
  var fallbackProducts = [
    { id: 1, name: '\u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u0628\u0648\u0631\u0633\u0627\u062a \u0641\u0627\u062e\u0631', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0643\u0645\u0628\u0648\u062f\u064a', weight: 50, unit: '\u062c\u0631\u0627\u0645', price: 285, rating: 4.8, seller: '\u0645\u062d\u0645\u062f \u0627\u0644\u0639\u062a\u064a\u0628\u064a', verified: true, image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&h=500&fit=crop&q=80', description: '\u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u0641\u0627\u062e\u0631 \u0645\u0646 \u063a\u0627\u0628\u0627\u062a \u0628\u0648\u0631\u0633\u0627\u062a.' },
    { id: 2, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0623\u0633\u0627\u0645\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0647\u0646\u062f\u064a', weight: 1, unit: '\u062a\u0648\u0644\u0629', price: 650, rating: 4.9, seller: '\u0639\u0628\u062f\u0627\u0644\u0644\u0647 \u0627\u0644\u0634\u0645\u0631\u064a', verified: true, image: 'https://images.unsplash.com/photo-1594035910387-fea081d36b4c?w=600&h=500&fit=crop&q=80', description: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0623\u0633\u0627\u0645\u064a \u0628\u064a\u0648\u0631.' },
    { id: 3, name: '\u0628\u062e\u0648\u0631 \u0644\u0627\u0648\u0633\u064a \u062c\u0628\u0644\u064a', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0644\u0627\u0648\u0633\u064a', weight: 30, unit: '\u062c\u0631\u0627\u0645', price: 195, rating: 4.7, seller: '\u062e\u0627\u0644\u062f \u0627\u0644\u062f\u0648\u0633\u0631\u064a', verified: false, image: 'https://images.unsplash.com/photo-1595535373192-fc8935bacd89?w=600&h=500&fit=crop&q=80', description: '\u0628\u062e\u0648\u0631 \u0644\u0627\u0648\u0633\u064a \u0645\u0646 \u0645\u0631\u062a\u0641\u0639\u0627\u062a \u0644\u0627\u0648\u0633 \u0627\u0644\u062c\u0628\u0644\u064a\u0629.' }
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
    var sellerName = profile.store_name || ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || '\u062a\u0627\u062c\u0631';

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
      auctionStatus: row.auction_status || 'active',
      buyNow: row.buy_now || 0,
      sellerPhone: profile.phone || ''
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
                '<h2 style="color:#2C1810;margin-bottom:8px">\u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c \u063a\u064a\u0631 \u0645\u062a\u0627\u062d \u062d\u0627\u0644\u064a\u0627\u064b</h2>' +
                '<p style="color:#4A2C1A;opacity:0.7">\u0627\u0644\u0645\u0646\u062a\u062c \u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629</p>' +
                '<a href="market.html" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#C19A6B;color:#fff;border-radius:8px;text-decoration:none">\u062a\u0635\u0641\u062d \u0627\u0644\u0633\u0648\u0642</a>' +
              '</div>';
            }
            return;
          }

          _rawProduct = data;
          product = normalizeProduct(data);
          _isAuction = (product.listingType === 'auction');

          renderProduct();

          if (_isAuction) {
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
      console.warn('Supabase fetch failed, using fallback:', e);
    }

    // Fallback to hardcoded
    var numId = parseInt(id) || 1;
    product = fallbackProducts.find(function(p) { return p.id === numId; }) || fallbackProducts[0];

    renderProduct();
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
      if (vatNote) vatNote.textContent = '\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0627\u0628\u062a\u062f\u0627\u0626\u064a \u0644\u0644\u0645\u0632\u0627\u062f';
    } else {
      document.getElementById('productPrice').textContent = U.formatNumber(product.price);
    }

    document.title = product.name + ' | \u0635\u064a\u062f\u0627\u062a \u0627\u0644\u0639\u0648\u062f';
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
      startPriceEl.textContent = U.formatNumber(product.startPrice) + ' \u0631.\u0633';
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
      console.error('loadBidData error:', e);
    }
  }

  function renderBidInfo() {
    // Highest bid
    var highEl = document.getElementById('highestBidValue');
    if (highEl) {
      if (_currentHighBid > 0) {
        highEl.textContent = U.formatNumber(_currentHighBid) + ' \u0631.\u0633';
      } else {
        highEl.textContent = '\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0632\u0627\u064a\u062f\u0627\u062a';
      }
    }

    // Min next bid
    var minNextEl = document.getElementById('minNextBidValue');
    if (minNextEl) {
      var minNext = _currentHighBid > 0
        ? _currentHighBid + (product.minBid || CFG.AUCTION.MIN_BID_DEFAULT)
        : product.startPrice;
      minNextEl.textContent = U.formatNumber(minNext) + ' \u0631.\u0633';
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
      hintEl.textContent = '\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649 \u0644\u0644\u0645\u0632\u0627\u064a\u062f\u0629: ' + U.formatNumber(minAmount) + ' \u0631.\u0633';
    }
  }

  function renderBidHistory(bids) {
    var listEl = document.getElementById('bidHistoryList');
    if (!listEl) return;

    if (!bids || bids.length === 0) {
      listEl.innerHTML = '<p class="bid-empty-msg">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0632\u0627\u064a\u062f\u0627\u062a \u062d\u062a\u0649 \u0627\u0644\u0622\u0646</p>';
      return;
    }

    var html = '';
    bids.forEach(function(bid, index) {
      var bidderName = bid.bidder_name || '\u0645\u0632\u0627\u064a\u062f';
      var initial = bidderName.charAt(0);
      var isTop = (index === 0);
      var timeAgo = getTimeAgo(bid.created_at);

      html += '<div class="bid-history-item' + (isTop ? ' top-bid' : '') + '">' +
        '<div class="bid-avatar">' + esc(initial) + '</div>' +
        '<div class="bid-details">' +
          '<div class="bid-bidder-name">' +
            esc(bidderName) +
            (isTop ? ' <span class="bid-top-label">\u0627\u0644\u0623\u0639\u0644\u0649</span>' : '') +
          '</div>' +
          '<div class="bid-time">' + esc(timeAgo) + '</div>' +
        '</div>' +
        '<div class="bid-amount">' + U.formatNumber(bid.amount) + ' \u0631.\u0633</div>' +
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

    if (diffSec < 60) return '\u0627\u0644\u0622\u0646';
    if (diffMin < 60) return '\u0645\u0646\u0630 ' + diffMin + ' \u062f\u0642\u064a\u0642\u0629';
    if (diffHr < 24) return '\u0645\u0646\u0630 ' + diffHr + ' \u0633\u0627\u0639\u0629';
    return '\u0645\u0646\u0630 ' + diffDay + ' \u064a\u0648\u0645';
  }

  // ===== COUNTDOWN =====
  function startCountdown() {
    if (!product.auctionEndDate) {
      // Until sold — no countdown needed
      if (product.auctionType === 'until_sold') {
        var gridEl = document.getElementById('countdownGrid');
        if (gridEl) {
          gridEl.innerHTML = '<div style="text-align:center;width:100%;padding:8px 0;color:rgba(255,255,255,0.7);font-size:0.95rem;">\u0645\u0632\u0627\u062f \u0645\u0641\u062a\u0648\u062d \u2014 \u064a\u0646\u062a\u0647\u064a \u0628\u0627\u0644\u0628\u064a\u0639</div>';
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
      _auctionEnded = true;
      clearInterval(_countdownTimer);
      stopPolling();

      document.getElementById('cdDays').textContent = '00';
      document.getElementById('cdHours').textContent = '00';
      document.getElementById('cdMinutes').textContent = '00';
      document.getElementById('cdSeconds').textContent = '00';

      // Update badge
      var badge = document.getElementById('auctionStatusBadge');
      if (badge) {
        badge.classList.add('ended');
        badge.innerHTML = '\u0627\u0646\u062a\u0647\u0649 \u0627\u0644\u0645\u0632\u0627\u062f';
      }

      // Disable bid form
      var submitBtn = document.getElementById('bidSubmitBtn');
      if (submitBtn) submitBtn.disabled = true;
      var bidInput = document.getElementById('bidAmount');
      if (bidInput) bidInput.disabled = true;

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
    _pollTimer = setInterval(function() {
      if (!_auctionEnded) {
        loadBidData();
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
  async function submitBid() {
    if (_auctionEnded) {
      SAIDAT.ui.showToast('\u0627\u0644\u0645\u0632\u0627\u062f \u0627\u0646\u062a\u0647\u0649', 'error');
      return;
    }

    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    if (!authUser) {
      SAIDAT.ui.showToast('\u064a\u062c\u0628 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0644\u0644\u0645\u0632\u0627\u064a\u062f\u0629', 'error');
      return;
    }

    // Prevent self-bidding
    if (product.sellerId && product.sellerId === authUser.id) {
      SAIDAT.ui.showToast('\u0644\u0627 \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0645\u0632\u0627\u064a\u062f\u0629 \u0639\u0644\u0649 \u0645\u0646\u062a\u062c\u0643', 'error');
      return;
    }

    var bidInput = document.getElementById('bidAmount');
    var amount = parseFloat(bidInput.value);

    if (isNaN(amount) || amount <= 0) {
      SAIDAT.ui.showToast('\u0623\u062f\u062e\u0644 \u0645\u0628\u0644\u063a \u0635\u062d\u064a\u062d', 'error');
      return;
    }

    // Validate minimum
    var minRequired = _currentHighBid > 0
      ? _currentHighBid + (product.minBid || CFG.AUCTION.MIN_BID_DEFAULT)
      : product.startPrice;

    if (amount < minRequired) {
      SAIDAT.ui.showToast('\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649 \u0644\u0644\u0645\u0632\u0627\u064a\u062f\u0629: ' + U.formatNumber(minRequired) + ' \u0631.\u0633', 'error');
      return;
    }

    // Get bidder name from profile (use auth.getRawProfile which is already loaded)
    var bidderName = '\u0645\u0632\u0627\u064a\u062f';
    try {
      var profile = SAIDAT.auth.getRawProfile();
      if (profile) {
        bidderName = profile.first_name
          ? (profile.first_name + ' ' + (profile.last_name || '')).trim()
          : (profile.store_name || '\u0645\u0632\u0627\u064a\u062f');
      }
    } catch(e) {
      console.warn('Could not load bidder profile:', e);
    }

    // Disable button during submit
    var submitBtn = document.getElementById('bidSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = '\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644...';

    try {
      var result = await SAIDAT.bids.place({
        product_id: product.id,
        bidder_name: bidderName,
        amount: amount
      });

      if (result) {
        SAIDAT.ui.showToast('\u062a\u0645 \u062a\u0642\u062f\u064a\u0645 \u0645\u0632\u0627\u064a\u062f\u062a\u0643 \u0628\u0646\u062c\u0627\u062d!', 'success');
        bidInput.value = '';
        await loadBidData(); // Refresh immediately
      } else {
        SAIDAT.ui.showToast('\u0641\u0634\u0644 \u062a\u0642\u062f\u064a\u0645 \u0627\u0644\u0645\u0632\u0627\u064a\u062f\u0629. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649', 'error');
      }
    } catch(e) {
      console.error('submitBid error:', e);
      SAIDAT.ui.showToast('\u062d\u062f\u062b \u062e\u0637\u0623. \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/></svg> \u0632\u0627\u064a\u062f \u0627\u0644\u0622\u0646';
    }
  }

  // ===== BUY NOW =====
  function buyNow() {
    if (_auctionEnded) {
      SAIDAT.ui.showToast('\u0627\u0644\u0645\u0632\u0627\u062f \u0627\u0646\u062a\u0647\u0649', 'error');
      return;
    }

    var authUser = SAIDAT.auth ? SAIDAT.auth.getAuthUser() : null;
    if (!authUser) {
      SAIDAT.ui.showToast('\u064a\u062c\u0628 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0644\u0644\u0634\u0631\u0627\u0621', 'error');
      return;
    }

    // For now, redirect to product page in fixed mode
    SAIDAT.ui.showToast('\u0645\u064a\u0632\u0629 \u0627\u0644\u0634\u0631\u0627\u0621 \u0627\u0644\u0641\u0648\u0631\u064a \u0642\u064a\u062f \u0627\u0644\u062a\u0637\u0648\u064a\u0631', 'info');
  }

  // ===== CLEANUP =====
  window.addEventListener('beforeunload', function() {
    stopPolling();
    if (_countdownTimer) {
      clearInterval(_countdownTimer);
      _countdownTimer = null;
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
    shippingCost = cost;
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
    var vat = subtotal * CFG.VAT_RATE;
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
    var vat = subtotal * CFG.VAT_RATE;
    var total = subtotal + shippingCost + vat;

    // Tabby: 4 installments
    var tabbyContainer = document.getElementById('tabbyBreakdown');
    tabbyContainer.innerHTML = '';
    var perTabby = total / 4;
    var tabbyLabels = ['\u0627\u0644\u064a\u0648\u0645', '\u0628\u0639\u062f \u0634\u0647\u0631', '\u0628\u0639\u062f \u0634\u0647\u0631\u064a\u0646', '\u0628\u0639\u062f 3 \u0623\u0634\u0647\u0631'];
    for (var i = 0; i < 4; i++) {
      tabbyContainer.innerHTML += '<div class="installment-item"><div class="inst-num">' + tabbyLabels[i] + '</div><div class="inst-amount">' + U.formatCurrencyDecimal(perTabby) + '</div></div>';
    }

    // Tamara: 30 day + 3 installments
    document.getElementById('tamara30Day').textContent = U.formatCurrencyDecimal(total);

    var perTamara = total / 3;
    document.getElementById('tamara3Inst').textContent = U.formatCurrencyDecimal(perTamara) + ' / \u0634\u0647\u0631';

    var tamaraContainer = document.getElementById('tamaraBreakdown');
    tamaraContainer.innerHTML = '';
    var tamaraLabels = ['\u0627\u0644\u064a\u0648\u0645', '\u0628\u0639\u062f \u0634\u0647\u0631', '\u0628\u0639\u062f \u0634\u0647\u0631\u064a\u0646'];
    for (var j = 0; j < 3; j++) {
      tamaraContainer.innerHTML += '<div class="installment-item"><div class="inst-num">' + tamaraLabels[j] + '</div><div class="inst-amount">' + U.formatCurrencyDecimal(perTamara) + '</div></div>';
    }
  }

  // ===== CONFIRM ORDER =====
  function confirmOrder() {
    var orderNum = 'SA-' + Math.floor(100000 + Math.random() * 900000);
    document.getElementById('orderNumber').textContent = orderNum;
    document.getElementById('successModal').classList.add('active');
  }

  // Close modal on overlay click
  document.addEventListener('click', function(e) {
    if (e.target.id === 'successModal') {
      document.getElementById('successModal').classList.remove('active');
    }
  });

  // ===== EXPOSE TO WINDOW (for onclick handlers in HTML) =====
  window.goToStep = goToStep;
  window.validateStep2 = validateStep2;
  window.selectShipping = selectShipping;
  window.toggleTerms = toggleTerms;
  window.selectPayment = selectPayment;
  window.confirmOrder = confirmOrder;
  window.submitBid = submitBid;
  window.buyNow = buyNow;

  // ===== INITIAL LOAD =====
  init();

})();
