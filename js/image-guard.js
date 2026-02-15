// ===== image-guard.js — فحص الصور بالذكاء الاصطناعي — صيدات العود =====
// يستخدم NSFWJS للكشف عن المحتوى غير اللائق + Canvas API لفحص الجودة
// يعمل بالكامل في المتصفح — بدون سيرفر أو تكلفة

(function() {
  'use strict';

  var model = null;
  var modelLoading = false;
  var modelReady = false;

  // ===== الحدود =====
  var THRESHOLDS = {
    // نسبة المحتوى غير اللائق المسموحة (أقل = أكثر صرامة)
    NSFW_MAX: 0.30,
    // أقل أبعاد مقبولة للصورة
    MIN_WIDTH: 200,
    MIN_HEIGHT: 200,
    // أقل حجم ملف (بالبايت) — أقل من 5KB يعني صورة رديئة
    MIN_FILE_SIZE: 5000
  };

  // ===== تحميل النموذج =====
  async function loadModel() {
    if (modelReady) return model;
    if (modelLoading) {
      // انتظار التحميل الجاري
      return new Promise(function(resolve) {
        var check = setInterval(function() {
          if (modelReady) { clearInterval(check); resolve(model); }
        }, 200);
      });
    }

    modelLoading = true;
    try {
      if (typeof nsfwjs === 'undefined') {
        console.warn('NSFWJS not loaded — skipping content check');
        modelLoading = false;
        return null;
      }
      model = await nsfwjs.load('https://cdn.jsdelivr.net/npm/nsfwjs@2/dist/model/', { size: 299 });
      modelReady = true;
      console.log('ImageGuard: NSFW model loaded');
      return model;
    } catch(e) {
      console.warn('ImageGuard: Failed to load model:', e.message);
      modelLoading = false;
      return null;
    }
  }

  // ===== فحص شامل للصورة =====
  /**
   * فحص صورة واحدة
   * @param {File|Blob|string} source — File object أو data URL string
   * @returns {Promise<{ok: boolean, issues: string[], warnings: string[]}>}
   */
  async function checkImage(source) {
    var result = { ok: true, issues: [], warnings: [] };

    try {
      // تحويل المصدر إلى Image element
      var imgEl = await sourceToImage(source);
      var fileSize = 0;

      // حجم الملف
      if (source instanceof File || source instanceof Blob) {
        fileSize = source.size;
      } else if (typeof source === 'string' && source.startsWith('data:')) {
        // تقدير حجم data URL
        fileSize = Math.round(source.length * 0.75);
      }

      // ===== 1. فحص الجودة =====
      if (imgEl.naturalWidth < THRESHOLDS.MIN_WIDTH || imgEl.naturalHeight < THRESHOLDS.MIN_HEIGHT) {
        result.warnings.push('\u0627\u0644\u0635\u0648\u0631\u0629 \u0635\u063a\u064a\u0631\u0629 \u062c\u062f\u0627\u064b (' + imgEl.naturalWidth + '\u00d7' + imgEl.naturalHeight + '). \u064a\u0641\u0636\u0651\u0644 \u0623\u0646 \u062a\u0643\u0648\u0646 \u0623\u0643\u0628\u0631 \u0645\u0646 ' + THRESHOLDS.MIN_WIDTH + '\u00d7' + THRESHOLDS.MIN_HEIGHT);
      }

      if (fileSize > 0 && fileSize < THRESHOLDS.MIN_FILE_SIZE) {
        result.warnings.push('\u062d\u062c\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u0635\u063a\u064a\u0631 \u062c\u062f\u0627\u064b \u2014 \u0642\u062f \u062a\u0643\u0648\u0646 \u0628\u062c\u0648\u062f\u0629 \u0645\u0646\u062e\u0641\u0636\u0629');
      }

      // ===== 2. فحص المحتوى غير اللائق =====
      var nsfwModel = await loadModel();
      if (nsfwModel) {
        var predictions = await nsfwModel.classify(imgEl);
        var nsfwScore = getNsfwScore(predictions);

        if (nsfwScore > THRESHOLDS.NSFW_MAX) {
          result.ok = false;
          result.issues.push('\u062a\u0645 \u0631\u0641\u0636 \u0627\u0644\u0635\u0648\u0631\u0629 \u2014 \u062a\u062d\u062a\u0648\u064a \u0639\u0644\u0649 \u0645\u062d\u062a\u0648\u0649 \u063a\u064a\u0631 \u0644\u0627\u0626\u0642');
        }
      }

    } catch(e) {
      console.warn('ImageGuard check error:', e);
      // في حالة الخطأ نسمح بالصورة — الأدمن يراجعها
      result.warnings.push('\u062a\u0639\u0630\u0651\u0631 \u0641\u062d\u0635 \u0627\u0644\u0635\u0648\u0631\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b');
    }

    return result;
  }

  // ===== فحص مجموعة صور =====
  /**
   * @param {Array<File|string>} sources
   * @returns {Promise<{ok: boolean, issues: string[], warnings: string[]}>}
   */
  async function checkImages(sources) {
    var combined = { ok: true, issues: [], warnings: [] };

    for (var i = 0; i < sources.length; i++) {
      var r = await checkImage(sources[i]);
      if (!r.ok) combined.ok = false;
      combined.issues = combined.issues.concat(r.issues);
      combined.warnings = combined.warnings.concat(r.warnings);
    }

    return combined;
  }

  // ===== استخراج نسبة المحتوى غير اللائق =====
  function getNsfwScore(predictions) {
    var score = 0;
    predictions.forEach(function(p) {
      if (p.className === 'Porn' || p.className === 'Hentai') {
        score += p.probability;
      } else if (p.className === 'Sexy') {
        score += p.probability * 0.5;
      }
    });
    return score;
  }

  // ===== تحويل المصدر إلى HTMLImageElement =====
  function sourceToImage(source) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = function() { resolve(img); };
      img.onerror = function() { reject(new Error('Failed to load image')); };

      if (source instanceof File || source instanceof Blob) {
        var reader = new FileReader();
        reader.onload = function(e) { img.src = e.target.result; };
        reader.onerror = function() { reject(new Error('Failed to read file')); };
        reader.readAsDataURL(source);
      } else if (typeof source === 'string') {
        img.src = source;
      } else {
        reject(new Error('Invalid image source'));
      }
    });
  }

  // ===== التحميل المسبق (اختياري — لتسريع أول فحص) =====
  function preload() {
    loadModel();
  }

  // ===== كشف الواجهة =====
  SAIDAT.imageGuard = {
    checkImage: checkImage,
    checkImages: checkImages,
    preload: preload,
    THRESHOLDS: THRESHOLDS
  };

})();
