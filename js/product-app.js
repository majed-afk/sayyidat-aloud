// ===== product-app.js — صفحة شراء المنتج — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var esc = U.escapeHtml;
  var CFG = SAIDAT.config;

  // ===== HARDCODED FALLBACK DATA =====
  var fallbackProducts = [
    { id: 1, name: '\u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u0628\u0648\u0631\u0633\u0627\u062a \u0641\u0627\u062e\u0631', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0643\u0645\u0628\u0648\u062f\u064a', weight: 50, unit: '\u062c\u0631\u0627\u0645', price: 285, rating: 4.8, seller: '\u0645\u062d\u0645\u062f \u0627\u0644\u0639\u062a\u064a\u0628\u064a', verified: true, image: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=600&h=500&fit=crop&q=80', description: '\u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u0641\u0627\u062e\u0631 \u0645\u0646 \u063a\u0627\u0628\u0627\u062a \u0628\u0648\u0631\u0633\u0627\u062a \u0627\u0644\u0645\u0639\u0631\u0648\u0641\u0629 \u0628\u0631\u0627\u0626\u062d\u062a\u0647\u0627 \u0627\u0644\u062f\u0627\u0641\u0626\u0629 \u0648\u0627\u0644\u062d\u0644\u0648\u0629. \u0642\u0637\u0639 \u0645\u062e\u062a\u0627\u0631\u0629 \u0628\u0639\u0646\u0627\u064a\u0629 \u0645\u0646 \u0623\u062c\u0648\u062f \u0623\u0634\u062c\u0627\u0631 \u0627\u0644\u0639\u0648\u062f \u0627\u0644\u0643\u0645\u0628\u0648\u062f\u064a.' },
    { id: 2, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0623\u0633\u0627\u0645\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0647\u0646\u062f\u064a', weight: 1, unit: '\u062a\u0648\u0644\u0629', price: 650, rating: 4.9, seller: '\u0639\u0628\u062f\u0627\u0644\u0644\u0647 \u0627\u0644\u0634\u0645\u0631\u064a', verified: true, image: 'https://images.unsplash.com/photo-1594035910387-fea081d36b4c?w=600&h=500&fit=crop&q=80', description: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0623\u0633\u0627\u0645\u064a \u0628\u064a\u0648\u0631 \u0645\u0646 \u0648\u0644\u0627\u064a\u0629 \u0622\u0633\u0627\u0645. \u0631\u0627\u0626\u062d\u0629 \u0639\u0645\u064a\u0642\u0629 \u0648\u0645\u0639\u062a\u0642\u0629\u060c \u0645\u0646\u0627\u0633\u0628 \u0644\u0644\u0645\u0646\u0627\u0633\u0628\u0627\u062a \u0627\u0644\u062e\u0627\u0635\u0629.' },
    { id: 3, name: '\u0628\u062e\u0648\u0631 \u0644\u0627\u0648\u0633\u064a \u062c\u0628\u0644\u064a', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0644\u0627\u0648\u0633\u064a', weight: 30, unit: '\u062c\u0631\u0627\u0645', price: 195, rating: 4.7, seller: '\u062e\u0627\u0644\u062f \u0627\u0644\u062f\u0648\u0633\u0631\u064a', verified: false, image: 'https://images.unsplash.com/photo-1595535373192-fc8935bacd89?w=600&h=500&fit=crop&q=80', description: '\u0628\u062e\u0648\u0631 \u0644\u0627\u0648\u0633\u064a \u0645\u0646 \u0645\u0631\u062a\u0641\u0639\u0627\u062a \u0644\u0627\u0648\u0633 \u0627\u0644\u062c\u0628\u0644\u064a\u0629. \u0631\u0627\u0626\u062d\u0629 \u0647\u0627\u062f\u0626\u0629 \u0648\u0646\u0627\u0639\u0645\u0629 \u0645\u0639 \u0644\u0645\u0633\u0629 \u062e\u0634\u0628\u064a\u0629 \u0645\u0645\u064a\u0632\u0629.' },
    { id: 4, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u062a\u0631\u0627\u0628\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0645\u062e\u0644\u0637', origin: '\u0643\u0645\u0628\u0648\u062f\u064a', weight: 0.5, unit: '\u062a\u0648\u0644\u0629', price: 320, rating: 4.6, seller: '\u0641\u0647\u062f \u0627\u0644\u0642\u062d\u0637\u0627\u0646\u064a', verified: false, image: 'https://images.unsplash.com/photo-1547887538-e3a2f32cb1cc?w=600&h=500&fit=crop&q=80', description: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0643\u0645\u0628\u0648\u062f\u064a \u0645\u062e\u0644\u0637 \u0628\u0646\u0641\u062d\u0629 \u062a\u0631\u0627\u0628\u064a\u0629 \u0623\u0635\u064a\u0644\u0629. \u0645\u0632\u064a\u062c \u0641\u0631\u064a\u062f \u064a\u062c\u0645\u0639 \u0628\u064a\u0646 \u0627\u0644\u0639\u0645\u0642 \u0648\u0627\u0644\u0646\u0639\u0648\u0645\u0629.' },
    { id: 5, name: '\u0639\u0648\u062f \u0645\u0627\u0644\u064a\u0632\u064a \u0633\u0648\u0628\u0631', category: '\u0628\u062e\u0648\u0631', type: '\u0645\u062d\u0633\u0646', origin: '\u0645\u0627\u0644\u064a\u0632\u064a', weight: 100, unit: '\u062c\u0631\u0627\u0645', price: 150, rating: 4.5, seller: '\u0633\u0639\u062f \u0627\u0644\u0645\u0637\u064a\u0631\u064a', verified: false, image: 'https://images.unsplash.com/photo-1602836831852-ef75b5311391?w=600&h=500&fit=crop&q=80', description: '\u0639\u0648\u062f \u0645\u0627\u0644\u064a\u0632\u064a \u0645\u062d\u0633\u0646 \u0628\u062c\u0648\u062f\u0629 \u0639\u0627\u0644\u064a\u0629 \u0648\u0633\u0639\u0631 \u0645\u0646\u0627\u0633\u0628. \u0645\u062b\u0627\u0644\u064a \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u064a\u0648\u0645\u064a \u0645\u0639 \u062b\u0628\u0627\u062a \u0645\u0645\u062a\u0627\u0632.' },
    { id: 6, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0641\u064a\u062a\u0646\u0627\u0645\u064a \u062e\u0627\u0635', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0641\u064a\u062a\u0646\u0627\u0645\u064a', weight: 1, unit: '\u062a\u0648\u0644\u0629', price: 890, rating: 5.0, seller: '\u0646\u0627\u0635\u0631 \u0627\u0644\u062d\u0631\u0628\u064a', verified: true, image: 'https://images.unsplash.com/photo-1616949755610-8c9c1e378a56?w=600&h=500&fit=crop&q=80', description: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0641\u064a\u062a\u0646\u0627\u0645\u064a \u0646\u0627\u062f\u0631 \u0645\u0646 \u0627\u0644\u062f\u0631\u062c\u0629 \u0627\u0644\u0623\u0648\u0644\u0649. \u0631\u0627\u0626\u062d\u0629 \u0641\u0631\u064a\u062f\u0629 \u062a\u062c\u0645\u0639 \u0628\u064a\u0646 \u0627\u0644\u062d\u0644\u0627\u0648\u0629 \u0648\u0627\u0644\u0639\u0645\u0642 \u0627\u0644\u062e\u0634\u0628\u064a.' },
    { id: 7, name: '\u0628\u062e\u0648\u0631 \u0625\u0646\u062f\u0648\u0646\u064a\u0633\u064a \u0643\u0644\u0645\u0646\u062a\u0627\u0646', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0625\u0646\u062f\u0648\u0646\u064a\u0633\u064a', weight: 50, unit: '\u062c\u0631\u0627\u0645', price: 220, rating: 4.4, seller: '\u062a\u0631\u0643\u064a \u0627\u0644\u0639\u0646\u0632\u064a', verified: false, image: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=600&h=500&fit=crop&q=80', description: '\u0628\u062e\u0648\u0631 \u0625\u0646\u062f\u0648\u0646\u064a\u0633\u064a \u0637\u0628\u064a\u0639\u064a \u0645\u0646 \u062c\u0632\u064a\u0631\u0629 \u0643\u0644\u0645\u0646\u062a\u0627\u0646. \u0631\u0627\u0626\u062d\u0629 \u062e\u0634\u0628\u064a\u0629 \u0623\u0635\u064a\u0644\u0629 \u0645\u0639 \u0644\u0645\u062d\u0627\u062a \u062f\u062e\u0627\u0646\u064a\u0629.' },
    { id: 8, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0628\u0648\u0631\u0645\u064a \u0645\u0644\u0643\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0628\u0648\u0631\u0645\u064a', weight: 0.25, unit: '\u062a\u0648\u0644\u0629', price: 1200, rating: 4.9, seller: '\u0639\u0645\u0631 \u0627\u0644\u0633\u0628\u064a\u0639\u064a', verified: true, image: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=600&h=500&fit=crop&q=80', description: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0628\u0648\u0631\u0645\u064a \u0645\u0644\u0643\u064a \u0646\u0627\u062f\u0631 \u0627\u0644\u0648\u062c\u0648\u062f. \u0645\u0646 \u0623\u0631\u0642\u0649 \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u062f\u0647\u0646 \u0627\u0644\u0639\u0648\u062f \u0641\u064a \u0627\u0644\u0639\u0627\u0644\u0645 \u0628\u062b\u0628\u0627\u062a \u0627\u0633\u062a\u062b\u0646\u0627\u0626\u064a.' },
    { id: 9, name: '\u0639\u0648\u062f \u062a\u0627\u064a\u0644\u0646\u062f\u064a \u062a\u0631\u0627\u062a', category: '\u0628\u062e\u0648\u0631', type: '\u0645\u062d\u0633\u0646', origin: '\u062a\u0627\u064a\u0644\u0646\u062f\u064a', weight: 75, unit: '\u062c\u0631\u0627\u0645', price: 175, rating: 4.3, seller: '\u0628\u0646\u062f\u0631 \u0627\u0644\u0632\u0647\u0631\u0627\u0646\u064a', verified: false, image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&h=500&fit=crop&q=80', description: '\u0639\u0648\u062f \u062a\u0627\u064a\u0644\u0646\u062f\u064a \u0645\u0646 \u0645\u0646\u0637\u0642\u0629 \u062a\u0631\u0627\u062a \u0627\u0644\u0634\u0647\u064a\u0631\u0629. \u0628\u062e\u0648\u0631 \u0645\u062d\u0633\u0646 \u0628\u062c\u0648\u062f\u0629 \u0645\u0645\u062a\u0627\u0632\u0629 \u0648\u0631\u0627\u0626\u062d\u0629 \u0645\u0645\u064a\u0632\u0629.' },
    { id: 10, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0644\u0627\u0648\u0633\u064a \u0645\u0645\u064a\u0632', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0645\u062e\u0644\u0637', origin: '\u0644\u0627\u0648\u0633\u064a', weight: 1, unit: '\u062a\u0648\u0644\u0629', price: 480, rating: 4.7, seller: '\u0645\u0627\u062c\u062f \u0627\u0644\u063a\u0627\u0645\u062f\u064a', verified: true, image: 'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=600&h=500&fit=crop&q=80', description: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0644\u0627\u0648\u0633\u064a \u0645\u062e\u0644\u0637 \u0628\u0639\u0646\u0627\u064a\u0629 \u0641\u0627\u0626\u0642\u0629. \u0645\u0632\u064a\u062c \u0645\u062a\u0648\u0627\u0632\u0646 \u064a\u0646\u0627\u0633\u0628 \u062c\u0645\u064a\u0639 \u0627\u0644\u0623\u0630\u0648\u0627\u0642.' },
    { id: 11, name: '\u0628\u062e\u0648\u0631 \u0633\u0631\u064a\u0644\u0627\u0646\u0643\u064a \u0633\u064a\u0644\u0627\u0646\u064a', category: '\u0628\u062e\u0648\u0631', type: '\u0637\u0628\u064a\u0639\u064a', origin: '\u0633\u0631\u064a\u0644\u0627\u0646\u0643\u064a', weight: 25, unit: '\u062c\u0631\u0627\u0645', price: 340, rating: 4.8, seller: '\u064a\u0632\u064a\u062f \u0627\u0644\u0631\u0627\u0634\u062f', verified: true, image: 'https://images.unsplash.com/photo-1603204077167-2fa0397ffc8a?w=600&h=500&fit=crop&q=80', description: '\u0628\u062e\u0648\u0631 \u0633\u0631\u064a\u0644\u0627\u0646\u0643\u064a \u0633\u064a\u0644\u0627\u0646\u064a \u0646\u0627\u062f\u0631. \u0645\u0646 \u0623\u0646\u062f\u0631 \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0628\u062e\u0648\u0631 \u0641\u064a \u0627\u0644\u0639\u0627\u0644\u0645 \u0628\u0631\u0627\u0626\u062d\u0629 \u0627\u0633\u062a\u0648\u0627\u0626\u064a\u0629 \u0641\u0627\u062e\u0631\u0629.' },
    { id: 12, name: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0643\u0644\u0627\u0643\u0627\u0633\u064a', category: '\u062f\u0647\u0646 \u0639\u0648\u062f', type: '\u0628\u064a\u0648\u0631', origin: '\u0647\u0646\u062f\u064a', weight: 0.25, unit: '\u062a\u0648\u0644\u0629', price: 2100, rating: 5.0, seller: '\u0633\u0644\u0637\u0627\u0646 \u0627\u0644\u0639\u0645\u0631\u064a', verified: true, image: 'https://images.unsplash.com/photo-1617500603321-a3ee9e934eee?w=600&h=500&fit=crop&q=80', description: '\u062f\u0647\u0646 \u0639\u0648\u062f \u0647\u0646\u062f\u064a \u0643\u0644\u0627\u0643\u0627\u0633\u064a \u0645\u0646 \u0627\u0644\u062f\u0631\u062c\u0629 \u0627\u0644\u0645\u0645\u062a\u0627\u0632\u0629. \u0623\u0639\u0644\u0649 \u0645\u0631\u0627\u062a\u0628 \u062f\u0647\u0646 \u0627\u0644\u0639\u0648\u062f \u0627\u0644\u0647\u0646\u062f\u064a \u0628\u062b\u0628\u0627\u062a \u064a\u0641\u0648\u0642 24 \u0633\u0627\u0639\u0629.' }
  ];

  // ===== STATE =====
  var currentStep = 1;
  var quantity = 1;
  var shippingCost = CFG.SHIPPING.STANDARD;
  var selectedPayment = 'card';
  var product = null;

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
      verified: profile.verified || false,
      image: row.image_url || row.image || CFG.DEFAULT_IMAGE,
      description: row.description || ''
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
          product = normalizeProduct(data);
          renderProduct();
          setupEventListeners();
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
    document.getElementById('productPrice').textContent = U.formatNumber(product.price);
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

    document.title = product.name + ' | \u0635\u064a\u062f\u0627\u062a \u0627\u0644\u0639\u0648\u062f';
  }

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

  // ===== INITIAL LOAD =====
  init();

})();
