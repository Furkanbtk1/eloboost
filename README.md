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

## Kurulum

Gereksinimler: Node.js 24+, Docker Desktop.

```bash
npm install            # postinstall: prisma generate
cp .env.example .env   # ENCRYPTION_KEY ve AUTH_SECRET üret (komut dosyada)
npm run db:up          # Postgres :5433 + PgBouncer :6433
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
| `npm test` | Birim testleri (Vitest): fiyat motoru |
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

Henüz yok (e-posta altyapısı gerekiyor): e-posta doğrulama, şifre sıfırlama, 2FA yedek kodları.

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

Henüz yok: sipariş içi sohbet (Sprint 6), payout talebi ve onayı (Sprint 7), bahşiş ve yorumlar.

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

## Bilinen ortam notları

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
