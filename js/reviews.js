// ===== reviews.js — نظام التقييمات والمراجعات — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.reviews = {

    /**
     * جلب مراجعات منتج معين
     */
    getForProduct: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('reviews')
          .select('*, profiles:reviewer_id(first_name, last_name, store_name)')
          .eq('product_id', productId)
          .eq('is_visible', true)
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'reviews.getForProduct error:', e);
        return [];
      }
    },

    /**
     * جلب مراجعات بائع معين
     */
    getForSeller: async function(sellerId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('reviews')
          .select('*, profiles:reviewer_id(first_name, last_name), products:product_id(name)')
          .eq('seller_id', sellerId)
          .eq('is_visible', true)
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'reviews.getForSeller error:', e);
        return [];
      }
    },

    /**
     * التحقق هل يمكن للمستخدم تقييم طلب معين
     * الشرط: الطلب مكتمل + لم يُقيَّم من قبل
     */
    canReview: async function(orderId) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return false;
      try {
        var res = await sb
          .from('reviews')
          .select('id', { count: 'exact', head: true })
          .eq('order_id', orderId)
          .eq('reviewer_id', SAIDAT.auth.getAuthUser().id);
        return (res.count || 0) === 0;
      } catch(e) {
        U.log('error', 'reviews.canReview error:', e);
        return false;
      }
    },

    /**
     * إرسال مراجعة جديدة
     * @param {object} review - { product_id, order_id, seller_id, rating, comment }
     */
    submit: async function(review) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) return null;
      try {
        review.reviewer_id = SAIDAT.auth.getAuthUser().id;
        var res = await sb.from('reviews').insert(review).select().single();
        if (res.error) {
          U.log('error', 'reviews.submit DB error:', res.error.message);
          return null;
        }
        return res.data;
      } catch(e) {
        U.log('error', 'reviews.submit error:', e);
        return null;
      }
    },

    /**
     * متوسط تقييم بائع
     */
    getAvgForSeller: async function(sellerId) {
      var sb = U.getSupabase();
      if (!sb) return 0;
      try {
        var res = await sb
          .from('reviews')
          .select('rating')
          .eq('seller_id', sellerId)
          .eq('is_visible', true);
        var data = res.data || [];
        if (data.length === 0) return 0;
        var sum = 0;
        data.forEach(function(r) { sum += r.rating; });
        return Math.round((sum / data.length) * 10) / 10;
      } catch(e) {
        U.log('error', 'reviews.getAvgForSeller error:', e);
        return 0;
      }
    },

    /**
     * كل المراجعات (أدمن)
     */
    getAll: async function() {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('reviews')
          .select('*, profiles:reviewer_id(first_name, last_name), products:product_id(name)')
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'reviews.getAll error:', e);
        return [];
      }
    }
  };

})();
