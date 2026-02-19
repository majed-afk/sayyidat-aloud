// ===== market-app.js — صفحة السوق — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var esc = U.escapeHtml;

  // ===== HARDCODED FALLBACK DATA =====
  var fallbackProducts = [
    { id: 1, name: '\u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u0628\u0648\u0631\u0633\u0627\u062a \u0641\u0627\u062e\u0631', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0643\u0645\u0628\u0648\u062f\u064a', weight: 50, unit: '\u062c\u0631\u0627\u0645', price: 285, rating: 4.8, seller: '\u0645\u062d\u0645\u062f \u0627\u0644\u0639\u062a\u064a\u0628\u064a', verified: true, badge: '\u0645\u0645\u064a\u0632', image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=300&fit=crop&q=80' },
    { id: 2, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0623\u0633\u0627\u0645\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0647\u0646\u062f\u064a', weight: 1, unit: '\u062a\u0648\u0644\u0629', price: 650, rating: 4.9, seller: '\u0639\u0628\u062f\u0627\u0644\u0644\u0647 \u0627\u0644\u0634\u0645\u0631\u064a', verified: true, badge: '\u062c\u062f\u064a\u062f', image: 'https://images.unsplash.com/photo-1594035910387-fea081d36b4c?w=400&h=300&fit=crop&q=80' },
    { id: 3, name: '\u0628\u062e\u0648\u0631 \u0644\u0627\u0648\u0633\u064a \u062c\u0628\u0644\u064a', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0644\u0627\u0648\u0633\u064a', weight: 30, unit: '\u062c\u0631\u0627\u0645', price: 195, rating: 4.7, seller: '\u062e\u0627\u0644\u062f \u0627\u0644\u062f\u0648\u0633\u0631\u064a', verified: false, badge: '', image: 'https://images.unsplash.com/photo-1595535373192-fc8935bacd89?w=400&h=300&fit=crop&q=80' },
    { id: 4, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u062a\u0631\u0627\u0628\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0645\u062e\u0644\u0637', origin: '\u0643\u0645\u0628\u0648\u062f\u064a', weight: 0.5, unit: '\u062a\u0648\u0644\u0629', price: 320, rating: 4.6, seller: '\u0641\u0647\u062f \u0627\u0644\u0642\u062d\u0637\u0627\u0646\u064a', verified: false, badge: '', image: 'https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?w=400&h=300&fit=crop&q=80' },
    { id: 5, name: '\u0639\u0648\u062f \u0645\u0627\u0644\u064a\u0632\u064a \u0633\u0648\u0628\u0631', category: '\u0628\u062e\u0648\u0631', type: '\u0645\u062d\u0633\u0646', origin: '\u0645\u0627\u0644\u064a\u0632\u064a', weight: 100, unit: '\u062c\u0631\u0627\u0645', price: 150, rating: 4.5, seller: '\u0633\u0639\u062f \u0627\u0644\u0645\u0637\u064a\u0631\u064a', verified: false, badge: '', image: 'https://images.unsplash.com/photo-1602836831852-ef75b5311391?w=400&h=300&fit=crop&q=80' },
    { id: 6, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0641\u064a\u062a\u0646\u0627\u0645\u064a \u062e\u0627\u0635', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0641\u064a\u062a\u0646\u0627\u0645\u064a', weight: 1, unit: '\u062a\u0648\u0644\u0629', price: 890, rating: 5.0, seller: '\u0646\u0627\u0635\u0631 \u0627\u0644\u062d\u0631\u0628\u064a', verified: true, badge: '\u0645\u0645\u064a\u0632', image: 'https://images.unsplash.com/photo-1616949755610-8c9c1e378a56?w=400&h=300&fit=crop&q=80' },
    { id: 7, name: '\u0628\u062e\u0648\u0631 \u0625\u0646\u062f\u0648\u0646\u064a\u0633\u064a \u0643\u0644\u0645\u0646\u062a\u0627\u0646', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0625\u0646\u062f\u0648\u0646\u064a\u0633\u064a', weight: 50, unit: '\u062c\u0631\u0627\u0645', price: 220, rating: 4.4, seller: '\u062a\u0631\u0643\u064a \u0627\u0644\u0639\u0646\u0632\u064a', verified: false, badge: '\u062c\u062f\u064a\u062f', image: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=400&h=300&fit=crop&q=80' },
    { id: 8, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0628\u0648\u0631\u0645\u064a \u0645\u0644\u0643\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0628\u0648\u0631\u0645\u064a', weight: 0.25, unit: '\u062a\u0648\u0644\u0629', price: 1200, rating: 4.9, seller: '\u0639\u0645\u0631 \u0627\u0644\u0633\u0628\u064a\u0639\u064a', verified: true, badge: '\u0645\u0645\u064a\u0632', image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=400&h=300&fit=crop&q=80' },
    { id: 9, name: '\u0639\u0648\u062f \u062a\u0627\u064a\u0644\u0646\u062f\u064a \u062a\u0631\u0627\u062a', category: '\u0628\u062e\u0648\u0631', type: '\u0645\u062d\u0633\u0646', origin: '\u062a\u0627\u064a\u0644\u0646\u062f\u064a', weight: 75, unit: '\u062c\u0631\u0627\u0645', price: 175, rating: 4.3, seller: '\u0628\u0646\u062f\u0631 \u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064a', verified: false, badge: '', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=300&fit=crop&q=80' },
    { id: 10, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0644\u0627\u0648\u0633\u064a \u0645\u0645\u064a\u0632', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0645\u062e\u0644\u0637', origin: '\u0644\u0627\u0648\u0633\u064a', weight: 1, unit: '\u062a\u0648\u0644\u0629', price: 480, rating: 4.7, seller: '\u0645\u0627\u062c\u062f \u0627\u0644\u063a\u0627\u0645\u062f\u064a', verified: true, badge: '', image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=400&h=300&fit=crop&q=80' },
    { id: 11, name: '\u0628\u062e\u0648\u0631 \u0633\u0631\u064a\u0644\u0627\u0646\u0643\u064a \u0633\u064a\u0644\u0627\u0646\u064a', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0633\u0631\u064a\u0644\u0627\u0646\u0643\u064a', weight: 25, unit: '\u062c\u0631\u0627\u0645', price: 340, rating: 4.8, seller: '\u064a\u0632\u064a\u062f \u0627\u0644\u0631\u0627\u0634\u062f', verified: true, badge: '\u062c\u062f\u064a\u062f', image: 'https://images.unsplash.com/photo-1603204077167-2fa0397ffc8a?w=400&h=300&fit=crop&q=80' },
    { id: 12, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0643\u0644\u0627\u0643\u0627\u0633\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0647\u0646\u062f\u064a', weight: 0.25, unit: '\u062a\u0648\u0644\u0629', price: 2100, rating: 5.0, seller: '\u0633\u0644\u0637\u0627\u0646 \u0627\u0644\u0639\u0645\u0631\u064a', verified: true, badge: '\u0645\u0645\u064a\u0632', image: 'https://images.unsplash.com/photo-1617500603321-a3ee9e934eee?w=400&h=300&fit=crop&q=80' }
  ];

  // ===== STATE =====
  var products = [];
  var activeCategory = '\u0627\u0644\u0643\u0644';
  var activeOrigin = '\u0627\u0644\u0643\u0644';
  var activeVerified = '\u0627\u0644\u0643\u0644';
  var searchQuery = '';
  var sortOrder = 'newest';
  var _marketTimerInterval = null;

  // ===== DOM REFS =====
  var productsGrid = document.getElementById('productsGrid');
  var resultsCount = document.getElementById('resultsCount');
  var searchInput = document.getElementById('searchInput');
  var sortSelect = document.getElementById('sortSelect');

  // ===== VERIFIED SVG =====
  var verifiedSVG = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';

  // ===== NORMALIZE SUPABASE ROW TO LOCAL FORMAT =====
  function normalizeProduct(row) {
    // If it already has the local format keys, return as-is
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
      verified: profile.verified || false,
      badge: row.badge || '',
      image: row.image_url || row.image || SAIDAT.config.DEFAULT_IMAGE,
      // Auction fields
      listingType: row.listing_type || 'fixed',
      startPrice: row.start_price || 0,
      auctionType: row.auction_type || 'timed',
      auctionEndDate: row.auction_end_date || null,
      buyNow: row.buy_now || 0,
      // Will be filled by batch bid queries
      _bidCount: row._bidCount || 0,
      _highestBid: row._highestBid || 0
    };
  }

  // ===== LOAD PRODUCTS =====
  async function loadProducts() {
    try {
      if (SAIDAT.products && typeof SAIDAT.products.getAll === 'function') {
        var data = await SAIDAT.products.getAll();
        if (data && data.length > 0) {
          products = data.map(normalizeProduct);

          // Load auction bid data (batch)
          await loadAuctionBidData();

          renderProducts();
          startMarketTimers();
          return;
        }
      }
    } catch(e) {
      console.warn('Supabase fetch failed, using fallback:', e);
    }
    // Fallback to hardcoded data
    products = fallbackProducts;
    renderProducts();
  }

  // ===== BATCH LOAD AUCTION BID DATA =====
  async function loadAuctionBidData() {
    if (!SAIDAT.bids) return;

    var auctionIds = [];
    products.forEach(function(p) {
      if (p.listingType === 'auction') {
        auctionIds.push(p.id);
      }
    });

    if (auctionIds.length === 0) return;

    try {
      var counts = await SAIDAT.bids.getCountsForProducts(auctionIds);
      var highest = await SAIDAT.bids.getHighestForProducts(auctionIds);

      products.forEach(function(p) {
        if (p.listingType === 'auction') {
          p._bidCount = counts[p.id] || 0;
          p._highestBid = highest[p.id] || 0;
        }
      });
    } catch(e) {
      console.warn('loadAuctionBidData error:', e);
    }
  }

  // ===== HELPER: Mini countdown text =====
  function getMiniCountdown(endDateStr) {
    if (!endDateStr) return '\u0645\u0632\u0627\u062f \u0645\u0641\u062a\u0648\u062d';
    var end = new Date(endDateStr);
    var now = new Date();
    var diff = end - now;

    if (diff <= 0) return '\u0627\u0646\u062a\u0647\u0649';

    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return days + ' \u064a\u0648\u0645 ' + hours + ' \u0633\u0627\u0639\u0629';
    if (hours > 0) return hours + ' \u0633\u0627\u0639\u0629 ' + minutes + ' \u062f\u0642\u064a\u0642\u0629';
    return minutes + ' \u062f\u0642\u064a\u0642\u0629';
  }

  // ===== FILTER CHIPS =====
  document.querySelectorAll('.chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var filterType = this.dataset.filter;
      var value = this.dataset.value;

      document.querySelectorAll('.chip[data-filter="' + filterType + '"]').forEach(function(c) {
        c.classList.remove('active');
      });
      this.classList.add('active');

      if (filterType === 'category') {
        activeCategory = value;
      } else if (filterType === 'origin') {
        activeOrigin = value;
      } else if (filterType === 'verified') {
        activeVerified = value;
      }

      renderProducts();
    });
  });

  // ===== SEARCH =====
  searchInput.addEventListener('input', function() {
    searchQuery = this.value.trim();
    renderProducts();
  });

  // ===== SORT =====
  sortSelect.addEventListener('change', function() {
    sortOrder = this.value;
    renderProducts();
  });

  // ===== RENDER =====
  function renderProducts() {
    var filtered = products.filter(function(p) {
      var matchCategory = activeCategory === '\u0627\u0644\u0643\u0644' || p.category === activeCategory;
      var matchOrigin = activeOrigin === '\u0627\u0644\u0643\u0644' || p.origin === activeOrigin;
      var matchVerified = activeVerified === '\u0627\u0644\u0643\u0644' || (activeVerified === '\u0645\u0648\u062b\u0642' && p.verified);
      var matchSearch = true;
      if (searchQuery) {
        var q = searchQuery.toLowerCase();
        matchSearch = p.name.toLowerCase().includes(q) ||
                      p.origin.toLowerCase().includes(q) ||
                      (p.type || '').toLowerCase().includes(q) ||
                      p.category.toLowerCase().includes(q) ||
                      p.seller.toLowerCase().includes(q);
      }
      return matchCategory && matchOrigin && matchVerified && matchSearch;
    });

    // Sort
    if (sortOrder === 'price-asc') {
      filtered.sort(function(a, b) { return a.price - b.price; });
    } else if (sortOrder === 'price-desc') {
      filtered.sort(function(a, b) { return b.price - a.price; });
    } else {
      filtered.sort(function(a, b) { return b.id - a.id; });
    }

    // Update results count
    resultsCount.textContent = '\u0639\u0631\u0636 ' + filtered.length + ' \u0645\u0646\u062a\u062c';

    // Empty state
    if (filtered.length === 0) {
      productsGrid.innerHTML = '<div class="empty-state"><span class="empty-icon">\uD83D\uDD0D</span><h3>\u0644\u0627 \u062a\u0648\u062c\u062f \u0646\u062a\u0627\u0626\u062c \u0645\u0637\u0627\u0628\u0642\u0629</h3><p>\u062c\u0631\u0651\u0628 \u062a\u063a\u064a\u064a\u0631 \u0645\u0639\u0627\u064a\u064a\u0631 \u0627\u0644\u0628\u062d\u062b \u0623\u0648 \u0627\u0644\u0641\u0644\u0627\u062a\u0631</p></div>';
      return;
    }

    var html = '';
    filtered.forEach(function(p) {
      var isAuction = (p.listingType === 'auction');

      // Badges
      var badgeHTML = '';
      if (isAuction) {
        badgeHTML = '<span class="badge badge-auction" style="background:#7C3AED;color:#fff;">\uD83D\uDD28 \u0645\u0632\u0627\u062f</span>';
      } else if (p.badge === '\u062c\u062f\u064a\u062f') {
        badgeHTML = '<span class="badge badge-new">\u062c\u062f\u064a\u062f</span>';
      } else if (p.badge === '\u0645\u0645\u064a\u0632') {
        badgeHTML = '<span class="badge badge-featured">\u0645\u0645\u064a\u0632</span>';
      }
      if (p.verified && !badgeHTML) {
        badgeHTML = '<span class="badge badge-verified">' + verifiedSVG + ' \u0645\u0648\u062b\u0642</span>';
      }

      var stars = U.starsText(p.rating);

      var verifiedHTML = '';
      if (p.verified) {
        verifiedHTML = '<span class="verified-icon"><svg viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm-1.25 17.47l-4.82-4.82 1.41-1.41 3.41 3.41 7.2-7.2 1.41 1.42-8.61 8.6z"/></svg></span>';
      }

      var safeImg = U.safeImageUrl(p.image);
      var safeName = esc(p.name);
      var safeOrigin = esc(p.origin);
      var safeType = esc(p.type);
      var safeSeller = esc(p.seller);
      var safeCategory = esc(p.category);

      // Price section — different for auctions
      var priceHTML = '';
      var btnText = '';
      var auctionMetaHTML = '';

      if (isAuction) {
        if (p._highestBid > 0) {
          priceHTML = '<div class="card-price">\u0623\u0639\u0644\u0649 \u0645\u0632\u0627\u064a\u062f\u0629: ' + U.formatCurrency(p._highestBid) + '</div>';
        } else {
          priceHTML = '<div class="card-price">\u064a\u0628\u062f\u0623 \u0645\u0646 ' + U.formatCurrency(p.startPrice) + '</div>';
        }
        btnText = '\u0632\u0627\u064a\u062f \u0627\u0644\u0622\u0646';

        // Mini countdown + bid count
        var miniTime = getMiniCountdown(p.auctionEndDate);
        auctionMetaHTML = '<div class="card-auction-meta" style="display:flex;justify-content:space-between;align-items:center;font-size:0.78rem;color:#7C3AED;padding:6px 0;margin-bottom:4px;">' +
          '<span data-auction-timer="' + esc(p.auctionEndDate || '') + '">\u23F1 ' + esc(miniTime) + '</span>' +
          '<span>' + p._bidCount + ' \u0645\u0632\u0627\u064a\u062f\u0629</span>' +
        '</div>';
      } else {
        priceHTML = '<div class="card-price">' + U.formatCurrency(p.price) + '</div>';
        btnText = '\u0627\u0634\u062a\u0631\u0650 \u0627\u0644\u0622\u0646';
      }

      html += '<a href="product.html?id=' + esc(String(p.id)) + '" class="product-card" data-id="' + esc(String(p.id)) + '">' +
        '<div class="card-image">' +
          '<img src="' + safeImg + '" alt="' + safeName + '" loading="lazy" onerror="this.style.display=\'none\';this.parentElement.style.background=\'linear-gradient(135deg,#4A2C1A,#C19A6B)\'">' +
          '<span class="badge badge-category">' + safeCategory + '</span>' +
          badgeHTML +
        '</div>' +
        '<div class="card-body">' +
          '<div class="card-name">' + safeName + '</div>' +
          '<div class="card-meta">' +
            '<span>' + safeOrigin + '</span>' +
            '<span class="separator">&middot;</span>' +
            '<span>' + safeType + '</span>' +
          '</div>' +
          '<div class="card-weight">' + esc(String(p.weight)) + ' ' + esc(p.unit) + '</div>' +
          auctionMetaHTML +
          priceHTML +
          '<div class="card-seller">' +
            '<span class="star">' + stars + '</span>' +
            '<span>' + esc(String(p.rating)) + '</span>' +
            '<span class="separator">&middot;</span>' +
            '<span>' + safeSeller + '</span>' +
            verifiedHTML +
          '</div>' +
          '<button class="card-btn"' + (isAuction ? ' style="background:#7C3AED;"' : '') + '>' + btnText + '</button>' +
        '</div>' +
      '</a>';
    });

    productsGrid.innerHTML = html;

    // Animate cards
    U.observeCardsStaggered('.product-card', 60);
  }

  // ===== MARKET MINI TIMERS UPDATE =====
  function startMarketTimers() {
    // Clear existing
    if (_marketTimerInterval) clearInterval(_marketTimerInterval);

    // Update every 60 seconds
    _marketTimerInterval = setInterval(function() {
      var timerEls = document.querySelectorAll('[data-auction-timer]');
      timerEls.forEach(function(el) {
        var endDate = el.getAttribute('data-auction-timer');
        if (endDate) {
          el.textContent = '\u23F1 ' + getMiniCountdown(endDate);
        }
      });
    }, 60000);
  }

  // ===== MOBILE MENU =====
  U.initMobileMenu('mobileToggle', 'mobileMenu', 'open');

  // ===== INITIAL LOAD =====
  loadProducts();

})();
