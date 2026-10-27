import { useRef, useState } from 'react'
import { Link, Navigate, useMatch, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, useDragControls } from 'framer-motion'
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MobileShell } from '../../../layouts/mobile/MobileShell'
import type { PracticeDataType, UserPractice } from '../../../types/api'
import { parseOptions } from '../../today/values'
import { LIST } from '../../yatras/settings/mobile/AdminPage'
import { ConfirmSheet } from '../../yatras/settings/mobile/fields'
import { TypeIcon } from '../../yatras/settings/mobile/TypeChip'
import { usePractices } from '../usePractices'
import { PracticeSheet } from './PracticeSheet'

const LIST_PATH = '/settings/practices'
/** How far a row slides to show Hide and Delete. */
const ACTIONS_PX = 176
const ALL_TYPES: PracticeDataType[] = ['Int', 'Time', 'Duration', 'Bool', 'Text']

export function PracticesMobileScreen() {
  return (
    <MobileShell>
      <PracticesMobile />
    </MobileShell>
  )
}

/** Your practices in Today's order. /settings/practices/new and /settings/practices/:id open Add and Edit as sheets over it. */
export function PracticesMobile() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()
  const adding = !!useMatch('/settings/practices/new')
  const s = usePractices()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const close = () => navigate(LIST_PATH, { replace: true })
  const find = (pid?: string | null) => s.practices.find((p) => p.id === pid)
  const editing = find(id)
  const deleting = find(deletingId)

  if (id && s.isSuccess && !editing) return <Navigate to={LIST_PATH} replace />

  return (
    <>
      <header className="sticky top-0 z-30 bg-ui-bg pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-14 items-center justify-between px-2 pr-4">
          <Link to="/settings" className="flex min-h-11 items-center gap-1 px-2 text-[17px] font-semibold text-ui-accent">
            <span aria-hidden>‹</span>{t('nav.settings')}
          </Link>
          <Link to="/settings/practices/new" className="flex min-h-11 items-center gap-1.5 rounded-full bg-ui-accent-fill px-4 text-[15px] font-extrabold text-ui-ink">
            <span aria-hidden className="text-lg leading-none">+</span>{t('practices.add')}
          </Link>
        </div>
      </header>
      <div className="flex flex-col gap-4 px-4 pb-8">
        <h1 className="px-1 text-[30px] leading-tight font-extrabold tracking-[-0.02em] text-ui-ink">{t('practices.title')}</h1>
        <PracticeList s={s} swipe onDelete={setDeletingId} />
      </div>

      {(adding || editing) && (
        <PracticeSheet key={editing?.id ?? 'new'} practice={editing} others={s.practices.filter((p) => p.id !== editing?.id)}
          busy={s.create.isPending || s.update.isPending} onClose={close}
          onSave={async (d) => {
            if (editing) await s.update.mutateAsync({ ...editing, ...d, dropdown_variants: d.dropdown_variants ?? undefined })
            else await s.create.mutateAsync(d)
            close()
          }}
          onDelete={editing && (() => setDeletingId(editing.id))} />
      )}
      {deleting && <DeleteSheet s={s} p={deleting} onDeleted={() => { if (editing?.id === deleting.id) close() }} onClose={() => setDeletingId(null)} />}
    </>
  )
}

export type Practices = ReturnType<typeof usePractices>

export function DeleteSheet({ s, p, onDeleted, onClose }: { s: Practices; p: UserPractice; onDeleted: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <ConfirmSheet title={t('practices.deleteConfirmTitle', { name: p.practice })} text={t('practices.deleteText')}
      confirm={t('practices.deleteTitle')} busy={s.remove.isPending} onClose={onClose}
      onConfirm={() => s.remove.mutate(p, { onSuccess: onDeleted, onSettled: onClose })} />
  )
}

