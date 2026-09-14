import { useTranslation } from 'react-i18next'

export function SocialStrip() {
  const { t } = useTranslation()
  return (
    <div className="py-8 border-y border-white/5 bg-[#0b0b0d]">
      <p className="text-center text-white/45 text-sm">{t('landing.social.line')}</p>
    </div>
  )
}
