// ===== bids.js — وحدة المزايدات — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.bids = {

    /**
     * جلب مزايدات منتج معين (مرتبة من الأعلى)
     */
    getForProduct: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('bids')
          .select('*')
          .eq('product_id', productId)
          .order('amount', { ascending: false });
        return res.data || [];
      } catch(e) {
        console.error('getBids error:', e);
        return [];
      }
    },

    /**
     * جلب أعلى مزايدة لمنتج
     */
    getHighest: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return null;
      try {
        var res = await sb
          .from('bids')
          .select('*')
          .eq('product_id', productId)
          .order('amount', { ascending: false })
          .limit(1)
          .maybeSingle();
        return res.data || null;
      } catch(e) {
        console.error('getHighestBid error:', e);
        return null;
      }
    },

    /**
     * جلب عدد المزايدات لمنتج
     */
    getCount: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return 0;
      try {
        var res = await sb
          .from('bids')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId);
        return res.count || 0;
      } catch(e) {
        console.error('getBidCount error:', e);
        return 0;
      }
    },

    /**
     * جلب عدد المزايدات لعدة منتجات (batch — للسوق)
     */
    getCountsForProducts: async function(productIds) {
      var sb = U.getSupabase();
      if (!sb || !productIds.length) return {};
      try {
        var res = await sb
          .from('bids')
          .select('product_id')
          .in('product_id', productIds);
        var counts = {};
        (res.data || []).forEach(function(bid) {
          counts[bid.product_id] = (counts[bid.product_id] || 0) + 1;
        });
        return counts;
      } catch(e) {
        console.error('getCountsForProducts error:', e);
        return {};
      }
    },

    /**
     * جلب أعلى مزايدة لعدة منتجات (batch — للسوق)
     */
    getHighestForProducts: async function(productIds) {
      var sb = U.getSupabase();
      if (!sb || !productIds.length) return {};
      try {
        var res = await sb
          .from('bids')
          .select('product_id, amount')
          .in('product_id', productIds)
          .order('amount', { ascending: false });
        var highest = {};
        (res.data || []).forEach(function(bid) {
          if (!highest[bid.product_id]) {
            highest[bid.product_id] = bid.amount;
          }
        });
        return highest;
      } catch(e) {
        console.error('getHighestForProducts error:', e);
        return {};
      }
    },

    /**
     * إضافة مزايدة جديدة
     * @param {object} bid - { product_id, bidder_name, amount }
     */
    place: async function(bid) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) {
        console.error('placeBid: no supabase or no auth');
        return null;
      }
      try {
        bid.bidder_id = SAIDAT.auth.getAuthUser().id;
        var res = await sb.from('bids').insert(bid).select().single();
        if (res.error) {
          console.error('placeBid DB error:', res.error.message);
          return null;
        }
        console.log('placeBid: success, id:', res.data.id);
        return res.data;
      } catch(e) {
        console.error('placeBid exception:', e);
        return null;
      }
    }
  };

})();
