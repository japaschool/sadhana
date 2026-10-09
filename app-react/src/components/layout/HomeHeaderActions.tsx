import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '../../store/uiStore'
import { useToastStore } from '../../hooks/useToast'
import { copyShareLink, downloadCsv } from '../../features/today/actions'
import { HeaderMenu, type HeaderMenuItem } from './HeaderMenu'

export function HomeHeaderActions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const requestYatraCreate = useUiStore((s) => s.requestYatraCreate)

  const practices: HeaderMenuItem[] = [
    { label: t('home.addPractice'), to: '/user/practice/new' },
    { label: t('home.editPractices'), to: '/user/practices' },
  ]
  const yatras: HeaderMenuItem[] = [
    { label: t('yatras.createNewYatra'), onClick: requestYatraCreate },
    {
      label: t('home.viewYatras'),
      onClick: () => {
        const el = document.getElementById('home-yatras')
        if (el) el.scrollIntoView({ behavior: 'smooth' })
        else navigate('/')
      },
    },
  ]
  const charts: HeaderMenuItem[] = [
    { label: t('charts.addReport'), to: '/settings/charts' },
    { label: t('charts.downloadCsv'), onClick: () => void downloadCsv() },
    {
      label: t('charts.shareLink'),
      onClick: () => {
        if (copyShareLink()) useToastStore.getState().showToast({ message: t('charts.copied'), variant: 'success' })
      },
    },
  ]

  return (
    <div className="flex items-center gap-2">
      <HeaderMenu label={t('home.practicesMenu')} items={practices} />
      <HeaderMenu label={t('nav.yatras')} items={yatras} />
      <HeaderMenu label={t('charts.title')} items={charts} />
    </div>
  )
}
