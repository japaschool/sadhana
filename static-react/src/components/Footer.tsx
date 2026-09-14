import { useTranslation } from 'react-i18next'

const APP_URL = '/'

export default function Footer() {
  const { t } = useTranslation()

  const linkClass = 'text-white/55 hover:text-white transition-colors text-sm no-underline'

  return (
    <footer className="bg-[#0b0b0d] border-t border-white/10 py-16 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Top grid: brand + three columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
            <a
              href={APP_URL}
              className="font-serif text-2xl text-white no-underline"
            >
              Sadhana
            </a>
            <p className="text-white/55 text-sm leading-relaxed">
              {t('landing.footer.tagline')}
            </p>
          </div>

          {/* Product column */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-medium">
              {t('landing.footer.product.title')}
            </p>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              <li>
                <a href="#practices" className={linkClass}>
                  {t('landing.footer.product.practices')}
                </a>
              </li>
              <li>
                <a href="#charts" className={linkClass}>
                  {t('landing.footer.product.charts')}
                </a>
              </li>
              <li>
                <a href="#yatras" className={linkClass}>
                  {t('landing.footer.product.yatras')}
                </a>
              </li>
            </ul>
          </div>

          {/* Company column */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-medium">
              {t('landing.footer.company.title')}
            </p>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              <li>
                <a href="#" className={linkClass}>
                  {t('landing.footer.company.about')}
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  {t('landing.footer.company.contact')}
                </a>
              </li>
            </ul>
          </div>

          {/* Resources column */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-white/55 font-medium">
              {t('landing.footer.resources.title')}
            </p>
            <ul className="flex flex-col gap-2 list-none p-0 m-0">
              <li>
                <a href="#" className={linkClass}>
                  {t('landing.footer.resources.help')}
                </a>
              </li>
              <li>
                <a href="#" className={linkClass}>
                  {t('landing.footer.resources.privacy')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row: copyright */}
        <div className="border-t border-white/10 pt-6">
          <p className="text-white/55 text-sm">
            {t('landing.footer.copyright')}
          </p>
        </div>
      </div>
    </footer>
  )
}
