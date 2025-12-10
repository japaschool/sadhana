import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="bg-neutral-900 text-white py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-sm">
          {t('footer.copyright')}
        </div>

        <div className="flex items-center gap-4">
        </div>
      </div>
    </footer>
  )
}
