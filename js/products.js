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
        console.error('getForSeller error:', e);
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
        console.error('getAllProducts error:', e);
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
        console.error('getAllAdmin error:', e);
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
          .select('*, profiles(store_name, first_name, last_name, verified, phone)')
          .eq('id', productId)
          .single();
        return res.data || null;
      } catch(e) {
        console.error('getProduct error:', e);
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
        console.error('addProduct: no supabase client or no auth user');
        return null;
      }

      try {
        product.seller_id = SAIDAT.auth.getAuthUser().id;
        console.log('addProduct: inserting product:', product.name, 'approval:', product.approval_status);
        var res = await sb.from('products').insert(product).select().single();
        if (res.error) {
          console.error('addProduct DB error:', res.error.code, res.error.message, res.error.details);
          SAIDAT.ui.showToast('خطأ في الحفظ: ' + res.error.message, 'error');
          return null;
        }
        console.log('addProduct: saved successfully, id:', res.data.id);
        return res.data;
      } catch(e) {
        console.error('addProduct exception:', e);
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
        console.error('updateProduct error:', e);
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
        console.error('deleteProduct error:', e);
        return false;
      }
    }
  };

})();
