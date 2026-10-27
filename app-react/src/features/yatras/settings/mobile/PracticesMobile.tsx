import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery } from '@tanstack/react-query'
import { yatrasApi } from '../../../../api/yatras'
import { useLayout } from '../../../../layouts/useLayout'
import type { YatraPractice } from '../../../../types/api'
import { initials } from '../../../../ui/initials'
import { AnchoredMenu, MenuItem } from '../../../../ui/primitives/AnchoredMenu'
import { cellText } from '../../../insights/insightsLogic'
import { toDateStr } from '../../../today/date'
import { findZone, ZONE_BG } from '../../yatrasLogic'
import { SidePanel } from '../SettingsFrame'
import { useYatraAdmin } from '../useYatraAdmin'
import { ADD, AdminPage, BTN, CARD, HINT, LIST } from './AdminPage'
import { PracticeEditor } from './PracticeEditorMobile'
import { AddPracticeSheet, DeletePracticeSheet, RenamePracticeSheet } from './PracticeSheets'
import { practiceSummary } from './summaries'
import { TypeIcon } from './TypeChip'

export function PracticesMobile() {
  const { t } = useTranslation()
  const { id = '', practice_id } = useParams()
  const navigate = useNavigate()
  const layout = useLayout()
  const a = useYatraAdmin(id)
  const [menu, setMenu] = useState<{ id: string; anchor: HTMLElement } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const find = (pid: string | null) => a.practices.find((p) => p.id === pid)

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = a.practices.map((p) => p.id)
    a.reorder(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  const list = `/yatra/${id}/admin/practices`
  // Desktop: /practice/:id/edit is this page with that practice's editor beside the list.
  const editing = layout === 'desktop' ? find(practice_id ?? null) : undefined
  return (
    <AdminPage admin={a} title={t('yatraSettings.practices')} intro={layout === 'mobile' ? undefined : t('yatraSettings.practicesIntro')}
      action={<button type="button" onClick={() => setAdding(true)} className={ADD}>{t('yatraSettings.addPractice')}</button>}
      aside={editing && (
        <SidePanel key={editing.id} eyebrow={t('yatraSettings.editPractice')} title={editing.practice} onClose={() => navigate(list)}>
          <PracticeEditor a={a} p={editing} onDeleted={() => navigate(list, { replace: true })} />
        </SidePanel>
      )}>
      {() => {
        const menuFor = find(menu?.id ?? null)
        const renaming = find(renamingId)
        const deleting = find(deletingId)
        return (
          <>
            {layout === 'mobile' && <p className={`${HINT} px-1.5`}>{t('yatraSettings.practicesIntro')}</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={a.practices.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ul className={LIST}>
                  {a.practices.map((p) => (
                    <PracticeRow key={p.id} p={p} to={`/yatra/${id}/practice/${p.id}/edit`} selected={p.id === editing?.id}
                      onMenu={(anchor) => setMenu({ id: p.id, anchor })} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {layout === 'mobile' && (
              <button type="button" onClick={() => setAdding(true)} className={`${BTN} border border-dashed border-ui-control bg-ui-surface text-ui-accent`}>
                {t('yatraSettings.addPractice')}
              </button>
            )}
            {layout === 'desktop' && <LivePreview id={id} practices={a.practices} selected={editing?.id} />}
            {menu && menuFor && (
              <AnchoredMenu anchor={menu.anchor} label={menuFor.practice} onClose={() => setMenu(null)}>
                <MenuItem onSelect={() => { setMenu(null); setRenamingId(menuFor.id) }}>{t('yatraSettings.rename')}</MenuItem>
                <MenuItem onSelect={() => { setMenu(null); setDeletingId(menuFor.id) }}>
                  <span className="text-ui-danger">{t('yatraSettings.deleteEllipsis')}</span>
                </MenuItem>
              </AnchoredMenu>
            )}
            {renaming && (
              <RenamePracticeSheet practice={renaming} others={a.practices.filter((x) => x.id !== renaming.id)} onClose={() => setRenamingId(null)}
                onRename={(name) => a.savePractice({ ...renaming, practice: name }, t('yatraSettings.renamed'))} />
            )}
            {deleting && (
              <DeletePracticeSheet practice={deleting} statCount={a.statCount(deleting.id)} busy={a.deletePractice.isPending}
                onClose={() => setDeletingId(null)} onConfirm={() => a.deletePractice.mutate(deleting, { onSettled: () => setDeletingId(null) })} />
            )}
            {adding && (
              <AddPracticeSheet others={a.practices} busy={a.createPractice.isPending} onClose={() => setAdding(false)}
                onAdd={(name, type) => a.createPractice.mutate({ name, type }, {
                  onSuccess: (p) => { setAdding(false); if (p) navigate(`/yatra/${id}/practice/${p.id}/edit`) },
                })} />
            )}
          </>
        )
      }}
    </AdminPage>
  )
}

function PracticeRow({ p, to, selected, onMenu }: { p: YatraPractice; to: string; selected: boolean; onMenu: (anchor: HTMLElement) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-[60px] items-center gap-1 pr-1 ${selected ? 'bg-ui-accent-soft' : 'bg-ui-surface'} select-none [-webkit-touch-callout:none] ${isDragging ? 'relative z-10 shadow-lg' : ''}`}>
      <button type="button" {...attributes} {...listeners} aria-label={t('yatraSettings.dragHandle', { name: p.practice })}
        className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-ui-faint2">
        <span aria-hidden className="text-lg leading-none">⋮⋮</span>
      </button>
      <Link to={to} aria-current={selected ? 'true' : undefined} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ui-chip text-ui-ink2"><TypeIcon type={p.data_type} /></span>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold text-ui-ink">{p.practice}</span>
          <span className="text-xs text-ui-muted">{practiceSummary(p, t)}</span>
        </span>
      </Link>
      <button type="button" aria-label={t('yatraSettings.practiceMenu', { name: p.practice })} aria-haspopup="menu"
        onClick={(e) => onMenu(e.currentTarget)} className="flex h-11 w-11 shrink-0 items-center justify-center gap-[3px]">
        {[0, 1, 2].map((i) => <span key={i} className="h-1 w-1 rounded-full bg-ui-ink" />)}
      </button>
    </li>
  )
}

/** Desktop: today's yatra table with the colours as configured now, so an edit shows in the cells as it saves. */
function LivePreview({ id, practices, selected }: { id: string; practices: YatraPractice[]; selected?: string }) {
  const { t } = useTranslation()
  const today = toDateStr(new Date())
  const { data } = useQuery({ queryKey: ['yatra-data', id, today], queryFn: () => yatrasApi.getYatraData(id, today) })
  if (!data || !practices.length) return null
  const units = { h: t('today.unitH'), min: t('today.unitMin') }
  const col = (pid: string) => (pid === selected ? 'bg-ui-accent-soft' : '')
  return (
    <section className={`${CARD} flex flex-col gap-3 p-4`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-extrabold text-ui-ink">{t('yatraSettings.livePreview')}</h2>
        <span className="text-xs text-ui-muted">{t('yatraSettings.updatesAsYouEdit')}</span>
      </div>
      {!data.data.length ? <p className={HINT}>{t('yatras.noEntries')}</p> : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th />
                {practices.map((p) => (
                  <th key={p.id} title={p.practice}
                    className={`max-w-[88px] truncate rounded-t-lg px-1.5 pt-1.5 pb-1 text-left font-ui-mono text-[10px] font-semibold uppercase tracking-[.04em] ${p.id === selected ? 'bg-ui-accent-soft text-ui-accent' : 'text-ui-muted'}`}>
                    {p.practice}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((row) => (
                <tr key={row.user_id}>
                  <td className="py-1 pr-1.5">
                    <span title={row.user_name} className="flex h-7 w-7 items-center justify-center rounded-full bg-ui-chip text-[10px] font-extrabold text-ui-ink">{initials(row.user_name)}</span>
                  </td>
                  {practices.map((p) => {
                    const j = data.practices.findIndex((d) => d.id === p.id)
                    const v = j < 0 ? null : row.row[j]
                    const bg = p.colour_zones ? ZONE_BG[findZone(v, p.colour_zones)] : ''
                    return (
                      <td key={p.id} className={`px-1 py-1 ${col(p.id)}`}>
                        <span className={`flex h-7 max-w-[120px] min-w-[52px] items-center justify-center truncate rounded-md px-1.5 font-ui-mono font-semibold whitespace-nowrap text-ui-ink ${bg}`}>
                          {cellText(v, p.data_type, units)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
