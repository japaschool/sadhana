import { FaTelegramPlane, FaYoutube } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="bg-neutral text-neutral-content py-10 px-6">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <a
            href="https://t.me/sadhanapro"
            target="_blank"
            rel="noreferrer"
            title="Telegram"
            className="btn btn-ghost btn-circle text-neutral-content hover:bg-neutral-content/10"
          >
            <FaTelegramPlane className="w-5 h-5" />
          </a>
          <a
            href="https://www.youtube.com/@SadhanaPro"
            target="_blank"
            rel="noreferrer"
            title="YouTube"
            className="btn btn-ghost btn-circle text-neutral-content hover:bg-neutral-content/10"
          >
            <FaYoutube className="w-5 h-5" />
          </a>
        </div>
        <p className="text-sm text-neutral-content/60">{t('footer.copyright')}</p>
      </div>
    </footer>
  )
}
