/**
 * Static pages linked from the footer. These are DRAFT TEMPLATES written for a
 * boosting marketplace: have a lawyer review and adapt them (company name,
 * address, jurisdiction, data processors) before launch. German and Spanish
 * fall back to English until translated.
 */

export const LEGAL_SLUGS = ["terms", "privacy", "refunds"] as const;
export const COMPANY_SLUGS = ["about", "contact"] as const;
export type InfoSlug = (typeof LEGAL_SLUGS)[number] | (typeof COMPANY_SLUGS)[number];

export type InfoPage = {
  title: string;
  description: string;
  sections: { heading: string; body: string[] }[];
};

const en: Record<InfoSlug, InfoPage> = {
  terms: {
    title: "Terms of Service",
    description: "The rules for using EloBoost: orders, accounts, payments and conduct.",
    sections: [
      {
        heading: "1. The service",
        body: [
          "EloBoost connects customers with independent boosters who improve a game account's rank or provide coaching. By placing an order or creating an account you agree to these terms.",
          "You must be at least 18 years old, or have a parent or guardian's permission, and provide accurate information.",
        ],
      },
      {
        heading: "2. Game accounts and risk",
        body: [
          "Boosting may go against a game publisher's rules. You use the service at your own risk, and the publisher may restrict or suspend an account. EloBoost is not responsible for actions taken by a publisher.",
          "Your game login is stored encrypted and is shown only to the booster assigned to your order, while the order is active. Every reveal is logged and visible to you. Never share login details outside the order page.",
        ],
      },
      {
        heading: "3. Orders and prices",
        body: [
          "The price shown at checkout is final and is recalculated on our servers. Orders start once payment is confirmed. Delivery times are estimates.",
          "Add-ons (priority, streaming, a specific role) are optional and priced as shown.",
        ],
      },
      {
        heading: "4. Payments and wallet",
        body: [
          "Payments are processed by third-party providers. Wallet balance is held in US dollars, can be used for orders and tips, and is credited when a payment is confirmed. Refunds approved by us are returned to your wallet.",
        ],
      },
      {
        heading: "5. Conduct",
        body: [
          "Be respectful in order chats. Messages are filtered, and staff can read order chats to resolve disputes. Harassment, fraud or chargeback abuse may lead to suspension.",
        ],
      },
      {
        heading: "6. Disputes",
        body: [
          "If something goes wrong, use “Report a problem” on the order. The order is paused while our team reviews it and decides on a refund, partial refund, reassignment or continuation.",
        ],
      },
      {
        heading: "7. Liability and changes",
        body: [
          "To the extent permitted by law, our liability is limited to the amount you paid for the affected order. We may update these terms; continued use means you accept the updated terms.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    description: "What data EloBoost collects, why, and the choices you have.",
    sections: [
      {
        heading: "1. Data we collect",
        body: [
          "Account data (name, email, password hash), order data (game, ranks, server, notes), game login details you choose to provide, chat messages and screenshots, payment references from our providers, and technical data such as IP address and browser for security.",
        ],
      },
      {
        heading: "2. How we use it",
        body: [
          "To fulfil orders, process payments, prevent fraud, resolve disputes, send account emails (verification, password reset) and improve the service.",
        ],
      },
      {
        heading: "3. Protection",
        body: [
          "Game logins and two-factor secrets are encrypted at rest. Passwords are hashed. Access to credentials is limited to the assigned booster and logged. Card details are handled by our payment providers and never stored by us.",
        ],
      },
      {
        heading: "4. Sharing",
        body: [
          "We share data only with providers needed to run the service (payments, email, hosting, real-time messaging, file storage) and when the law requires it. We do not sell personal data.",
        ],
      },
      {
        heading: "5. Retention",
        body: [
          "Game logins are deleted when an order ends. Order and payment records are kept as long as needed for accounting and dispute handling.",
        ],
      },
      {
        heading: "6. Your rights",
        body: [
          "You can ask to access, correct or delete your data, and to object to certain processing, by contacting support. You may also have the right to complain to your data protection authority.",
        ],
      },
    ],
  },
  refunds: {
    title: "Refund Policy",
    description: "When and how you can get your money back.",
    sections: [
      {
        heading: "1. Before an order starts",
        body: ["If no booster has taken your order yet, you can cancel and receive a full refund to your wallet."],
      },
      {
        heading: "2. After an order starts",
        body: [
          "Once a booster is working on your order, refunds are decided case by case through the dispute process. Outcomes are: a full refund, a partial refund (the booster is paid for the work done), reassignment to another booster, or continuing the order.",
        ],
      },
      {
        heading: "3. Completed orders",
        body: ["Completed orders are final. If something was not delivered as ordered, report it within 7 days."],
      },
      {
        heading: "4. How refunds are paid",
        body: [
          "Approved refunds are credited to your EloBoost wallet in US dollars and can be used for new orders and tips. Refunds to the original payment method are possible on request, at the discretion of our team and the payment provider.",
        ],
      },
      {
        heading: "5. Account penalties",
        body: [
          "Publisher penalties or bans are a risk of boosting and are not refundable unless they were caused by our booster breaking the order's rules, such as the agreed VPN or role.",
        ],
      },
    ],
  },
  about: {
    title: "About EloBoost",
    description: "Who we are and how EloBoost works.",
    sections: [
      {
        heading: "What we do",
        body: [
          "EloBoost is a rank boosting and coaching platform for League of Legends, Wild Rift, Valorant, Teamfight Tactics, Counter-Strike 2, Overwatch 2 and Marvel Rivals.",
        ],
      },
      {
        heading: "How it works",
        body: [
          "Pick a game and service, see the exact price, and pay. A verified booster takes your order, you follow progress live and chat with them, and your login is deleted when the order ends.",
        ],
      },
      {
        heading: "Our boosters",
        body: ["Every booster is manually approved and their rank in each game is verified by our team before they can take orders."],
      },
    ],
  },
  contact: {
    title: "Contact",
    description: "How to reach EloBoost support.",
    sections: [
      {
        heading: "Questions about an order",
        body: [
          "Open the order in your dashboard and use the order chat to talk to your booster. If something is wrong, use “Report a problem”: our team reviews the order and its chat.",
        ],
      },
      {
        heading: "Account or payment questions",
        body: [
          "Use the live support chat in the corner of the site when it is available, or write to us at the support email below.",
        ],
      },
    ],
  },
};

const tr: Partial<Record<InfoSlug, InfoPage>> = {
  terms: {
    title: "Kullanım Koşulları",
    description: "EloBoost'u kullanma kuralları: siparişler, hesaplar, ödemeler ve davranış.",
    sections: [
      {
        heading: "1. Hizmet",
        body: [
          "EloBoost, müşterileri oyun hesabının rankını yükselten veya koçluk veren bağımsız booster'larla buluşturur. Sipariş vererek veya hesap açarak bu koşulları kabul edersin.",
          "En az 18 yaşında olmalı (veya ebeveyn izni almalı) ve doğru bilgi vermelisin.",
        ],
      },
      {
        heading: "2. Oyun hesapları ve risk",
        body: [
          "Boosting, bir oyun yayıncısının kurallarına aykırı olabilir. Hizmeti kendi sorumluluğunda kullanırsın; yayıncı hesabı kısıtlayabilir veya askıya alabilir. Yayıncının aldığı kararlardan EloBoost sorumlu değildir.",
          "Oyun giriş bilgilerin şifreli saklanır ve yalnızca siparişe atanan booster'a, sipariş aktifken gösterilir. Her görüntüleme kaydedilir ve sana gösterilir. Giriş bilgilerini sipariş sayfası dışında kimseyle paylaşma.",
        ],
      },
      {
        heading: "3. Siparişler ve fiyatlar",
        body: [
          "Ödeme ekranındaki fiyat nihaidir ve sunucularımızda yeniden hesaplanır. Sipariş, ödeme onaylanınca başlar. Teslim süreleri tahminidir.",
          "Ek hizmetler (öncelik, yayın, belirli rol) isteğe bağlıdır ve gösterildiği gibi fiyatlanır.",
        ],
      },
      {
        heading: "4. Ödemeler ve cüzdan",
        body: [
          "Ödemeler üçüncü taraf sağlayıcılarla işlenir. Cüzdan bakiyesi ABD doları cinsindendir, sipariş ve bahşiş için kullanılabilir ve ödeme onaylanınca yüklenir. Onayladığımız iadeler cüzdanına yapılır.",
        ],
      },
      {
        heading: "5. Davranış",
        body: [
          "Sipariş sohbetlerinde saygılı ol. Mesajlar filtrelenir ve ekibimiz anlaşmazlıkları çözmek için sohbetleri okuyabilir. Taciz, dolandırıcılık veya geri ödeme (chargeback) suistimali hesabın askıya alınmasına yol açabilir.",
        ],
      },
      {
        heading: "6. Anlaşmazlıklar",
        body: [
          "Bir sorun olursa siparişteki “Sorun bildir” düğmesini kullan. Ekibimiz inceleyene kadar sipariş durdurulur; tam iade, kısmi iade, başka booster'a atama veya devam kararı verilir.",
        ],
      },
      {
        heading: "7. Sorumluluk ve değişiklikler",
        body: [
          "Yasaların izin verdiği ölçüde sorumluluğumuz, etkilenen sipariş için ödediğin tutarla sınırlıdır. Bu koşulları güncelleyebiliriz; kullanmaya devam etmen güncel koşulları kabul ettiğin anlamına gelir.",
        ],
      },
    ],
  },
  privacy: {
    title: "Gizlilik Politikası",
    description: "EloBoost hangi verileri neden topluyor ve hangi seçeneklerin var.",
    sections: [
      {
        heading: "1. Topladığımız veriler",
        body: [
          "Hesap verileri (ad, e-posta, şifre özeti), sipariş verileri (oyun, rank, sunucu, notlar), vermeyi seçtiğin oyun giriş bilgileri, sohbet mesajları ve ekran görüntüleri, ödeme sağlayıcılarından gelen ödeme referansları ve güvenlik için IP adresi, tarayıcı gibi teknik veriler.",
        ],
      },
      {
        heading: "2. Nasıl kullanıyoruz",
        body: [
          "Siparişleri yerine getirmek, ödemeleri işlemek, dolandırıcılığı önlemek, anlaşmazlıkları çözmek, hesap e-postaları göndermek (doğrulama, şifre sıfırlama) ve hizmeti geliştirmek için.",
        ],
      },
      {
        heading: "3. Koruma",
        body: [
          "Oyun giriş bilgileri ve iki adımlı doğrulama anahtarları şifreli saklanır. Şifreler özetlenerek tutulur. Giriş bilgilerine erişim atanan booster ile sınırlıdır ve kaydedilir. Kart bilgilerini ödeme sağlayıcılarımız işler, biz saklamayız.",
        ],
      },
      {
        heading: "4. Paylaşım",
        body: [
          "Verileri yalnızca hizmeti yürütmek için gereken sağlayıcılarla (ödeme, e-posta, barındırma, anlık mesajlaşma, dosya depolama) ve yasal zorunluluk halinde paylaşırız. Kişisel verileri satmayız.",
        ],
      },
      {
        heading: "5. Saklama",
        body: [
          "Oyun giriş bilgileri sipariş bitince silinir. Sipariş ve ödeme kayıtları muhasebe ve anlaşmazlık süreçleri için gereken süre kadar tutulur.",
        ],
      },
      {
        heading: "6. Haklarınız",
        body: [
          "Verilerine erişmek, düzeltmek veya silmek ve bazı işlemelere itiraz etmek için destek ekibiyle iletişime geçebilirsin. Veri koruma otoritene şikâyette bulunma hakkın da olabilir.",
        ],
      },
    ],
  },
  refunds: {
    title: "İade Politikası",
    description: "Paranı ne zaman ve nasıl geri alabilirsin.",
    sections: [
      {
        heading: "1. Sipariş başlamadan önce",
        body: ["Henüz bir booster siparişini almadıysa iptal edebilir ve cüzdanına tam iade alabilirsin."],
      },
      {
        heading: "2. Sipariş başladıktan sonra",
        body: [
          "Bir booster siparişin üzerinde çalışmaya başladıktan sonra iadeler anlaşmazlık süreciyle tek tek karara bağlanır. Sonuçlar: tam iade, kısmi iade (booster yapılan işin karşılığını alır), başka booster'a atama veya siparişe devam.",
        ],
      },
      {
        heading: "3. Tamamlanan siparişler",
        body: ["Tamamlanan siparişler kesindir. Sipariş edildiği gibi teslim edilmeyen bir şey olursa 7 gün içinde bildir."],
      },
      {
        heading: "4. İadeler nasıl ödenir",
        body: [
          "Onaylanan iadeler EloBoost cüzdanına ABD doları olarak yatar ve yeni sipariş veya bahşiş için kullanılabilir. İlk ödeme yöntemine iade, ekibimizin ve ödeme sağlayıcısının takdiriyle talep üzerine mümkündür.",
        ],
      },
      {
        heading: "5. Hesap cezaları",
        body: [
          "Yayıncı cezaları veya banlar boosting'in riskidir; booster'ımızın sipariş kurallarını (anlaşılan VPN veya rol gibi) ihlal etmesinden kaynaklanmadıkça iade edilmez.",
        ],
      },
    ],
  },
  about: {
    title: "EloBoost Hakkında",
    description: "Biz kimiz ve EloBoost nasıl çalışır.",
    sections: [
      {
        heading: "Ne yapıyoruz",
        body: [
          "EloBoost; League of Legends, Wild Rift, Valorant, Teamfight Tactics, Counter-Strike 2, Overwatch 2 ve Marvel Rivals için rank boosting ve koçluk platformudur.",
        ],
      },
      {
        heading: "Nasıl çalışır",
        body: [
          "Oyunu ve hizmeti seç, net fiyatı gör ve öde. Onaylı bir booster siparişini alır, ilerlemeyi canlı takip eder ve onunla sohbet edersin; sipariş bitince giriş bilgilerin silinir.",
        ],
      },
      {
        heading: "Booster'larımız",
        body: ["Her booster elle onaylanır ve sipariş almadan önce her oyundaki rankı ekibimizce doğrulanır."],
      },
    ],
  },
  contact: {
    title: "İletişim",
    description: "EloBoost desteğine nasıl ulaşırsın.",
    sections: [
      {
        heading: "Sipariş soruları",
        body: [
          "Panelinden siparişi aç ve booster'ınla konuşmak için sipariş sohbetini kullan. Bir sorun varsa “Sorun bildir” düğmesini kullan: ekibimiz siparişi ve sohbeti inceler.",
        ],
      },
      {
        heading: "Hesap veya ödeme soruları",
        body: ["Mümkün olduğunda sitenin köşesindeki canlı destek sohbetini kullan veya aşağıdaki destek e-postasına yaz."],
      },
    ],
  },
};

export function getInfoPage(slug: InfoSlug, locale: string): InfoPage {
  return (locale === "tr" ? tr[slug] : undefined) ?? en[slug];
}

export function isInfoSlug(value: string): value is InfoSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value) || (COMPANY_SLUGS as readonly string[]).includes(value);
}
