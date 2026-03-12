# صيدات العود — منصة العود والبخور

منصة سعودية متخصصة في بيع وشراء العود والبخور، تدعم البيع المباشر والمزادات.

مبنية بـ **Vanilla JavaScript** بدون أي bundler أو framework — تعمل مباشرة من الملفات الثابتة على Vercel.

---

## التشغيل المحلي (Runbook)

### المتطلبات
- Python 3 (للسيرفر المحلي) أو أي Static File Server
- حساب [Supabase](https://supabase.com) (قاعدة البيانات)
- حساب [Vercel](https://vercel.com) (الاستضافة)
- حساب [SMSA Express](https://www.smsaexpress.com) (الشحن — اختياري)

### تشغيل السيرفر
```bash
# الطريقة 1: Python
python3 -m http.server 8000

# الطريقة 2: Node (إذا عندك package.json)
npm run dev

# الطريقة 3: npx مباشرة
npx serve .
```
ثم افتح: `http://localhost:8000`

### Deploy على Vercel
```bash
vercel deploy --prod
```

---

## متغيرات البيئة (Vercel Environment Variables)

| المتغير | الوصف | من أين تجيبه |
|---------|-------|-------------|
| `SUPABASE_URL` | رابط مشروع Supabase | Supabase Dashboard → Settings → API |
| `SUPABASE_SERVICE_KEY` | مفتاح service_role (سري) | Supabase Dashboard → Settings → API Keys |
| `SUPABASE_ANON_KEY` | مفتاح anon (عام — في الكود) | Supabase Dashboard → Settings → API |
| `SMSA_PASS_KEY` | مفتاح API لـ SMSA Express | حساب SMSA → API Settings |
| `SMSA_SHIPPER_NAME` | اسم الشاحن | إعدادات حسابك في SMSA |
| `SMSA_SHIPPER_PHONE` | رقم هاتف الشاحن | إعدادات حسابك في SMSA |
| `SMSA_SHIPPER_CITY` | مدينة الشاحن | إعدادات حسابك في SMSA |
| `SMSA_SHIPPER_ADDR` | عنوان الشاحن | إعدادات حسابك في SMSA |

**ملاحظة:** `SUPABASE_ANON_KEY` موجود في `js/supabase.js` مباشرة (publishable key — عام). أما `SUPABASE_SERVICE_KEY` فقط في Vercel env vars (سري — يُستخدم في `api/smsa.js`).

---

## هيكل المجلدات

```
صيدات/
├── index.html          # الصفحة الرئيسية
├── market.html         # السوق (عرض المنتجات)
├── product.html        # صفحة المنتج الواحد
├── sell.html           # إنشاء إعلان بيع
├── login.html          # تسجيل الدخول / التسجيل
├── dashboard.html      # لوحة تحكم البائع
├── admin.html          # لوحة الإدارة
├── privacy.html        # سياسة الخصوصية
├── terms.html          # الشروط والأحكام
├── 404.html            # صفحة خطأ 404
├── vercel.json         # إعدادات Vercel (headers, redirects)
├── manifest.json       # PWA manifest
├── sw.js               # Service Worker (caching)
├── logo.svg            # شعار المنصة
│
├── js/                 # JavaScript modules
│   ├── supabase.js     # Supabase client init (SUPA.getClient)
│   ├── config.js       # ثوابت المنصة (SAIDAT.config)
│   ├── utils.js        # أدوات مساعدة (SAIDAT.utils)
│   ├── auth.js         # المصادقة (SAIDAT.auth)
│   ├── ui.js           # مكونات UI مشتركة (SAIDAT.ui)
│   ├── header.js       # شريط التنقل العلوي
│   ├── profiles.js     # CRUD الملفات الشخصية (SAIDAT.profiles)
│   ├── products.js     # CRUD المنتجات (SAIDAT.products)
│   ├── orders.js       # CRUD الطلبات (SAIDAT.orders)
│   ├── transactions.js # المعاملات المالية (SAIDAT.transactions)
│   ├── bids.js         # المزايدات (SAIDAT.bids)
│   ├── disputes.js     # النزاعات (SAIDAT.disputes)
│   ├── reviews.js      # التقييمات (SAIDAT.reviews)
│   ├── notifications.js# الإشعارات (SAIDAT.notifications)
│   ├── support.js      # تذاكر الدعم (SAIDAT.support)
│   ├── invoice.js      # توليد الفواتير (SAIDAT.invoice)
│   ├── image-guard.js  # حماية الصور
│   ├── index-app.js          # تطبيق الصفحة الرئيسية
│   ├── market-app.js         # تطبيق السوق
│   ├── product-app.js        # تطبيق صفحة المنتج
│   ├── sell-app.js           # تطبيق صفحة البيع
│   ├── login-app.js          # تطبيق تسجيل الدخول
│   ├── dashboard-app.js      # منسق لوحة التحكم (init, sidebar, overview)
│   ├── dashboard-products.js # المنتجات: CRUD, مزادات, عروض (SAIDAT.dashboard.products)
│   ├── dashboard-orders.js   # الطلبات: عرض, فلترة, نزاعات (SAIDAT.dashboard.orders)
│   ├── dashboard-shipping.js # الشحن: SMSA, بوالص يدوية (SAIDAT.dashboard.shipping)
│   ├── dashboard-finance.js  # المالية: رصيد, سحب (SAIDAT.dashboard.finance)
│   ├── dashboard-profile.js  # الملف الشخصي, توثيق (SAIDAT.dashboard.profile)
│   ├── dashboard-support.js  # تذاكر الدعم الفني (SAIDAT.dashboard.support)
│   └── admin-app.js          # تطبيق لوحة الإدارة
│
├── css/                # Stylesheets
│   ├── variables.css   # CSS custom properties (ألوان، خطوط)
│   ├── reset.css       # CSS reset
│   ├── layout.css      # تخطيط عام
│   ├── header.css      # شريط التنقل
│   ├── buttons.css     # أزرار
│   ├── badges.css      # شارات الحالة
│   ├── forms.css       # النماذج
│   ├── footer.css      # الفوتر
│   └── [page].css      # أنماط خاصة بكل صفحة
│
├── api/                # Vercel Serverless Functions
│   └── smsa.js         # SMSA Express shipping API (REST)
│
├── supabase/           # Database migrations
│   ├── 01_tables.sql   # الجداول الأساسية
│   ├── 02_rls_policies.sql
│   ├── ...
│   ├── 20_smsa_integration.sql
│   └── 21_smsa_security_patch.sql
│
├── icons/              # PWA icons
│   ├── icon-192.png
│   └── icon-512.png
│
└── android-twa/        # Android TWA (Trusted Web Activity)
```

---

## خريطة JavaScript — ترتيب التحميل

كل صفحة HTML تحمّل الملفات بهذا الترتيب:

```
1. supabase CDN          → window.supabase (SDK)
2. js/supabase.js        → window.SUPA (client wrapper)
3. js/config.js          → window.SAIDAT.config (ثوابت)
4. js/utils.js           → window.SAIDAT.utils (أدوات)
5. js/auth.js            → window.SAIDAT.auth (مصادقة)
6. js/ui.js              → window.SAIDAT.ui (مكونات)
7. js/header.js          → شريط التنقل
8. js/[module].js        → SAIDAT.[module] (data layer)
9. js/[page]-app.js      → تطبيق الصفحة (UI logic)
```

**مهم:** الترتيب حرج — كل ملف يعتمد على الملفات قبله.

---

## بنية قاعدة البيانات (الجداول الرئيسية)

| الجدول | الوظيفة |
|--------|---------|
| `profiles` | المستخدمون (بائعون/مشترون/أدمن) + الرصيد |
| `products` | المنتجات (بيع مباشر + مزاد) |
| `orders` | الطلبات + حالة الشحن |
| `transactions` | المعاملات المالية (بيع، عمولة، شحن، سحب) |
| `bids` | المزايدات على المنتجات |
| `disputes` | النزاعات بين البائع والمشتري |
| `reviews` | تقييمات المشترين |
| `support_tickets` | تذاكر الدعم الفني |
| `support_messages` | رسائل تذاكر الدعم |
| `admin_settings` | إعدادات الأدمن (أسعار الشحن وغيرها) |
| `shipment_reconcile_log` | سجل مصالحة الشحنات الفاشلة |

### ترحيل قاعدة البيانات (DB Migrations)
نفّذ ملفات SQL بالترتيب في Supabase SQL Editor:
```
supabase/01_tables.sql
supabase/02_rls_policies.sql
...
supabase/20_smsa_integration.sql
supabase/21_smsa_security_patch.sql
```
**كل ملف يعتمد على الملفات قبله.** لا تتخطى أي ملف.

---

## قرارات معمارية (Architecture Decisions)

### لماذا Vanilla JS بدون Framework؟
- المنصة عبارة عن صفحات ثابتة + Supabase backend
- لا حاجة لـ React/Vue — الـ DOM manipulation بسيطة
- أداء أسرع: لا build step، لا bundling overhead
- أسهل للنشر: ملفات HTML/CSS/JS مباشرة على Vercel

### لماذا IIFE؟
```javascript
(function() { 'use strict'; /* ... */ })();
```
- يمنع تلوث الـ global scope
- كل ملف معزول — المتغيرات المحلية لا تتسرب
- بديل بسيط لـ ES Modules بدون الحاجة لـ bundler

### لماذا Namespace (`SAIDAT.*`)؟
```javascript
window.SAIDAT = window.SAIDAT || {};
SAIDAT.utils = { /* ... */ };
```
- نقطة وصول واحدة لكل وحدات المشروع
- يمنع تعارض الأسماء مع مكتبات خارجية
- سهل الاستكشاف: `console.log(SAIDAT)` يعرض كل الوحدات

### لماذا بدون Bundler؟
- المشروع لا يحتاج tree-shaking أو code-splitting
- ترتيب التحميل واضح في HTML `<script>` tags
- أسهل للـ debugging: كل ملف يظهر كما هو في DevTools
- لا حاجة لـ `npm install` أو build pipeline

### لماذا Serverless Functions (api/)؟
- `api/smsa.js` يتعامل مع SMSA API باستخدام `SUPABASE_SERVICE_KEY`
- المفتاح السري لا يوجد في الـ frontend — فقط في Vercel env vars
- Vercel يحوّل الملف تلقائياً إلى serverless function

---

## أخطاء شائعة وحلولها

| الخطأ | السبب | الحل |
|-------|-------|------|
| `SAIDAT is not defined` | ملف `config.js` لم يُحمّل | تأكد من ترتيب `<script>` tags |
| `SUPA.getClient() returns null` | Supabase SDK لم يُحمّل | تأكد من وجود CDN script قبل `supabase.js` |
| `401 Unauthorized` في `/api/smsa` | `SUPABASE_SERVICE_KEY` غير مُعرّف | أضفه في Vercel env vars |
| `Failed to fetch` عند الشحن | SMSA credentials خاطئة | تحقق من `SMSA_PASS_KEY` و `SMSA_SHIPPER_*` |
| Service Worker يعرض نسخة قديمة | الكاش لم يتحدث | افتح DevTools → Application → Unregister SW |
| `cannot modify awb_number` | محاولة تعديل بوليصة مؤكدة | استخدم `cancel_shipping` RPC أولاً |

---

## المكتبات الخارجية (CDN)

| المكتبة | الاستخدام | الملف |
|---------|----------|-------|
| Supabase JS v2 | قاعدة البيانات + المصادقة | جميع الصفحات |
| jsPDF | توليد فواتير PDF | `invoice.js` |
| html2canvas | تحويل HTML إلى صورة | `invoice.js` |

---

## الترخيص

مشروع خاص — جميع الحقوق محفوظة.