/** The count, then your practices in Today's order, dragged by the dots to reorder. Tap a row to edit it. */
export function PracticeList({ s, swipe, selected, onDelete }: {
  s: Practices
  /** Mobile: a left swipe shows Hide and Delete. */
  swipe?: boolean
  /** Wide layouts: the row open in the editor beside the list. */
  selected?: string
  onDelete: (id: string) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [swiped, setSwiped] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const hidden = s.practices.filter((p) => !p.is_active).length

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const ids = s.practices.map((p) => p.id)
    s.reorder.mutate(arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(String(over.id))))
  }

  if (s.isLoading) return <Skeleton />
  if (s.isError) return <p role="alert" className="rounded-2xl bg-ui-surface px-4 py-3 text-sm text-ui-danger">{t('common.error')}</p>
  // Wide layouts open the Add form beside an empty list, so the card has no button.
  if (!s.practices.length) return <Empty add={swipe} />
  return (
    <>
      <div className="-mt-1 px-1">
        <p className="text-[15px] font-bold text-ui-ink">
          {t('practices.count', { count: s.practices.length })}{hidden > 0 && ` · ${t('practices.hiddenCount', { count: hidden })}`}
        </p>
        <p className="text-sm text-ui-muted">{t('practices.orderHint')}</p>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={() => setSwiped(null)} onDragEnd={onDragEnd}>
        <SortableContext items={s.practices.map((p) => p.id)} strategy={verticalListSortingStrategy}>
          <ul className={LIST}>
            {s.practices.map((p) => (
              <PracticeRow key={p.id} p={p} swipe={swipe} selected={selected === p.id}
                open={swiped === p.id} onOpen={(o) => setSwiped(o ? p.id : null)}
                onEdit={() => navigate(`/settings/practices/${p.id}`)}
                onSetActive={(active) => { setSwiped(null); s.setActive.mutate({ p, active }) }}
                onDelete={() => { setSwiped(null); onDelete(p.id) }} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </>
  )
}

/** One target per row: tap edits, the dots drag, a left swipe shows Hide and Delete. */
function PracticeRow({ p, swipe, selected, open, onOpen, onEdit, onSetActive, onDelete }: {
  p: UserPractice; swipe?: boolean; selected: boolean; open: boolean; onOpen: (open: boolean) => void
  onEdit: () => void; onSetActive: (active: boolean) => void; onDelete: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
  const drag = useDragControls()
  // A swipe ends with a click on the row; that click mustn't open the editor.
  const swiping = useRef(false)
  const options = parseOptions(p.dropdown_variants).length
  const type = t(`practices.type${p.data_type}`)
  const action = 'flex w-[88px] items-center justify-center text-sm font-bold'
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative overflow-hidden select-none [-webkit-touch-callout:none] ${isDragging ? 'z-10 shadow-lg' : ''}`}>
      {swipe && <div aria-hidden={!open} className="absolute inset-y-0 right-0 flex">
        <button type="button" tabIndex={open ? 0 : -1} onClick={() => onSetActive(!p.is_active)} className={`${action} bg-ui-control text-ui-ink`}>
          {t(p.is_active ? 'practices.hide' : 'practices.show')}
        </button>
        <button type="button" tabIndex={open ? 0 : -1} onClick={onDelete} className={`${action} bg-ui-danger text-white`}>{t('practices.delete')}</button>
      </div>}
      <motion.div drag={swipe ? 'x' : false} dragControls={drag} dragListener={false} dragDirectionLock dragConstraints={{ left: -ACTIONS_PX, right: 0 }}
        dragElastic={0.05} animate={{ x: open ? -ACTIONS_PX : 0 }} transition={{ type: 'tween', duration: 0.18 }}
        onDragStart={() => { swiping.current = true }}
        onDragEnd={(_, info) => onOpen(info.offset.x < -ACTIONS_PX / 3 || (open && info.offset.x < ACTIONS_PX / 3))}
        className={`relative flex min-h-[66px] items-center gap-1 pr-2 ${selected ? 'bg-ui-accent-soft' : p.is_active ? 'bg-ui-surface' : 'bg-ui-bg'}`}>
        <button type="button" {...attributes} {...listeners} aria-label={t('practices.dragHandle', { name: p.practice })}
          className="flex h-11 w-11 shrink-0 cursor-grab touch-none items-center justify-center text-ui-faint2">
          <span aria-hidden className="grid grid-cols-2 gap-[3px]">{Array.from({ length: 6 }, (_, i) => <span key={i} className="h-1 w-1 rounded-full bg-current" />)}</span>
        </button>
        <button type="button" aria-current={selected || undefined} onPointerDown={(e) => { swiping.current = false; if (swipe) drag.start(e) }}
          onClick={() => { if (!swiping.current) { if (open) onOpen(false); else onEdit() } }}
          className="flex min-w-0 flex-1 touch-pan-y items-center gap-3 py-2.5 text-left">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] ${p.is_active ? 'bg-ui-chip text-ui-ink2' : 'border border-dashed border-ui-faint text-ui-faint2'}`}>
            <TypeIcon type={p.data_type} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className={`truncate text-base font-bold ${p.is_active ? 'text-ui-ink' : 'text-ui-faint2'}`}>{p.practice}</span>
            <span className="flex flex-wrap items-center gap-x-1.5 text-[13px] text-ui-muted">
              {p.is_required && (
                <><span className="flex items-center gap-1 font-semibold text-ui-danger"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-ui-danger" />{t('practices.required')}</span>·</>
              )}
              <span>{options ? t('practices.typeWithList', { type, n: options }) : type}</span>
              {!p.is_active && <>·<span className="font-semibold text-ui-ink2">{t('practices.hiddenFromToday')}</span></>}
            </span>
          </span>
        </button>
        {p.is_active ? (
          <span aria-hidden className={`shrink-0 px-1.5 text-xl ${selected ? 'text-ui-accent' : 'text-ui-faint2'}`}>›</span>
        ) : (
          <button type="button" onClick={() => onSetActive(true)}
            className="min-h-9 shrink-0 rounded-[10px] border border-ui-control bg-ui-surface px-3.5 text-sm font-bold text-ui-ink">
            {t('practices.show')}
          </button>
        )}
      </motion.div>
    </li>
  )
}

function Skeleton() {
  const { t } = useTranslation()
  const bar = 'animate-pulse rounded-full bg-ui-chip'
  return (
    <div role="status" aria-label={t('common.loading')} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 px-1"><span className={`${bar} h-3.5 w-1/2`} /><span className={`${bar} h-2.5 w-3/4`} /></div>
      <div className={LIST}>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex min-h-[66px] items-center gap-3 bg-ui-surface px-3.5">
            <span className={`${bar} h-4 w-3 rounded`} /><span className={`${bar} h-9 w-9 rounded-[10px]`} />
            <span className="flex flex-1 flex-col gap-2"><span className={`${bar} h-3 w-2/3`} /><span className={`${bar} h-2.5 w-1/3`} /></span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Empty({ add }: { add?: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-ui-control px-6 py-8 text-center">
      <div aria-hidden className="flex gap-2 pb-2">
        {ALL_TYPES.map((ty) => <span key={ty} className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ui-chip text-ui-ink2"><TypeIcon type={ty} /></span>)}
      </div>
      <h2 className="text-xl font-extrabold text-ui-ink">{t('practices.emptyTitle')}</h2>
      <p className="text-sm leading-normal text-ui-ink2">{t('practices.emptyText')}</p>
      {add && <Link to="/settings/practices/new" className="mt-1 flex min-h-12 items-center rounded-[14px] bg-ui-accent-fill px-5 text-[15px] font-extrabold text-ui-ink">
        {t('practices.addFirst')}
      </Link>}
    </div>
  )
}
