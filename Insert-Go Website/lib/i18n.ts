import { defaultLocale, type Locale } from "@/i18n-config";

/**
 * Translation strings for the site chrome.
 *
 * Deliberately a plain object literal rather than JSON files behind a lazy
 * `import()`: the whole table is a few hundred bytes, and a loader that has to
 * be awaited would push `async` into every component that reads a label. When
 * the copy grows past the chrome — the marketing pages themselves — this is the
 * seam to swap for per-locale modules and a `getDictionary` that awaits them;
 * every call site already goes through the function below.
 *
 * `en` is the shape of record. The other locales are typed against it, so a key
 * added in English fails the build until every language answers for it.
 */
const en = {
  nav: {
    home: "Home",
    features: "Features",
    howItWorks: "How It Works",
    pricing: "Pricing",
    faq: "FAQ",
    contact: "Contact",
    signIn: "Sign in",
    account: "Account",
    downloadCta: "Download for Windows",
    downloadShort: "Download",
    openMenu: "Open menu",
    closeMenu: "Close menu",
  },
};

export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = {
  en,
  es: {
    nav: {
      home: "Inicio",
      features: "Funciones",
      howItWorks: "Cómo funciona",
      pricing: "Precios",
      faq: "Preguntas frecuentes",
      contact: "Contacto",
      signIn: "Iniciar sesión",
      account: "Cuenta",
      downloadCta: "Descargar para Windows",
      downloadShort: "Descargar",
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
    },
  },
  de: {
    nav: {
      home: "Startseite",
      features: "Funktionen",
      howItWorks: "So funktioniert's",
      pricing: "Preise",
      faq: "FAQ",
      contact: "Kontakt",
      signIn: "Anmelden",
      account: "Konto",
      downloadCta: "Für Windows herunterladen",
      downloadShort: "Herunterladen",
      openMenu: "Menü öffnen",
      closeMenu: "Menü schließen",
    },
  },
  ja: {
    nav: {
      home: "ホーム",
      features: "機能",
      howItWorks: "使い方",
      pricing: "料金",
      faq: "よくある質問",
      contact: "お問い合わせ",
      signIn: "ログイン",
      account: "アカウント",
      downloadCta: "Windows版をダウンロード",
      downloadShort: "ダウンロード",
      openMenu: "メニューを開く",
      closeMenu: "メニューを閉じる",
    },
  },
  fr: {
    nav: {
      home: "Accueil",
      features: "Fonctionnalités",
      howItWorks: "Comment ça marche",
      pricing: "Tarifs",
      faq: "FAQ",
      contact: "Contact",
      signIn: "Se connecter",
      account: "Compte",
      downloadCta: "Télécharger pour Windows",
      downloadShort: "Télécharger",
      openMenu: "Ouvrir le menu",
      closeMenu: "Fermer le menu",
    },
  },
};

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries[defaultLocale];
}
