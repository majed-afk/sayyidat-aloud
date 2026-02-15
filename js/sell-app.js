// ===== sell-app.js — صفحة ابدأ البيع — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;
  var esc = U.escapeHtml;

  // ===== MOBILE MENU =====
  U.initMobileMenu('mobileToggle', 'mobileMenu', 'show-active');

  // ===== CATEGORY -> TYPE & UNIT DYNAMIC =====
  function onCategoryChange(value) {
    var unitSelect = document.getElementById('productUnit');
    var typeSelect = document.getElementById('productType');

    unitSelect.innerHTML = '';
    if (value === '\u062f\u0647\u0646 \u0639\u0648\u062f') {
      unitSelect.innerHTML = '<option value="\u062a\u0648\u0644\u0629">\u062a\u0648\u0644\u0629</option>';
    } else {
      unitSelect.innerHTML = '<option value="\u062c\u0631\u0627\u0645">\u062c\u0631\u0627\u0645</option>';
    }

    typeSelect.innerHTML = '';
    typeSelect.disabled = false;
    if (value === '\u0628\u062e\u0648\u0631') {
      typeSelect.innerHTML = '<option value="" disabled selected>\u0627\u062e\u062a\u0631 \u0627\u0644\u0646\u0648\u0639</option><option value="\u0637\u0628\u064a\u0639\u064a">\u0637\u0628\u064a\u0639\u064a</option><option value="\u0645\u062d\u0633\u0646">\u0645\u062d\u0633\u0646</option>';
    } else if (value === '\u062f\u0647\u0646 \u0639\u0648\u062f') {
      typeSelect.innerHTML = '<option value="" disabled selected>\u0627\u062e\u062a\u0631 \u0627\u0644\u0646\u0648\u0639</option><option value="\u0628\u064a\u0648\u0631">\u0628\u064a\u0648\u0631</option><option value="\u0645\u062e\u0644\u0637">\u0645\u062e\u0644\u0637</option>';
    }
  }

  // ===== MULTI-STEP FORM =====
  var TOTAL_STEPS = 4;
  var currentStep = 1;
  var uploadedImages = [];

  function goToStep(step) {
    document.getElementById('step-' + currentStep).classList.remove('active');

    for (var i = 1; i <= TOTAL_STEPS; i++) {
      var dot = document.getElementById('dot-' + i);
      var label = document.getElementById('label-' + i);
      dot.classList.remove('active', 'done');
      label.classList.remove('active');

      if (i < step) {
        dot.classList.add('done');
        dot.textContent = '\u2713';
      } else if (i === step) {
        dot.classList.add('active');
        dot.textContent = i;
        label.classList.add('active');
      } else {
        dot.textContent = i;
      }
    }

    for (var j = 1; j <= TOTAL_STEPS - 1; j++) {
      var line = document.getElementById('line-' + j);
      if (line) {
        if (j < step) { line.classList.add('done'); }
        else { line.classList.remove('done'); }
      }
    }

    currentStep = step;
    document.getElementById('step-' + currentStep).classList.add('active');

    if (step === 4) { buildPreview(); }

    document.getElementById('auction-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== IMAGE UPLOAD =====
  var dropZone = document.getElementById('dropZone');
  var MAX_IMAGES = 8;
  var MAX_SIZE = 5 * 1024 * 1024;

  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleImageUpload(e.dataTransfer.files);
  });

  function handleImageUpload(files) {
    Array.from(files).forEach(function(file) {
      if (uploadedImages.length >= MAX_IMAGES) return;
      if (!file.type.startsWith('image/')) return;
      if (file.size > MAX_SIZE) return;

      var reader = new FileReader();
      reader.onload = function(e) {
        uploadedImages.push(e.target.result);
        renderImageGrid();
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index) {
    uploadedImages.splice(index, 1);
    renderImageGrid();
  }

  function renderImageGrid() {
    var grid = document.getElementById('imageGrid');
    var counter = document.getElementById('imageCounter');

    if (uploadedImages.length === 0) {
      grid.innerHTML = '';
      counter.style.display = 'none';
      return;
    }

    counter.style.display = 'block';
    counter.textContent = uploadedImages.length + ' / ' + MAX_IMAGES + ' \u0635\u0648\u0631';

    grid.innerHTML = uploadedImages.map(function(src, i) {
      return '<div class="upload-grid-item ' + (i === 0 ? 'main-badge' : '') + '">' +
        '<img src="' + U.escapeHtml(src) + '" alt="\u0635\u0648\u0631\u0629 ' + (i + 1) + '">' +
        '<button class="remove-img" onclick="removeImage(' + i + ')">\u2715</button>' +
      '</div>';
    }).join('');
  }

  // ===== AUCTION TYPE TOGGLE =====
  function toggleAuctionType() {
    var val = document.querySelector('input[name="auctionType"]:checked').value;
    var isOpen = val.includes('\u0639\u0631\u0648\u0636');
    document.getElementById('minBidGroup').style.display = isOpen ? 'none' : 'block';
    document.getElementById('durationGroup').style.display = isOpen ? 'none' : 'block';
    document.getElementById('autoExtendRow').style.display = isOpen ? 'none' : 'flex';
  }

  // ===== BUILD PREVIEW =====
  function buildPreview() {
    var name = document.getElementById('productName').value || '\u0645\u0646\u062a\u062c \u0628\u062f\u0648\u0646 \u0627\u0633\u0645';
    var category = document.getElementById('productCategory').value || '-';
    var origin = document.getElementById('productOrigin').value || '-';
    var weight = document.getElementById('productWeight').value || '-';
    var unit = document.getElementById('productUnit').value || '';
    var productType = document.getElementById('productType').value || '-';
    var desc = document.getElementById('productDesc').value || '\u0644\u0627 \u064a\u0648\u062c\u062f \u0648\u0635\u0641';
    var auctionType = document.querySelector('input[name="auctionType"]:checked').value;
    var startPrice = document.getElementById('startPrice').value || '0';
    var minBid = document.getElementById('minBid').value || '-';
    var buyNow = document.getElementById('buyNowPrice').value;
    var duration = document.getElementById('auctionDuration').value;
    var freeShip = document.getElementById('freeShipping').checked;
    var autoExt = document.getElementById('autoExtend').checked;

    var safeName = esc(name);
    var safeCategory = esc(category);
    var safeOrigin = esc(origin);
    var safeWeight = esc(weight);
    var safeUnit = esc(unit);
    var safeType = esc(productType);
    var safeDesc = esc(desc);
    var safeAuctionType = esc(auctionType);

    var imgHTML = '';
    if (uploadedImages.length > 0) {
      imgHTML = '<img class="preview-main-img" src="' + uploadedImages[0] + '" alt="' + safeName + '">';
      if (uploadedImages.length > 1) {
        imgHTML += '<div class="preview-thumbs">';
        uploadedImages.slice(0, 5).forEach(function(src, i) {
          imgHTML += '<img class="preview-thumb ' + (i === 0 ? 'active' : '') + '" src="' + src + '" alt="thumb">';
        });
        imgHTML += '</div>';
      }
    } else {
      imgHTML = '<div class="preview-no-img"><span>\uD83D\uDDBC\uFE0F</span><span>\u0644\u0645 \u064a\u062a\u0645 \u0631\u0641\u0639 \u0635\u0648\u0631</span></div>';
    }

    var isOpenAuction = auctionType.includes('\u0639\u0631\u0648\u0636');

    var previewHTML = '<div class="preview-image-section">' + imgHTML + '</div>' +
      '<div class="preview-body">' +
        '<span class="preview-badge">' + safeAuctionType + '</span>' +
        '<h3 class="preview-title">' + safeName + '</h3>' +
        '<div class="preview-meta-grid">' +
          '<div class="preview-meta-item"><span>\uD83C\uDFAF</span> ' + safeCategory + '</div>' +
          '<div class="preview-meta-item"><span>\uD83C\uDF0D</span> \u0627\u0644\u0645\u0646\u0634\u0623: ' + safeOrigin + '</div>' +
          '<div class="preview-meta-item"><span>\u2696\uFE0F</span> ' + safeWeight + ' ' + safeUnit + '</div>' +
          '<div class="preview-meta-item"><span>\u2728</span> ' + safeType + '</div>' +
        '</div>' +
        '<div class="preview-price-box">' +
          '<span class="preview-price-label">\u0633\u0639\u0631 \u0627\u0644\u0628\u062f\u0627\u064a\u0629</span>' +
          '<span class="preview-price-value">' + U.formatCurrency(Number(startPrice)) + '</span>' +
        '</div>' +
        '<div class="preview-details-grid">';

    if (!isOpenAuction) {
      previewHTML += '<div class="preview-detail"><span class="preview-detail-label">\u0627\u0644\u062d\u062f \u0627\u0644\u0623\u062f\u0646\u0649 \u0644\u0644\u0645\u0632\u0627\u064a\u062f\u0629</span><span class="preview-detail-value">' + esc(minBid) + ' \u0631.\u0633</span></div>';
    }
    if (buyNow) {
      previewHTML += '<div class="preview-detail"><span class="preview-detail-label">\u0634\u0631\u0627\u0621 \u0641\u0648\u0631\u064a</span><span class="preview-detail-value">' + U.formatCurrency(Number(buyNow)) + '</span></div>';
    }
    if (!isOpenAuction) {
      previewHTML += '<div class="preview-detail"><span class="preview-detail-label">\u0645\u062f\u0629 \u0627\u0644\u0645\u0632\u0627\u062f</span><span class="preview-detail-value">' + esc(duration) + '</span></div>';
    }
    previewHTML += '<div class="preview-detail"><span class="preview-detail-label">\u0627\u0644\u0634\u062d\u0646</span><span class="preview-detail-value">' + (freeShip ? '\u0645\u062c\u0627\u0646\u064a' : '\u0639\u0644\u0649 \u0627\u0644\u0645\u0634\u062a\u0631\u064a') + '</span></div>';
    if (!isOpenAuction) {
      previewHTML += '<div class="preview-detail"><span class="preview-detail-label">\u062a\u0645\u062f\u064a\u062f \u062a\u0644\u0642\u0627\u0626\u064a</span><span class="preview-detail-value">' + (autoExt ? '\u0645\u064f\u0641\u0639\u0651\u0644' : '\u0645\u064f\u0639\u0637\u0651\u0644') + '</span></div>';
    }

    previewHTML += '</div>' +
      '<div class="preview-desc">' + safeDesc + '</div>' +
    '</div>' +
    '<div class="preview-seller-bar">' +
      '<div class="preview-seller-avatar">\u0645</div>' +
      '<div class="preview-seller-info">' +
        '<div class="preview-seller-name">\u0645\u062d\u0645\u062f \u0627\u0644\u0639\u062a\u064a\u0628\u064a</div>' +
        '<div class="preview-seller-rating">\u2B50 4.8 \u00B7 127 \u0639\u0645\u0644\u064a\u0629 \u0628\u064a\u0639</div>' +
      '</div>' +
    '</div>';

    document.getElementById('auctionPreview').innerHTML = previewHTML;
  }

  // ===== PUBLISH =====
  function publishAuction() {
    var auctionId = 'AUC-' + Math.floor(100000 + Math.random() * 900000);
    var wrapper = document.getElementById('auctionFormWrapper');

    wrapper.innerHTML = '<div class="success-state">' +
      '<span class="success-icon">\uD83C\uDF89</span>' +
      '<h2>\u062a\u0645 \u0646\u0634\u0631 \u0645\u0632\u0627\u062f\u0643 \u0628\u0646\u062c\u0627\u062d!</h2>' +
      '<p>\u0645\u0632\u0627\u062f\u0643 \u0623\u0635\u0628\u062d \u0645\u062a\u0627\u062d\u0627\u064b \u0627\u0644\u0622\u0646 \u0644\u0644\u0645\u0634\u062a\u0631\u064a\u0646. \u0633\u062a\u062a\u0644\u0642\u0649 \u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0641\u0648\u0631\u064a\u0629 \u0639\u0646\u062f \u0643\u0644 \u0645\u0632\u0627\u064a\u062f\u0629 \u062c\u062f\u064a\u062f\u0629.</p>' +
      '<div class="success-auction-id">\u0631\u0642\u0645 \u0627\u0644\u0645\u0632\u0627\u062f: ' + esc(auctionId) + '</div>' +
      '<div class="success-btns">' +
        '<a href="index.html" class="btn btn-outline">\u0627\u0644\u0639\u0648\u062f\u0629 \u0644\u0644\u0631\u0626\u064a\u0633\u064a\u0629</a>' +
        '<a href="sell.html" class="btn btn-filled">\u0625\u0646\u0634\u0627\u0621 \u0645\u0632\u0627\u062f \u0622\u062e\u0631</a>' +
      '</div>' +
    '</div>';

    document.getElementById('auction-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ===== FAQ =====
  function toggleFaq(btn) {
    var item = btn.closest('.faq-item');
    var answer = item.querySelector('.faq-answer');
    var isOpen = item.classList.contains('open');

    document.querySelectorAll('.faq-item').forEach(function(faq) {
      faq.classList.remove('open');
      faq.querySelector('.faq-answer').style.maxHeight = '0';
    });

    if (!isOpen) {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  }

  // ===== SCROLL ANIMATIONS =====
  U.initScrollAnimations('.step-card, .price-card, .faq-item');

  // ===== EXPOSE TO WINDOW (for onclick handlers in HTML) =====
  window.onCategoryChange = onCategoryChange;
  window.goToStep = goToStep;
  window.handleImageUpload = handleImageUpload;
  window.removeImage = removeImage;
  window.toggleAuctionType = toggleAuctionType;
  window.publishAuction = publishAuction;
  window.toggleFaq = toggleFaq;

})();
