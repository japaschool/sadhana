// Build-time only: scripts/prerender.mjs renders each language to static HTML
// so crawlers get real text and per-language meta without running JS.
import { renderToString } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import App from './App'

export async function render(lng: string, translation: Record<string, unknown>) {
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({
    lng,
    resources: { [lng]: { translation } },
    interpolation: { escapeValue: false },
  })
  return {
    html: renderToString(
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    ),
    title: i18n.t('meta.title'),
    description: i18n.t('meta.description'),
    keywords: i18n.t('meta.keywords'),
  }
}
