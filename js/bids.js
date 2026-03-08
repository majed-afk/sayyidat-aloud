// ===== bids.js — وحدة المزايدات — صيدات العود =====

(function() {
  'use strict';

  var U = SAIDAT.utils;

  SAIDAT.bids = {

    /**
     * جلب مزايدات منتج معين (مرتبة من الأعلى — نشطة فقط)
     */
    getForProduct: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return [];
      try {
        var res = await sb
          .from('bids')
          .select('*')
          .eq('product_id', productId)
          .eq('status', 'active')
          .order('amount', { ascending: false });
        return res.data || [];
      } catch(e) {
        U.log('error', 'getBids error:', e);
        return [];
      }
    },

    /**
     * جلب أعلى مزايدة لمنتج (نشطة فقط)
     */
    getHighest: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return null;
      try {
        var res = await sb
          .from('bids')
          .select('*')
          .eq('product_id', productId)
          .eq('status', 'active')
          .order('amount', { ascending: false })
          .limit(1)
          .maybeSingle();
        return res.data || null;
      } catch(e) {
        U.log('error', 'getHighestBid error:', e);
        return null;
      }
    },

    /**
     * جلب عدد المزايدات لمنتج (نشطة فقط)
     */
    getCount: async function(productId) {
      var sb = U.getSupabase();
      if (!sb) return 0;
      try {
        var res = await sb
          .from('bids')
          .select('id', { count: 'exact', head: true })
          .eq('product_id', productId)
          .eq('status', 'active');
        return res.count || 0;
      } catch(e) {
        U.log('error', 'getBidCount error:', e);
        return 0;
      }
    },

    /**
     * جلب عدد المزايدات لعدة منتجات (batch — للسوق) — نشطة فقط
     */
    getCountsForProducts: async function(productIds) {
      var sb = U.getSupabase();
      if (!sb || !productIds.length) return {};
      try {
        var res = await sb
          .from('bids')
          .select('product_id')
          .in('product_id', productIds)
          .eq('status', 'active');
        var counts = {};
        (res.data || []).forEach(function(bid) {
          counts[bid.product_id] = (counts[bid.product_id] || 0) + 1;
        });
        return counts;
      } catch(e) {
        U.log('error', 'getCountsForProducts error:', e);
        return {};
      }
    },

    /**
     * جلب أعلى مزايدة لعدة منتجات (batch — للسوق) — نشطة فقط
     */
    getHighestForProducts: async function(productIds) {
      var sb = U.getSupabase();
      if (!sb || !productIds.length) return {};
      try {
        var res = await sb
          .from('bids')
          .select('product_id, amount')
          .in('product_id', productIds)
          .eq('status', 'active')
          .order('amount', { ascending: false });
        var highest = {};
        (res.data || []).forEach(function(bid) {
          if (!highest[bid.product_id]) {
            highest[bid.product_id] = bid.amount;
          }
        });
        return highest;
      } catch(e) {
        U.log('error', 'getHighestForProducts error:', e);
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
        U.log('error', 'placeBid: no supabase or no auth');
        return null;
      }
      try {
        bid.bidder_id = SAIDAT.auth.getAuthUser().id;
        bid.status = 'active';
        var res = await sb.from('bids').insert(bid).select().single();
        if (res.error) {
          U.log('error', 'placeBid DB error:', res.error.message);
          return null;
        }
        U.log('log', 'placeBid: success, id:', res.data.id);
        return res.data;
      } catch(e) {
        U.log('error', 'placeBid exception:', e);
        return null;
      }
    },

    /**
     * سحب مزايدة (soft delete — تحويل status إلى 'retracted')
     * يسمح فقط خلال 5 دقائق من وقت المزايدة
     * @param {string} bidId
     */
    retract: async function(bidId) {
      var sb = U.getSupabase();
      if (!sb || !SAIDAT.auth.getAuthUser()) {
        U.log('error', 'retractBid: no supabase or no auth');
        return false;
      }
      try {
        // جلب المزايدة للتحقق من المهلة
        var fetchRes = await sb
          .from('bids')
          .select('*')
          .eq('id', bidId)
          .eq('bidder_id', SAIDAT.auth.getAuthUser().id)
          .eq('status', 'active')
          .single();

        if (fetchRes.error || !fetchRes.data) {
          U.log('error', 'retractBid: bid not found or not yours');
          return false;
        }

        // فحص المهلة (5 دقائق)
        var bidTime = new Date(fetchRes.data.created_at);
        var now = new Date();
        var elapsed = now - bidTime;
        var retractWindow = SAIDAT.config.AUCTION.BID_RETRACT_WINDOW || 300000;

        if (elapsed > retractWindow) {
          U.log('warn', 'retractBid: retract window expired');
          return false;
        }

        // تحديث الحالة
        var updateRes = await sb
          .from('bids')
          .update({ status: 'retracted' })
          .eq('id', bidId)
          .eq('bidder_id', SAIDAT.auth.getAuthUser().id);

        if (updateRes.error) {
          U.log('error', 'retractBid DB error:', updateRes.error.message);
          return false;
        }

        U.log('log', 'retractBid: success, id:', bidId);
        return true;
      } catch(e) {
        U.log('error', 'retractBid exception:', e);
        return false;
      }
    }
  };

})();
