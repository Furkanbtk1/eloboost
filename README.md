# EloBoost: Premium Elo Boost Platformu

LoL, Valorant, TFT, CS2 ve Overwatch 2 için çok dilli, çoklu para birimli boost ve koçluk platformu.
Müşteri, booster ve yönetim panelleri tek bir Next.js uygulamasında çalışır.

## Teknoloji

| Katman | Seçim |
| --- | --- |
| Framework | Next.js 16.4 (App Router, Turbopack, Cache Components), React 19, TypeScript strict |
| UI | Tailwind CSS 4, shadcn/ui (Radix, `radix-nova`), lucide-react, Sonner |
| State | Zustand (UI state), TanStack Query v5 (server state) |
| i18n | next-intl 4 (`en`, `tr`, `de`, `es`), `next/root-params` ile |
| Veritabanı | PostgreSQL 17 + PgBouncer (transaction pooling), Prisma 7 (`@prisma/adapter-pg`) |
| Kimlik doğrulama | Auth.js v5 (JWT), e-posta/şifre + Discord/Google/Twitch, TOTP 2FA |
| Güvenlik | AES-256-GCM alan şifreleme, bcrypt, rate limit (Upstash / bellek), güvenlik başlıkları, Zod ile env doğrulama |
| Gerçek zamanlı | Pusher Channels (yerelde Pusher uyumlu Soketi), pusher-js |
| Dosya depolama | S3 uyumlu gizli bucket (yerelde RustFS, canlıda Cloudflare R2 veya AWS S3) |

## Kurulum

Gereksinimler: Node.js 24+, Docker Desktop.

```bash
npm install            # postinstall: prisma generate
cp .env.example .env   # ENCRYPTION_KEY ve AUTH_SECRET üret (komut dosyada)
npm run db:up          # Postgres :5433, PgBouncer :6433, Soketi :6001, RustFS :9000/:9001
npm run db:migrate     # migration'ları uygula
npm run db:seed        # örnek veriler (tüm tabloları siler!)
npm run dev            # http://localhost:3000
```

### Seed hesapları

Tüm hesapların şifresi: `Password123!`

`REQUIRE_STAFF_2FA=true` iken admin, destek, finans ve booster hesapları ilk girişte `/account/security` sayfasına
yönlendirilir ve panellerine ancak 2FA'yı (Google Authenticator, Authy vb.) kurduktan sonra girebilir. Yerelde bu adımı
atlamak için `.env` dosyasında `REQUIRE_STAFF_2FA=false` yapıp sunucuyu yeniden başlatın.

| E-posta | Rol |
| --- | --- |
| admin@eloboost.test | ADMIN (SuperAdmin) |
| support@eloboost.test | SUPPORT (SupportManager) |
| finance@eloboost.test | FINANCE (FinanceManager) |
| shadowcarry@eloboost.test | BOOSTER (aktif; LoL, TFT) |
| vandalqueen@eloboost.test | BOOSTER (aktif; Valorant, CS2) |
| newcomer@eloboost.test | BOOSTER (onay bekliyor; OW2) |
| alex@eloboost.test, elif@eloboost.test | CUSTOMER |

Seed'de her sipariş durumundan birer örnek bulunur (`ELO-10001` … `ELO-10006`): ödenmemiş, havuzda, oynanıyor,
tamamlandı (yorum + bahşiş), anlaşmazlıkta ve iptal/iade edilmiş. Bunların yanında payout talepleri, sohbet mesajları,
bildirimler ve audit log kayıtları da vardır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run dev` / `build` / `start` | Geliştirme, production build, production sunucu |
| `npm run lint` | ESLint (`any` yasak) |
| `npm test` | Birim testleri (Vitest): fiyat motoru, sipariş, sohbet, anlaşmazlık, payout, bahşiş ve RBAC kuralları |
| `npm run typecheck` | Route tiplerini üretir ve `tsc` çalıştırır |
| `npm run db:up` / `db:down` | Docker servislerini başlatır / durdurur |
| `npm run db:migrate` | Şema değişikliğinden migration üretir ve uygular |
| `npm run db:deploy` | Production'da migration uygular |
| `npm run db:seed` / `db:reset` | Seed / veritabanını sıfırla + seed |
| `npm run db:studio` | Prisma Studio |

## Proje yapısı

```
prisma/
  schema.prisma          Veri modeli (UUIDv7 anahtarlar, Decimal para alanları)
  migrations/            SQL migration'ları (CHECK kısıtları elle eklendi)
  seed.ts, seed-data/    Örnek veri ve başlangıç fiyat listeleri
