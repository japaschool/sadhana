import { useTranslation } from 'react-i18next'
import { AnchoredMenu, MenuDivider, MenuItem } from '../../../ui/primitives/AnchoredMenu'
import type { Report } from '../../../api/charts'
import { ALL } from '../useInsights'
import { ReportGlyph } from '../ReportGlyph'

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
      <MenuItem selected={selectedId === ALL} onSelect={() => onSelect(ALL)}><span className="flex items-center gap-3"><ReportGlyph report={null} />{t('charts.allPractices')}</span></MenuItem>
      <MenuDivider />
      {reports.map((r) => (
        <MenuItem key={r.id} selected={selectedId === r.id} onSelect={() => onSelect(r.id)}>
          <span className="flex min-w-0 items-center gap-3"><ReportGlyph report={r} /><span className="truncate">{r.name}</span></span>
        </MenuItem>
      ))}
    </AnchoredMenu>
  )
}
