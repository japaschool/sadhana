import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";
import { parsePath } from "./pages";

// Prefer language from the first path segment if it is 'ru' or 'uk'
let initialLng: string | undefined = undefined;
if (typeof window !== "undefined") {
  const { lang, page } = parsePath(window.location.pathname);
  // Guides are one language per URL; home still lets the browser's language pick for "/".
  if (lang !== "en" || page !== "home") initialLng = lang;
}

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    lng: initialLng,
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    react: { useSuspense: false },
  });

export default i18n;
