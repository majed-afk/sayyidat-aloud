// ===== config.js — ثوابت منصة صيدات العود =====

window.SAIDAT = window.SAIDAT || {};

SAIDAT.config = {

  // العمولة والضريبة
  COMMISSION_RATE: 0.05,
  VAT_RATE: 0.15,

  // الحد الأدنى للسحب
  MIN_WITHDRAWAL: 100,

  // صورة المنتج الافتراضية
  DEFAULT_IMAGE: 'https://images.unsplash.com/photo-1600857544200-b2f666a9a2ec?w=400&h=300&fit=crop&q=80',

  // تكاليف الشحن
  SHIPPING: {
    STANDARD: 25,
    EXPRESS: 45,
    SAME_DAY: 75
  },

  // تسميات حالات الطلبات
  STATUS_LABELS: {
    new: 'جديد',
    processing: 'قيد المعالجة',
    shipped: 'تم الشحن',
    completed: 'مكتمل',
    cancelled: 'ملغي'
  },

  // تسميات أنواع المعاملات
  TYPE_LABELS: {
    sale: 'بيع',
    commission: 'عمولة',
    withdrawal: 'سحب'
  },

  // ثوابت المزاد
  AUCTION: {
    POLL_INTERVAL: 7000,
    MIN_BID_DEFAULT: 10,
    COUNTDOWN_UPDATE: 1000
  },

  // تسميات أنواع المزادات
  AUCTION_TYPE_LABELS: {
    timed: 'محدد بوقت',
    until_sold: 'منتهي بالبيع'
  },

  // تسميات حالات الموافقة على المنتجات
  APPROVAL_LABELS: {
    pending: 'بانتظار الموافقة',
    approved: 'معتمد',
    rejected: 'مرفوض'
  },

  // المبيعات الشهرية الافتراضية
  DEFAULT_MONTHLY_SALES: [
    { month: 'سبتمبر', amount: 0 },
    { month: 'أكتوبر', amount: 0 },
    { month: 'نوفمبر', amount: 0 },
    { month: 'ديسمبر', amount: 0 },
    { month: 'يناير', amount: 0 },
    { month: 'فبراير', amount: 0 }
  ],

  // خريطة الحقول: camelCase ↔ snake_case
  FIELD_MAP: {
    firstName: 'first_name',
    lastName: 'last_name',
    storeName: 'store_name',
    storeDesc: 'store_desc',
    bankName: 'bank_name',
    bankHolder: 'bank_holder',
    totalSales: 'total_sales',
    totalRevenue: 'total_revenue',
    merchantVerified: 'merchant_verified',
    sellerVerified: 'seller_verified',
    commercialRegister: 'commercial_register',
    completedAuctions: 'completed_auctions',
    createdAt: 'created_at',
    listingType: 'listing_type',
    startPrice: 'start_price',
    minBid: 'min_bid',
    auctionType: 'auction_type',
    auctionDuration: 'auction_duration',
    buyNow: 'buy_now',
    auctionStatus: 'auction_status',
    approvalStatus: 'approval_status',
    rejectionReason: 'rejection_reason',
    auctionStartDate: 'auction_start_date',
    auctionEndDate: 'auction_end_date',
    imageUrl: 'image_url',
    sellerId: 'seller_id',
    productId: 'product_id',
    productName: 'product_name',
    buyerName: 'buyer_name',
    buyerPhone: 'buyer_phone',
    buyerCity: 'buyer_city',
    buyerDistrict: 'buyer_district',
    buyerStreet: 'buyer_street',
    shippingMethod: 'shipping_method',
    carrierName: 'carrier_name',
    trackingNumber: 'tracking_number',
    waybillGenerated: 'waybill_generated',
    waybillDate: 'waybill_date',
    cancelReason: 'cancel_reason',
    orderId: 'order_id',
    bidderName: 'bidder_name',
    bidderId: 'bidder_id'
  }
};
