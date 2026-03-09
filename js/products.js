// ===== products.js — وحدة المنتجات — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.products = {

    /**
     * جلب منتجات تاجر معين
     * @param {string} [sellerId] - إذا لم يُحدد يأخذ المستخدم الحالي
     * @returns {Promise<Array>}
     */
    getForSeller: async function(sellerId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      var id = sellerId || (SAIDAT.auth.getAuthUser() ? SAIDAT.auth.getAuthUser().id : null);
      if (!id) return [];

      try {
        var res = await sb.from('products').select('*').eq('seller_id', id).order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'getForSeller error:', e);
        return [];
      }
    },

    /**
     * جلب كل المنتجات النشطة (للسوق)
     * @returns {Promise<Array>}
     */
    getAll: async function() {
      var sb = U.getSupabase();
      if (!sb) return [];

      try {
        var res = await sb
          .from('products')
          .select('*, profiles(store_name, first_name, last_name, verified)')
          .eq('active', true)
          .eq('approval_status', 'approved')
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'getAllProducts error:', e);
        return [];
      }
    },

    /**
     * جلب كل المنتجات (للأدمن — بدون فلترة)
     * @returns {Promise<Array>}
     */
    getAllAdmin: async function() {
      var sb = U.getSupabase();
      if (!sb) return [];

      try {
        var res = await sb
          .from('products')
          .select('*, profiles(store_name, first_name, last_name, id, merchant_verified, seller_verified)')
          .order('created_at', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'getAllAdmin error:', e);
        return [];
      }
    },

    /**
     * جلب منتج واحد
     * @param {string} productId
     * @returns {Promise<object|null>}
     */
    getOne: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return null;

      try {
        var res = await sb
          .from('products')
          .select('*, profiles(store_name, first_name, last_name, verified)')
          .eq('id', productId)
          .single();
        return res.data || null;
      } catch(e) {
        U.log('error', 'getProduct error:', e);
        return null;
      }
    },

    /**
     * إضافة منتج جديد
     * @param {object} product - بيانات المنتج (snake_case)
     * @returns {Promise<object|null>}
     */
    add: async function(product) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) {
        U.log('error', 'addProduct: no supabase client or no auth user');
        return null;
      }

      try {
        product.seller_id = SAIDAT.auth.getAuthUser().id;
        U.log('log', 'addProduct: inserting product: ' + product.name + ' approval: ' + product.approval_status);
        var res = await sb.from('products').insert(product).select().single();
        if (res.error) {
          U.log('error', 'addProduct DB error: ' + res.error.code + ' ' + res.error.message, res.error.details);
          SAIDAT.ui.showToast('خطأ في الحفظ: ' + res.error.message, 'error');
          return null;
        }
        U.log('log', 'addProduct: saved successfully, id:', res.data.id);
        return res.data;
      } catch(e) {
        U.log('error', 'addProduct exception:', e);
        return null;
      }
    },

    /**
     * تحديث منتج
     * @param {string} productId
     * @param {object} updates
     * @returns {Promise<boolean>}
     */
    update: async function(productId, updates) {
      var sb = U.getSupabase();
      if (!sb) return false;

      try {
        var res = await sb.from('products').update(updates).eq('id', productId);
        return !res.error;
      } catch(e) {
        U.log('error', 'updateProduct error:', e);
        return false;
      }
    },

    /**
     * حذف منتج
     * @param {string} productId
     * @returns {Promise<boolean>}
     */
    remove: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return false;

      try {
        var res = await sb.from('products').delete().eq('id', productId);
        return !res.error;
      } catch(e) {
        U.log('error', 'deleteProduct error:', e);
        return false;
      }
    },

    /**
     * إكمال شراء مزاد عبر RPC آمن (SECURITY DEFINER)
     * يتحقق من الفائز + يحدث الحالة + يزيد completed_auctions
     * @param {string} productId
     * @param {string} orderId
     * @returns {Promise<object>}
     */
    completeAuctionPurchase: async function(productId, orderId) {
      var sb = U.getSupabase();
      if (!sb) return { success: false, error: 'no_client' };

      try {
        var res = await sb.rpc('complete_auction_purchase', {
          p_product_id: productId,
          p_order_id: orderId
        });
        if (res.error) {
          U.log('error', 'completeAuctionPurchase RPC error:', res.error);
          return { success: false, error: res.error.message };
        }
        return res.data || { success: false };
      } catch(e) {
        U.log('error', 'completeAuctionPurchase exception:', e);
        return { success: false, error: e.message };
      }
    },

    /**
     * قبول عرض في مزاد مفتوح (البائع يختار فائز)
     */
    acceptOffer: async function(productId, bidderId) {
      var sb = U.getSupabase();
      if (!sb) return { success: false, error: 'no_client' };

      try {
        var res = await sb.rpc('accept_offer', {
          p_product_id: productId,
          p_bidder_id: bidderId
        });
        if (res.error) {
          U.log('error', 'acceptOffer RPC error:', res.error);
          return { success: false, error: res.error.message };
        }
        return res.data || { success: false };
      } catch(e) {
        U.log('error', 'acceptOffer exception:', e);
        return { success: false, error: e.message };
      }
    },

    /**
     * تنظيف المزادات المنتهية تلقائياً عبر RPC
     * @returns {Promise<number>} عدد المزادات التي تم إنهاؤها
     */
    autoEndExpired: async function() {
      var sb = U.getSupabase();
      if (!sb) return 0;

      try {
        var res = await sb.rpc('auto_end_expired_auctions');
        if (res.error) {
          U.log('warn', 'autoEndExpired RPC error:', res.error);
          return 0;
        }
        return res.data || 0;
      } catch(e) {
        U.log('warn', 'autoEndExpired exception:', e);
        return 0;
      }
    }
  };

})();
