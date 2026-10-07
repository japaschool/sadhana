import { useTranslation } from 'react-i18next'
import { AnchoredMenu, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import type { Report } from '../../../api/charts'
import { ALL } from '../useInsights'

interface ReportMenuProps {
  anchor: HTMLElement
  reports: Report[]
  selectedId: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function ReportMenu({ anchor, reports, selectedId, onSelect, onClose }: ReportMenuProps) {
  const { t } = useTranslation()
  return (
    <AnchoredMenu anchor={anchor} label={t('insights.reports')} onClose={onClose}>
      <MenuItem selected={selectedId === ALL} onSelect={() => onSelect(ALL)}>{t('charts.allPractices')}</MenuItem>
      {reports.map((r) => (
        <MenuItem key={r.id} selected={selectedId === r.id} onSelect={() => onSelect(r.id)}>{r.name}</MenuItem>
      ))}
    </AnchoredMenu>
  )
}
