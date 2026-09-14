import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useToastStore } from '../../hooks/useToast'
import { chartsApi } from '../../api/charts'
import { practicesApi } from '../../api/practices'
import { toCSV, triggerCSVDownload } from '../../pages/charts/csv'
import { HeaderMenu, type HeaderMenuItem } from './HeaderMenu'

export function HomeHeaderActions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const requestYatraCreate = useUiStore((s) => s.requestYatraCreate)

  async function downloadCsv() {
    const cob = new Date().toISOString().slice(0, 10)
    const [entries, practices] = await Promise.all([
      chartsApi.getReportData(cob, 'AllData'),
      practicesApi.getUserPractices(),
    ])
    const practiceMap = Object.fromEntries(practices.map((p) => [p.id, p.practice]))
    triggerCSVDownload(toCSV(entries, practiceMap))
  }

  function shareLink() {
    const user = useAuthStore.getState().user
    if (!user) return
    void navigator.clipboard.writeText(`${window.location.origin}/shared/${user.id}`)
    useToastStore.getState().showToast({ message: t('charts.copied'), variant: 'success' })
  }

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
    { label: t('charts.addReport'), to: '/charts/new' },
    { label: t('charts.downloadCsv'), onClick: () => void downloadCsv() },
    { label: t('charts.shareLink'), onClick: shareLink },
  ]

  return (
    <div className="flex items-center gap-2">
      <HeaderMenu label={t('home.practicesMenu')} items={practices} />
      <HeaderMenu label={t('nav.yatras')} items={yatras} />
      <HeaderMenu label={t('charts.title')} items={charts} />
    </div>
  )
}
