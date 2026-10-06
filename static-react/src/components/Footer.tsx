import { useTranslation } from 'react-i18next'

export default function Footer() {
  const { t } = useTranslation()

  const columns = [
    {
      title: t('footer.practices'),
      links: [
        { label: t('practices.meditation'), href: '#track' },
        { label: t('practices.yoga'),       href: '#track' },
        { label: t('practices.breathwork'), href: '#track' },
        { label: t('practices.journaling'), href: '#track' },
        { label: t('practices.chanting'),   href: '#track' },
      ],
    },
    {
      title: t('footer.community'),
      links: [
        { label: t('footer.joinGroup'),   href: 'https://t.me/sadhanapro' },
        { label: t('footer.videoGuides'), href: 'https://www.youtube.com/@SadhanaPro' },
        { label: t('footer.support'),     href: 'https://t.me/sadhanapro' },
      ],
    },
  ]

  return (
    <footer
      style={{ background: '#E0DAD4', borderTop: '1px solid rgba(0,0,0,0.07)' }}
      className="px-6 py-16"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-10 mb-12 max-w-sm">
          {columns.map(col => (
            <div key={col.title}>
              <p className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: 'rgba(28,28,28,0.35)' }}>
                {col.title}
              </p>
              <ul className="flex flex-col gap-3">
                {col.links.map(link => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.href.startsWith('http') ? '_blank' : undefined}
                      rel="noreferrer"
                      className="text-sm transition-colors duration-150 hover:text-primary"
                      style={{ color: 'rgba(28,28,28,0.52)' }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="pt-8 flex flex-col sm:flex-row justify-between items-center gap-3"
          style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}
        >
          <p className="text-xs" style={{ color: 'rgba(28,28,28,0.30)' }}>{t('footer.copyright')}</p>
          <p className="text-xs" style={{ color: 'rgba(28,28,28,0.22)' }}>{t('footer.tagline')}</p>
        </div>
      </div>
    </footer>
  )
}