messages/                Çeviriler (en.json tip kaynağıdır)
src/
  app/[locale]/          Tüm sayfalar; root layout dil segmentinin altında
  components/ui/         shadcn bileşenleri
  components/layout/     Header, footer, dil ve tema seçici
  features/<alan>/       Alan bazlı sorgu, aksiyon ve bileşenler
  i18n/                  next-intl routing, request config, navigation
  lib/                   db (Prisma), env (Zod), crypto (AES-256-GCM), action-result, rate-limit
  lib/auth/              access (rota kuralları), session (DAL), policy (2FA), totp
  lib/realtime/          Pusher kanal adları, sunucu yayını (after), istemci bağlantısı ve hook
  lib/storage.ts         S3 uyumlu gizli bucket (yükleme, akış)
  stores/                Zustand store'ları
  auth.ts                Auth.js yapılandırması (sağlayıcılar, callback'ler)
  proxy.ts               Dil yönlendirmesi + rol bazlı rota koruması (Next 16'da middleware → proxy)
```

## Kimlik doğrulama ve yetkilendirme

| Alan | Erişim | 2FA zorunlu |
| --- | --- | --- |
| `/dashboard` | CUSTOMER | Hayır |
| `/booster` | BOOSTER | Evet |
| `/admin` | ADMIN, SUPPORT, FINANCE | Evet |
| `/account/*` | Tüm giriş yapmış kullanıcılar | Hayır |

Admin paneli bölümleri de aynı kurallarla korunur (`ADMIN_SECTIONS`, `src/lib/auth/access.ts`). Yetkisi olmayan rol
`/admin` genel bakışa yönlendirilir; server action'lar rolü ayrıca kendileri de kontrol eder.

| Bölüm | ADMIN | SUPPORT | FINANCE |
| --- | --- | --- | --- |
| Genel bakış (`/admin`) | Tüm metrikler | Anlaşmazlık ve sohbet metrikleri | Payout metrikleri |
| Siparişler, anlaşmazlıklar | Okur ve karar verir | Yalnızca okur | – |
| Payout'lar | Evet | – | Evet |
| Kullanıcılar, fiyatlar, kuponlar, yorumlar, denetim kaydı | Evet | – | – |

- **İki katmanlı kontrol:** `src/proxy.ts`, JWT'ye bakarak hızlı bir ön kontrol ve yönlendirme yapar. Her korumalı sayfa
  ise `requireArea()` (`src/lib/auth/session.ts`) ile rolü, yasak durumunu ve 2FA'yı **veritabanından** yeniden doğrular.
  Kurallar tek bir yerde durur: `src/lib/auth/access.ts`.
- **Token tazeleme:** JWT, en fazla 5 dakikada bir veritabanından yenilenir. Yasaklanan bir kullanıcının oturumu bu sürede
  düşer; sayfalar ve header ise yasağı hemen uygular.
- **2FA:** TOTP gizli anahtarı kullanıcı ID'sine bağlı olarak AES-256-GCM ile şifrelenir. Doğrulamada ±30 saniyelik saat
  kaymasına izin verilir.
- **OAuth:** Bir sağlayıcının butonu, iki env değeri de doluysa görünür. Callback adresi
  `<url>/api/auth/callback/<discord|google|twitch>`. Güvenlik gereği:
  - OAuth girişi yalnızca 2FA'sı kapalı **müşteriler** içindir. Personel ve booster hesapları şifre + 2FA kullanmalıdır.
  - Mevcut bir hesaba e-posta üzerinden bağlama, yalnızca o hesabın e-postası doğrulanmışsa yapılır. Bu, başkasının
    e-postasıyla önceden hesap açıp gerçek sahibin oturumunu ele geçirmeyi ("pre-hijacking") engeller.
- **Rate limit:** Yalnızca başarısız giriş denemeleri sayılır: IP+e-posta başına 5, IP başına 30 deneme / 15 dk.
  Başarılı girişte hesap sayacı sıfırlanır. Limit `authorize` içinde uygulandığı için hem formu hem de
  `/api/auth/callback/credentials` endpoint'ini korur. Production'da Upstash zorunludur, aksi halde limitler sunucu
  örneği başınadır.
- **Hata nesnesi:** Server action'lar `{ success, message, code, fieldErrors? }` döner. Mesajlar istemcinin dilinde
  gelir ve toast ile gösterilir.

### E-posta, şifre sıfırlama ve kurtarma kodları

E-postalar Resend'in HTTP API'siyle gönderilir (`src/lib/email.ts`). `RESEND_API_KEY` yoksa geliştirmede bağlantı sunucu
konsoluna yazılır (`[email:dev]`), üretimde e-posta atlanır ve uyarı loglanır. Canlıda Resend'de alan adını doğrulayıp
`EMAIL_FROM`'u o alan adından bir adrese ayarlayın.

- **Şifre sıfırlama** (`/forgot-password`, `/reset-password`): Cevap, adres kayıtlı olsun olmasın aynıdır; böylece hangi
  e-postaların hesabı olduğu öğrenilemez. Adres başına saatte 3, IP başına saatte 10 istek. Bağlantı 1 saat geçerli ve tek
  kullanımlıktır. Yalnızca şifreli hesaplar e-posta alır. Şifre sıfırlamak 2FA'yı atlatmaz.
- **E-posta doğrulama** (`/verify-email`): Kayıtta bağlantı gönderilir (24 saat). Doğrulanmamış şifreli hesaplar panelde
  "yeniden gönder" düğmesi olan bir uyarı görür. Doğrulama giriş veya sipariş vermeyi engellemez. Bağlantı yalnızca
  sayfayı açar, düğmeye basınca harcanır: e-posta tarayıcılarının bağlantıyı önceden açması onu bozmaz.
- **Bağlantı güvenliği:** Veritabanında yalnızca SHA-256 hash'i saklanır (`VerificationToken`). Kullanılan bağlantı önce
  silinir, yeni istek eskisini geçersiz kılar.
- **2FA kurtarma kodları:** 2FA açılırken 8 kod üretilir ve yalnızca bir kez gösterilir (kopyala / indir). Her kod bir
  kez giriş yaptırır; büyük/küçük harf ve tire önemli değildir. Kodlar hash'li saklanır, harcama koşullu güncellemeyle
  yapılır. Güvenlik sayfasından, güncel bir TOTP koduyla yenileri üretilir ve eskiler geçersiz olur.
- Şifre değişince açık oturumlar JWT süresi (7 gün) dolana kadar sürebilir; yasaklama gibi anında düşmez.

## Fiyat motoru ve sipariş akışı

Hesaplayıcı `/boost/<oyun>` adresinde (ör. `/boost/league-of-legends`). Motor `src/features/pricing/engine.ts` içinde saf
bir modüldür. Tarayıcı anlık fiyat için, sunucu da her siparişi yeniden fiyatlamak için **aynı kodu** çalıştırır. Para
birimleri kuruş cinsinden tamsayı, yüzdeler baz puan (bp, %1 = 100 bp) olarak hesaplanır.

```
taban    = hizmet fiyatı + oyunun sabit ücreti (Game.basePrice)
ara top. = taban + Σ yuvarla(taban × yüzde)     (sunucu farkı, LP/RR kazancı, ek hizmetler; toplanarak uygulanır)
toplam   = ara toplam − promosyon indirimi
```

| Hizmet | Fiyat |
| --- | --- |
| Lig yükseltme (kademeli oyunlar) | Mevcut ve hedef basamak arasındaki `RankStep.divisionPrice` toplamı. İlk küme, mevcut LP/RR aralığına göre %0–60 indirimli. |
| Lig yükseltme (CS2 gibi puanlı oyunlar) | Her `RatingBracket` için (aralıktaki puan / 100) × `pricePer100` |
| Galibiyet | Mevcut ranktaki `winPrice` × galibiyet sayısı |
| Yerleştirme | Geçen sezon rankındaki `placementPrice` × maç sayısı (yalnızca kademeli oyunlar) |
| Koçluk | `Game.coachingHourlyRate` × saat |

- **Fiyat verisi** veritabanında durur (`RankStep`, `RatingBracket`, `GameServer`, `PriceModifier`, `Game`). Sayfalar bu
  veriyi `'use cache'` + `cacheTag("pricing")` ile önbelleğe alır; admin paneli (Sprint 7) fiyat değiştirdiğinde etiketi
  geçersiz kılacak. LP/RR aralık indirimleri şimdilik motorda sabit (`POINTS_BUCKETS`).
- **Manipülasyon koruması:** `createOrderAction` istemciden yalnızca seçimi alır, fiyatı asla almaz. Seçim Zod ile
  doğrulanır; bilinmeyen sunucu, seçenek veya oyunda sunulmayan hizmet reddedilir. Fiyat sunucuda yeniden hesaplanır.
  İstemcinin gördüğü toplam (`expectedTotalCents`) sunucununkiyle aynı değilse sipariş oluşturulmaz (409) ve sayfa
  güncel fiyatlarla yenilenir.
- **Para birimi:** Kurlar `open.er-api.com`'dan alınır ve Upstash Redis'te 1 saat önbelleğe alınır (Redis yoksa süreç
  belleğinde). Sağlayıcıya ulaşılamazsa `Setting.fallback_exchange_rates_usd` kullanılır. Varsayılan para birimi dile göre
  seçilir (tr → TRY, de/es → EUR, en → USD); kullanıcı değiştirebilir. Siparişte tutarlar seçilen para biriminde, o anki
  kur da `exchangeRate` olarak saklanır.
- **Booster payı:** `Setting.booster_commission_rate` (varsayılan 0,6). Booster ve platform payının toplamı her zaman
  sipariş tutarına eşittir; veritabanındaki CHECK kısıtı da bunu zorlar.
- **Promosyon kodları:** Aktiflik, son kullanma tarihi, kullanım limiti ve minimum tutar kontrol edilir. Kullanım sayacı
  ödeme alındığında artırılacak (Sprint 4); böylece ödenmemiş siparişler sınırlı kodları tüketmez. Kod sorgusu IP başına
  rate limit'lidir.
- **Akış:** Hesaplayıcı → (giriş yapılmamışsa giriş, sonra seçimler korunarak geri dönüş) → sipariş `AWAITING_PAYMENT`
  durumunda oluşturulur → `/checkout/ELO-XXXXXX`. Ödeme sayfası yalnızca siparişin sahibine görünür; diğer kullanıcılar
  404 sayfası görür.
- **Bilinmeyen oyun adresi:** Listede olmayan bir slug'ın ilk isteği PPR iskeleti akarken 200 + `noindex` 404 sayfası
  döner; sonraki istekler önbellekten gerçek 404 alır.
- **Asgari sipariş tutarı:** 1 $ (ve karşılığı). Kart sağlayıcıları çok küçük tutarları reddeder; %100'lük bir promosyon da
  ödenemeyen 0 tutarlı bir sipariş oluşturamaz.

## Ödemeler

`src/features/payments/` içinde **Payment Service Pattern** kullanılır:

| Parça | Görevi |
| --- | --- |
| `types.ts` → `PaymentProvider` | Her sağlayıcının uyguladığı arayüz: `createPayment`, `fetchStatus`, `parseWebhook` |
| `providers/*` | Stripe (kart, Apple Pay, Google Pay), Coinbase Commerce (kripto), Sandbox (yalnızca geliştirme) |
| `registry.ts` | Yapılandırılmış sağlayıcılar ve hangi para birimi/ülkede sunuldukları |
| `process.ts` → `applyPaymentUpdate` | Webhook, dönüş ve sandbox güncellemelerinin geçtiği **tek** yer |
| `/api/webhooks/[provider]` | Webhook endpoint'i (imza doğrulama sağlayıcıda) |
| `/api/payments/return` | Müşteri sağlayıcıdan dönünce ödemeyi sağlayıcıya sorar, sonra ödeme sayfasını açar |

**Akış:** Ödeme sayfası → yöntem seçimi → `startPaymentAction` (sahiplik, sipariş durumu ve yöntemin uygunluğu sunucuda
yeniden kontrol edilir) → sağlayıcının sayfası → webhook ve/veya dönüş adresi → `applyPaymentUpdate` → sipariş `PENDING`
(booster havuzu).

`applyPaymentUpdate` tek bir veritabanı işlemi içinde şunları yapar:
- İşlemi koşullu olarak `COMPLETED` yapar. Aynı olayın tekrarı ya da eşzamanlı teslimi ikinci kez işlenmez; Stripe'ın
  yeniden denemeleri bu yüzden güvenlidir.
- Ödenen tutarı ve para birimini sipariş ile karşılaştırır. Fark varsa sipariş ilerlemez, işlem `amountMismatch` ile
  inceleme için işaretlenir.
- Siparişi yalnızca `AWAITING_PAYMENT` durumundaysa `PENDING` yapar. Aynı sipariş iki sağlayıcıdan ödenirse ikinci ödeme
  `needsRefund` ile işaretlenir.
- Promosyon kullanımını **ödeme anında** ve limiti aşmadan atomik olarak artırır.
- Müşteriye bildirim oluşturur.

**Bahşişler de aynı yoldan geçer:** `TIP` türündeki bir işlem ödendiğinde `applyPaymentUpdate` tutarı booster'ın cüzdanına
aktarır. Dönüş adresi `kind=tip` ile müşteriyi ödeme sayfası yerine sipariş sayfasına götürür.

**Cüzdan:** Kullanıcı bakiyesi USD'dir. Anlaşmazlık iadeleri buraya yatar. Müşteri bakiyesiyle sipariş ödeyebilir
(`payWithWalletAction`) veya bahşiş verebilir. Bakiye kontrolü ve düşümü tek bir koşullu güncellemedir; sipariş o arada
değiştiyse düşüm de geri alınır.

**Sağlayıcı seçimi:** Bir yöntem, env değerleri doluysa ve siparişin para birimini destekliyorsa gösterilir. Ülke bilgisi
`x-vercel-ip-country` / `cf-ipcountry` başlıklarından gelir; yerelde bilinmez. Coinbase TRY ile fiyatlama yapamadığı için
TL siparişlerinde gösterilmez.

**Yerelde test:**
- **Sandbox ("Test ödemesi"):** Hiçbir hesap gerektirmez. Başarılı, başarısız ve iptal sonuçlarını simüle eder.
  `NODE_ENV=production` iken her zaman kapalıdır.
- **Stripe test modu:**
  1. `STRIPE_SECRET_KEY` (sk_test_…) değerini gir.
  2. [Stripe CLI](https://docs.stripe.com/stripe-cli) ile `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
     çalıştır ve verdiği `whsec_…` değerini `STRIPE_WEBHOOK_SECRET` olarak gir.
  3. Test kartı: `4242 4242 4242 4242`, ileri bir tarih ve herhangi bir CVC.

  Webhook gelmese bile dönüş adresi ödemeyi Stripe'a sorar.
- **Coinbase Commerce:** API anahtarı ve webhook paylaşılan sırrı gerekir. Webhook, herkese açık bir URL ister (ör. ngrok).

**Yeni sağlayıcı eklemek** (PayPal, PayTR/Iyzico, NOWPayments, Xsolla, Skrill…):
1. `providers/` altında `PaymentProvider`'ı uygulayan bir dosya yaz.
2. `registry.ts`'e ekle; para birimi ve ülke kurallarını orada belirt. Örneğin PayTR için `currencies: ["TRY"]`,
   `countries: ["TR"]`.
3. Çeviri dosyalarına `Payments.methods.<id>` ekle.

`PaymentGateway` enum'unda bu sağlayıcıların değerleri zaten hazır.

## Müşteri ve booster panelleri

Kurallar `src/features/orders/workflow.ts` içinde saf fonksiyonlar olarak tutulur ve birim testleri vardır.

**Müşteri** (`/dashboard`, `/dashboard/orders/<no>`):
- Siparişler listelenir; ödenmemiş siparişler ödeme sayfasına bağlanır.
- Detay sayfasında adım göstergesi (Booster bekleniyor → Booster atandı → Oynanıyor → Tamamlandı), booster'ın bildirdiği
  ilerleme ve booster bilgisi yer alır.
- **Hesap bilgisi kasası:**
  - Kullanıcı adı ve şifre, sipariş ID'sine bağlı olarak AES-256-GCM ile şifrelenir.
  - Şifre yalnızca yazılabilir; müşteriye bile geri gönderilmez. Boş bırakılırsa mevcut şifre korunur.
  - Bilgiler yalnızca ödeme sonrasında girilebilir ve sipariş tamamlanınca silinir.
  - Müşteri, booster'ın bilgileri hangi VPN konumundan ne zaman açtığını erişim kaydında görür.

**Booster** (`/booster`, `/booster/pool`, `/booster/orders/<no>`; 2FA zorunlu, profil `ACTIVE` olmalı):
- **Havuz:** Booster yalnızca kabul ettiği oyunlardaki, ödenmiş ve kendisine uygun siparişleri görür.
  - Uygunluk kuralı: booster'ın o oyundaki rankı, siparişin ulaştığı en yüksek rankın üstünde olmalı. Örneğin Diamond IV →
    Diamond I siparişini en az Master görür. Ladder'ın tepesindeki booster her şeyi alabilir.
  - Puanlı oyunlarda booster'ın puanı hedef puandan yüksek olmalı.
- **Claim:** Koşullu güncellemeyle yapılır; iki booster aynı anda tıklarsa yalnızca biri kazanır. Bir booster aynı anda en
  fazla 3 aktif siparişte çalışabilir (`MAX_ACTIVE_ORDERS`).
- **Durumlar:**
  - Atandı → Başlat → Oynanıyor ⇄ Duraklatıldı → Tamamlandı.
  - Atandı durumundaki sipariş havuza geri bırakılabilir.
  - Müşterinin giriş bilgileri olmadan başlatılamaz (koçluk hariç).
  - Her geçiş müşteriye bildirim oluşturur.
- **İlerleme:** Kademeli oyunlarda hedef ranka kadar bir basamak, puanlı oyunlarda puan, galibiyet/yerleştirme/koçlukta
  tamamlanan adet bildirilir.
- **"Giriş bilgilerini göster":** Yalnızca atanmış booster, yalnızca sipariş aktifken ve VPN konumu bildirildikten sonra
  kullanabilir. Her açılış IP ve tarayıcı bilgisiyle `CredentialAccessLog`'a yazılır; saatte 10 açılış sınırı vardır.
  Bilgiler ekranda 60 saniye sonra gizlenir.
- **Tamamlama:** Booster payı (`boosterCutAmount × exchangeRate`, USD) bakiyeye ve toplam kazanca eklenir, `EARNING`
  işlemi yazılır ve müşterinin giriş bilgileri silinir. Hepsi tek bir veritabanı işlemi içinde yapılır.

## Sohbet ve gerçek zamanlı bildirimler

**Nasıl çalışır:** Bir şey değiştiğinde sunucu Pusher üzerinden yalnızca bir sinyal yollar (`order-updated`,
`chat-changed`, `notification`, `pool-changed`). Tarayıcı sinyali alınca güncel veriyi bir server action ile kendisi
çeker. Bunun üç faydası var:
- Sohbet içeriği ve kişisel veriler Pusher'dan hiç geçmez.
- Yetki kontrolü tek yerde, sunucuda kalır.
- Bağlantı koptuğunda kaçan sinyaller, yeniden bağlanınca veri tekrar çekilerek telafi edilir.

Sinyaller yanıt gönderildikten sonra (`after()`) yollanır. Pusher yavaşsa veya kapalıysa işlem yine başarılı olur;
karşı taraf değişikliği sayfayı yenileyince görür.

Tüm kanallar private. `/api/realtime/auth` her abonelikte yetkiyi veritabanından kontrol eder ve yalnızca aynı
origin'den gelen istekleri kabul eder:

| Kanal | Kimler abone olabilir |
| --- | --- |
| `private-user-<id>` | Yalnızca kullanıcının kendisi (bildirim zili) |
| `private-order-<no>` | Siparişin müşterisi, mevcut booster'ı, ADMIN ve SUPPORT |
| `private-booster-pool` | Onaylı ve 2FA'sı açık booster'lar |

WebSocket bağlantısı ilk abonelikte açılır. Giriş yapmamış ziyaretçiler hiç bağlanmaz, böylece Pusher'ın bağlantı
kotası harcanmaz.

**Sohbet** (müşteri ve booster sipariş sayfalarında):
- Booster atanınca açılır. ASSIGNED, IN_PROGRESS, PAUSED ve DISPUTED durumlarında yazılabilir. Tamamlanan veya
  iptal edilen siparişte geçmiş okunabilir ama yeni mesaj yazılamaz. Siparişi havuza bırakan booster erişimini kaybeder.
- Booster müşteriyi yalnızca "Müşteri" olarak görür, adını görmez. Müşteri booster'ı adıyla görür.
- **Küfür filtresi** (`src/features/chat/moderation.ts`, TR/EN/DE/ES):
  - Eşleşen kelimeler `****` ile maskelenir ve mesaj `isFlagged` olarak işaretlenir. Veritabanına yalnızca maskelenmiş
    metin yazılır.
  - Leetspeak (`b1tch`) ve harf uzatmaları (`fuuuck`) yakalanır.
  - "sık", "Scunthorpe", "Niger", "pic" gibi masum kelimelerin yakalanmadığı testlerle doğrulanır.
- **Ekran görüntüsü:**
  - PNG, JPG veya WebP, en fazla 5 MB. Dosya türü uzantıdan değil, dosyanın ilk baytlarından belirlenir.
  - Dosyalar gizli bucket'ta `orders/<sipariş id>/<rastgele id>.<uzantı>` anahtarıyla saklanır.
  - Yalnızca `/api/attachments/<mesaj id>` üzerinden ve sohbeti okuma yetkisi olanlara verilir. Yanıt `nosniff` ve
    `sandbox` CSP başlıklarıyla döner.
- **Okundu bilgisi:** Karşı taraf sohbeti ekranda açınca mesaj okundu sayılır ve gönderen "Görüldü" yazısını görür.
- **Sınırlar:** Kullanıcı başına dakikada 30 mesaj ve saatte 20 ekran görüntüsü.

**Bildirimler:**
- Header'daki zil, okunmamış bildirim varken kırmızı nokta gösterir ve kullanıcının kanalından canlı güncellenir.
- Şu olaylar bildirim üretir: booster atanması, durum değişiklikleri, ödeme onayı, hesap bilgisi güncellemesi ve yeni
  mesaj.
- Yeni mesaj bildirimleri sipariş başına tek kayıtta toplanır ve sohbet açılınca kendiliğinden okundu olur.

**Canlı sayfalar:**
- Sipariş detay sayfaları (müşteri ve booster) durum, ilerleme, VPN erişim kaydı ve hesap bilgisi değiştiğinde
  kendini yeniler.
- Booster havuzu, bir sipariş ödendiğinde, alındığında veya havuza bırakıldığında kendini yeniler.

**Canlıya alırken:**
- Bir Pusher Channels uygulaması açın ve `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER`
  değişkenlerini doldurun. `PUSHER_HOST` ve `PUSHER_PORT` boş kalmalı.
- Dosyalar için public erişimi kapalı bir Cloudflare R2 (veya S3) bucket'ı açın ve `S3_*` değişkenlerini doldurun.
  Örnekler `.env.example` dosyasında.

## Admin paneli

Her admin işlemi aynı veritabanı işlemi içinde `AuditLog`'a yazılır: kim, ne, hangi kayıt, IP ve değişen değerler.
Kayıtlar `/admin/audit` sayfasında eylem önekine göre (ör. `payout.`) filtrelenebilir.

- **Genel bakış:** Rol bazlı metrik kartları. ADMIN için ayrıca son 14 günün günlük gelir grafiği (tablo görünümüyle)
  ve son yönetici işlemleri gösterilir. Tutarlar, siparişlerin ödeme anındaki kuruyla USD'ye çevrilir.
- **Kullanıcılar:** E-posta veya adla arama ve rol filtresi. Detay sayfasında şunlar yapılabilir:
  - Ban / ban kaldırma.
  - Rol değiştirme. Aktif siparişi olan booster'ın rolü değiştirilemez.
  - 2FA sıfırlama (telefonunu kaybeden kullanıcı için).
  - Booster profili: kabul edilen oyunlar, oyun başına doğrulanmış rank, onaylama ve askıya alma. Booster başvuruları
    listenin başında görünür.

  Yönetici kendi hesabında bu işlemleri yapamaz.
- **Siparişler:** Arama ve durum filtresi. Detay sayfasında salt okunur sohbet (filtrelenen mesajlar işaretli), işlem
  defteri, tutarlar, zaman çizelgesi ve tüm VPN erişim kaydı bulunur.
- **Fiyatlar:** Oyunun taban fiyatı, koçluk saat ücreti ve görünürlüğü; rank basamakları veya rating aralıkları; sunucu
  farkları; LP ve ek hizmet yüzdeleri. Ayrıca booster payı ve minimum payout tutarı. Kayıtlarda:
  - Önbellek etiketleri (`pricing`, `games`, `settings`) `updateTag` ile yenilenir.
  - Verilmiş siparişler ödeme anındaki fiyatlarını korur.
  - Varsayılan LP seçeneği kapatılamaz ve en az bir sunucu açık kalmalıdır. Geçersiz bir kayıtta transaction
    tamamen geri alınır.
- **Kuponlar:** Yüzdelik (en fazla %90) veya sabit indirim, kullanım limiti, son kullanma günü ve minimum tutar.
  Kuponlar açılıp kapatılabilir.
- **Yorumlar:** Herkese açık yorumları gizleme ve gösterme. Gizlenen yorum booster'ın puanına sayılmaya devam eder.

## Booster ödemeleri (payout)

`/booster/payouts`:
- **Ödeme bilgisi:** Kripto (USDT TRC20/ERC20, BTC, ETH) veya IBAN (mod-97 kontrolü). AES-256-GCM ile booster ID'sine
  bağlı olarak şifrelenir; ekranda maskelenir (`TR33 **** 1326`).
- **Talep:** Tutar en az `min_payout_amount_usd` (varsayılan 50 USD) ve en fazla bakiye kadar olabilir. Tutar talep anında
  bakiyeden düşülür; böylece aynı anda gönderilen iki talep bakiyeyi aşamaz. Aynı anda tek açık talep olabilir. Bekleyen
  talep geri çekilebilir.
- **Finans akışı:** Bekliyor → Onaylandı → Ödendi. Ödendi adımında banka veya blokzincir referansıyla bir `PAYOUT` işlemi
  yazılır; aynı referans ikinci kez kullanılamaz. Reddedilen talebin tutarı bakiyeye geri döner. Her adımda booster'a
  bildirim gider, talep oluşunca finans ekibine de.

## Anlaşmazlıklar

- Siparişin müşterisi veya booster'ı, sipariş ASSIGNED / IN_PROGRESS / PAUSED durumundayken "Sorun bildir" ile anlaşmazlık
  açabilir. Gerekçe en az 20 karakter olmalı ve küfür filtresinden geçer.
- Açılan anlaşmazlıkta sipariş `DISPUTED` (dondurulmuş) olur: booster işlem yapamaz ve giriş bilgilerini açamaz, sohbet
  açık kalır. Karşı taraf ile ADMIN/SUPPORT bildirim alır.
- Kararı yalnızca ADMIN verir (kurallar: `src/features/disputes/rules.ts`):

| Karar | Sipariş | Para |
| --- | --- | --- |
| Tam iade | `CANCELLED`, giriş bilgileri silinir | Toplam tutar müşterinin cüzdanına (`REFUND`) |
| Kısmi iade | `COMPLETED`, giriş bilgileri silinir | Seçilen tutar cüzdana; booster payı × (kalan / toplam) booster'a (`EARNING`) |
| Başka booster'a ver | `PENDING`, booster çıkarılır, havuza döner | – |
| Devam | Dondurulmadan önceki durum | – |

## Bahşiş ve yorumlar

Tamamlanan siparişin sayfasında iki kart görünür:
- **Bahşiş:** Sipariş tutarının %5, %10 veya %20'si. Cüzdandan (anında) ya da sağlayıcı üzerinden (sandbox, Stripe,
  Coinbase) ödenebilir. Bahşişin tamamı booster'a gider. Sipariş başına bir bahşiş verilebilir.
- **Yorum:** 1–5 yıldız, isteğe bağlı yorum (küfür filtresinden geçer) ve "sitede göster" seçeneği. Sipariş başına bir
  yorum yazılabilir; booster'ın ortalama puanı aynı işlemde yeniden hesaplanır.

Herkese açık yorumlar ana sayfada yalnızca ad ve soyadın baş harfiyle ("Alex C.") gösterilir. Bu bölüm önbellektedir ve
`reviews` etiketiyle yenilenir.

## SEO

- **Meta etiketleri:** Her herkese açık sayfa (ana sayfa ve oyun sayfaları) dört dilde `hreflang` + `x-default`,
  canonical, OpenGraph ve Twitter etiketleri içerir (`src/lib/seo.ts`). Paneller, ödeme ve giriş sayfaları `noindex`'tir.
- **OpenGraph görselleri:** `next/og` ile dile ve oyuna göre üretilir (`opengraph-image.tsx`). Başlangıç fiyatı gösterilir.
- **`/sitemap.xml`:** Ana sayfa ve her aktif oyun, dil alternatifleriyle.
- **`/robots.txt`:** `/api/` ile panel, ödeme ve giriş yolları her dil önekiyle engellenir.
- **JSON-LD:** Ana sayfada `Organization` + `WebSite`, oyun sayfalarında başlangıç fiyatlı `Service`.
- Taban adres `NEXT_PUBLIC_APP_URL`'den gelir; canlıda gerçek alan adı girilmelidir.

## Canlı destek

`NEXT_PUBLIC_CRISP_WEBSITE_ID` doluysa Crisp sohbet balonu, sayfa yüklendikten sonra kullanıcının diliyle yüklenir. Boşsa
hiçbir harici script yüklenmez.

## Mimari notlar

- **Bağlantı havuzu:** Uygulama `DATABASE_URL` ile PgBouncer'a, Prisma CLI ise `DIRECT_URL` ile doğrudan Postgres'e
  bağlanır (`prisma.config.ts`).
- **Şifreleme:** Oyun hesap bilgileri, 2FA secret'ları ve payout bilgileri `src/lib/crypto.ts` ile AES-256-GCM kullanılarak
  şifrelenir. Sipariş giriş bilgileri sipariş ID'sine bağlanır (AAD): şifreli değer başka bir satıra kopyalanırsa çözülemez.
  `ENCRYPTION_KEY` kaybolursa bu veriler okunamaz.
- **Para:** Sipariş tutarları siparişin para biriminde tutulur; `exchangeRate` alanı ödeme anındaki USD karşılığını saklar.
  Cüzdan bakiyeleri ve booster kazançları USD'dir. `Transaction` tablosu yalnızca ekleme yapılan (append-only) bir
  defterdir; `(gateway, gatewayTransactionId)` tekilliği webhook'ları idempotent yapar.
- **Fiyatlandırma verisi:** `RankStep` (lig/küme basamakları), `RatingBracket` (CS2 rating aralıkları), `GameServer`
  (sunucu farkı) ve `PriceModifier` (LP kazancı ve ek hizmetler). Hepsi admin panelinden düzenlenebilecek şekilde tasarlandı.
- **Önbellek:** Oyun listesi `'use cache'` + `cacheTag("games")` ile önbelleğe alınır. Admin fiyat değiştirdiğinde bu
  etiket geçersiz kılınacak.

### Spesifikasyondan bilinçli sapmalar

- `UserRole`'e RBAC için `FINANCE` eklendi. Eşleşmeler: ADMIN = SuperAdmin, SUPPORT = SupportManager, FINANCE = FinanceManager.
- `OrderStatus`'e `AWAITING_PAYMENT` (ödeme öncesi) ve `ASSIGNED` (booster atandı, henüz başlamadı) eklendi. Böylece
  müşteri stepper'ı birebir durumlara karşılık gelir.
- `TransactionType`'a `EARNING` (booster payı) ve `TIP` (bahşiş) eklendi.
- `BoosterProfile.acceptedGames`, dizi yerine `Game` ile çoktan-çoğa ilişki olarak tanımlandı (referans bütünlüğü için).
- Spesifikasyonda olmayan, ancak modüllerin ihtiyaç duyduğu ek modeller: `Account`, `VerificationToken` (Auth.js),
  `PayoutRequest`, `Dispute`, `CredentialAccessLog` ("Şifreyi Göster" logu + VPN raporu), `Notification`, `Setting`
  ve fiyat tabloları.
- Pusher'ın yanında yerel geliştirme için Pusher protokolünü konuşan Soketi kullanılır. Uygulama kodu ikisinde de aynıdır.
- Yerel S3 sunucusu olarak MinIO yerine RustFS kullanılır, çünkü MinIO 2025'te topluluk sürümünün Docker imajlarını
  yayınlamayı bıraktı.
- `Message.attachmentUrl` sütunu `attachmentKey` olarak yeniden adlandırıldı (migration `20261021011500_chat_attachment_key`).
  Sütun artık bir URL değil, gizli bucket'taki nesne anahtarını tutar.
- **İadeler müşterinin cüzdanına yapılır,** karta yapılmaz. Müşteri bu bakiyeyle yeni sipariş veya bahşiş ödeyebilir.
  Karta iade gerekiyorsa finans ekibi sağlayıcının panelinden yapar; bu işlem otomatik değildir.
- Spesifikasyondaki SupportManager "biletleri", ayrı bir destek bileti sistemi olarak değil, anlaşmazlıklar ve sipariş
  sohbetleri olarak karşılanır. Genel sorular için canlı destek (Crisp) kullanılır.
- Payout ödeme bilgileri seed'deki eski biçimden yeni biçime geçti (`method` + alanlar, booster ID'sine bağlı şifreleme).
  Seed'i daha önce çalıştırılmış bir veritabanında seed booster'larının ödeme bilgisi "yok" görünür; yeniden girilmesi
  yeterlidir.

## Bilinen ortam notları

- **Docker servisleri ve portları:** Postgres :5433, PgBouncer :6433, Soketi :6001, RustFS :9000 (S3 API) ve :9001
  (konsol: http://localhost:9001/rustfs/console/, kullanıcı `eloboost`, şifre `eloboost-secret`). `storage-init` servisi
  bucket'ı oluşturup kapanır; `docker compose ps -a` çıktısında "Exited (0)" görünmesi normaldir.

- **`@swc/core` 1.16.2'ye sabitlendi** (`package.json` → `overrides`). next-intl plugin'i bu paketi yükler. 1.16.12 ve
  sonrası native binary'yi bir önbellek klasörüne açarken üst dizinlerin ACL'ini doğrular. Bu makinede `C:\` kökünde
  `Authenticated Users: Modify` izni olduğu için yükleme başarısız oluyor. Sistem ACL'i düzeltildiğinde veya Linux CI'da
  bu override kaldırılabilir.
- **npm install script onayı:** npm 11, install script'lerini `allowScripts` listesiyle sınırlar. Yeni native bir bağımlılık
  eklendiğinde `npm install-scripts ls` ile kontrol edip `npm install-scripts approve <paket>` ile onaylayın.
- **Projeyi OneDrive (veya Dropbox vb.) içinde tutmayın.** Senkronizasyon `.next` klasörünü bozar: build
  `EPERM … unlink` hatası verir, `next dev` değişen modülleri kaçırır ("… is not a function"). Proje bu yüzden
  `C:\dev\Boost`'a taşındı. Dev sunucusu eski bir modülde takılırsa: sunucuyu durdurun, `.next\dev` klasörünü silip
  yeniden başlatın.
- **`shadcn` paketi `devDependencies`'te.** Uygulama çalışma zamanında bu paketten yalnızca bir CSS dosyası alır.
  CLI'nin bağımlılıklarındaki `braces` açığı (GHSA-vfj7-8cjw-p6xm) böylece production bağımlılıklarından çıkar.
