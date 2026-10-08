import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { YatraPractice } from '../../../../types/api'
import { AnchoredMenu, MenuItem } from '../../../../ui/primitives/AnchoredMenu'
import { useYatraAdmin } from '../useYatraAdmin'
import { AdminPage, BTN, HINT, LIST } from './AdminPage'
import { AddPracticeSheet, DeletePracticeSheet, RenamePracticeSheet } from './PracticeSheets'
import { practiceSummary } from './summaries'
import { TypeIcon } from './TypeChip'

export function PracticesMobile() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
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

  return (
    <AdminPage admin={a} title={t('yatraSettings.practices')}>
      {() => {
        const menuFor = find(menu?.id ?? null)
        const renaming = find(renamingId)
        const deleting = find(deletingId)
        return (
          <>
            <p className={`${HINT} px-1.5`}>{t('yatraSettings.practicesIntro')}</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={a.practices.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <ul className={LIST}>
                  {a.practices.map((p) => (
                    <PracticeRow key={p.id} p={p} to={`/yatra/${id}/practice/${p.id}/edit`} onMenu={(anchor) => setMenu({ id: p.id, anchor })} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <button type="button" onClick={() => setAdding(true)} className={`${BTN} border border-dashed border-ui-control bg-ui-surface text-ui-accent`}>
              {t('yatraSettings.addPractice')}
            </button>
            {menu && menuFor && (
              <AnchoredMenu anchor={menu.anchor} label={menuFor.practice} onClose={() => setMenu(null)}>
                <MenuItem onSelect={() => { setMenu(null); setRenamingId(menuFor.id) }}>{t('yatraSettings.rename')}</MenuItem>
                <MenuItem onSelect={() => { setMenu(null); setDeletingId(menuFor.id) }}>
                  <span className="text-ui-danger">{t('yatraSettings.deleteEllipsis')}</span>
                </MenuItem>
              </AnchoredMenu>
            )}
            {renaming && (
              <RenamePracticeSheet practice={renaming} onClose={() => setRenamingId(null)}
                onRename={(name) => a.savePractice({ ...renaming, practice: name }, t('yatraSettings.renamed'))} />
            )}
            {deleting && (
              <DeletePracticeSheet practice={deleting} statCount={a.statCount(deleting.id)} busy={a.deletePractice.isPending}
                onClose={() => setDeletingId(null)} onConfirm={() => a.deletePractice.mutate(deleting, { onSettled: () => setDeletingId(null) })} />
            )}
            {adding && (
              <AddPracticeSheet busy={a.createPractice.isPending} onClose={() => setAdding(false)}
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

function PracticeRow({ p, to, onMenu }: { p: YatraPractice; to: string; onMenu: (anchor: HTMLElement) => void }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex min-h-[60px] items-center gap-1 bg-ui-surface pr-1 ${isDragging ? 'relative z-10 shadow-lg' : ''}`}>
      <button type="button" {...attributes} {...listeners} aria-label={t('yatraSettings.dragHandle', { name: p.practice })}
        className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center text-ui-faint2">
        <span aria-hidden className="text-lg leading-none">⋮⋮</span>
      </button>
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
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
