import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FaGripVertical, FaEdit, FaTrash, FaPlus, FaLayerGroup, FaEye, FaEyeSlash } from 'react-icons/fa'
import { LuToggleRight, LuHash, LuTimer, LuClock, LuType, LuX } from 'react-icons/lu'
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { practicesApi } from '../../api/practices'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import type { UserPractice } from '../../types/api'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../hooks/useToast'
import { ACCENT_GRADIENT } from '../../theme/tokens'

const TYPE_META: Record<string, { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>, color: string, bg: string, tKey: string }> = {
  Bool:     { icon: LuToggleRight, color: '#e8905a', bg: 'rgba(232,144,90,0.16)',   tKey: 'practice.typeBool'     },
  Int:      { icon: LuHash,        color: '#818cf8', bg: 'rgba(129,140,248,0.16)',  tKey: 'practice.typeInt'      },
  Duration: { icon: LuTimer,       color: '#fbbf24', bg: 'rgba(251,191,36,0.16)',  tKey: 'practice.typeDuration' },
  Time:     { icon: LuClock,       color: '#60a5fa', bg: 'rgba(96,165,250,0.16)',  tKey: 'practice.typeTime'     },
  Text:     { icon: LuType,        color: '#fb7185', bg: 'rgba(251,113,133,0.16)', tKey: 'practice.typeText'     },
}

function SortableRow({
  practice,
  onDelete,
  onToggleActive,
}: {
  practice: UserPractice
  onDelete: (id: string) => void
  onToggleActive: (practice: UserPractice) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: practice.id })
  const { t } = useTranslation()
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : practice.is_active ? 1 : 0.4,
  }
  const modalId = `delete-practice-${practice.id}`
  const meta = TYPE_META[practice.data_type] ?? TYPE_META.Text
  const TypeIcon = meta.icon

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
        borderRadius: '1rem',
      }}
    >
      <div className="px-3 py-3 flex items-center gap-2.5">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="flex-shrink-0 touch-none w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ color: 'rgba(255,255,255,0.25)', cursor: 'grab' }}
          aria-label="Drag to reorder"
        >
          <FaGripVertical className="w-3.5 h-3.5" />
        </button>

        {/* Type icon pill */}
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: meta.bg }}
        >
          <TypeIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-base-content text-sm truncate" style={{ textDecoration: practice.is_active ? undefined : 'line-through' }}>{practice.practice}</span>
            {practice.is_required && (
              <span className="text-xs font-bold flex-shrink-0" style={{ color: '#e11d48' }}>*</span>
            )}
          </div>
          <span className="text-xs font-medium" style={{ color: meta.color }}>{t(meta.tKey)}</span>
        </div>

        {/* Edit */}
        <Link
          to={`/user/practice/${practice.id}/edit`}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: 'rgba(242,244,246,0.6)' }}
        >
          <FaEdit className="w-3.5 h-3.5" />
        </Link>

        {/* Hide/show toggle */}
        <button
          type="button"
          aria-label={practice.is_active ? t('practice.hide') : t('practice.show')}
          onClick={() => onToggleActive(practice)}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: practice.is_active ? 'rgba(242,244,246,0.45)' : '#f59e0b', border: 'none', background: 'none' }}
        >
          {practice.is_active
            ? <FaEye className="w-3.5 h-3.5" />
            : <FaEyeSlash className="w-3.5 h-3.5" />
          }
        </button>

        {/* Delete */}
        <button
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl transition-colors"
          style={{ color: 'rgba(244,63,94,0.85)' }}
          onClick={() => (document.getElementById(modalId) as HTMLDialogElement)?.showModal()}
        >
          <FaTrash className="w-3.5 h-3.5" />
        </button>
      </div>

      <ConfirmModal
        id={modalId}
        title={t('practice.delete')}
        message={`${t('practice.deleteConfirm')} "${practice.practice}"?`}
        confirmLabel={t('common.delete')}
        onConfirm={() => onDelete(practice.id)}
      />
    </div>
  )
}

export function MyPracticesPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const qc = useQueryClient()
  const { data = [], isLoading } = useQuery({
    queryKey: ['practices'],
    queryFn: practicesApi.getUserPractices,
  })
  const [items, setItems] = useState<UserPractice[]>([])
  const initialized = useRef(false)

  if (!initialized.current && data.length > 0) {
    setItems(data)
    initialized.current = true
  }

  const reorder = useMutation({
    mutationFn: (ids: string[]) => practicesApi.reorderUserPractices(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['practices'] }),
    onError: () => showToast({ message: t('settings.reorderFailed'), variant: 'error' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => practicesApi.deleteUserPractice(id),
    onSuccess: () => {
      initialized.current = false
      qc.invalidateQueries({ queryKey: ['practices'] })
    },
  })

  const toggleActive = useMutation({
    mutationFn: (practice: UserPractice) =>
      practicesApi.updateUserPractice(practice.id, {
        practice: practice.practice,
        data_type: practice.data_type,
        is_active: !practice.is_active,
        is_required: practice.is_required || undefined,
        dropdown_variants: practice.dropdown_variants || undefined,
      }),
    onSuccess: () => {
      initialized.current = false
      qc.invalidateQueries({ queryKey: ['practices'] })
    },
    onError: () => showToast({ message: t('settings.reorderFailed'), variant: 'error' }),
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.id === active.id)
    const newIdx = items.findIndex((i) => i.id === over.id)
    const next = arrayMove(items, oldIdx, newIdx)
    setItems(next)
    reorder.mutate(next.map((i) => i.id))
  }

  if (isLoading) return <Spinner />

  return (
    <>
      <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 pb-24 sm:pb-8">
        {/* Page header with close button */}
        <div
          className="rounded-2xl px-5 py-5 flex items-center gap-4"
          style={{
            background: 'rgba(255,255,255,0.06)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.10)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}
        >
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: ACCENT_GRADIENT,
              boxShadow: '0 4px 16px rgba(245,158,11,0.30)',
            }}
          >
            <FaLayerGroup className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-base-content leading-tight">{t('settings.myPractices')}</h1>
            <p className="text-xs text-base-content/70 mt-0.5">
              {items.length > 0
                ? t('practice.listSubtitle', { count: items.length })
                : t('practice.empty')}
            </p>
          </div>
          <Link
            to="/"
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
          >
            <LuX className="w-4 h-4" />
          </Link>
        </div>

        {/* List */}
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {items.map((p) => (
                <SortableRow
                  key={p.id}
                  practice={p}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  onToggleActive={(practice) => toggleActive.mutate(practice)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {items.length === 0 && (
          <p className="text-center text-base-content/70 text-sm py-8">{t('practice.empty')}</p>
        )}
      </div>

      {/* FAB */}
      <Link
        to="/user/practice/new"
        aria-label="Add practice"
        className="fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full flex items-center justify-center"
        style={{
          background: ACCENT_GRADIENT,
          boxShadow: '0 4px 24px rgba(245,158,11,0.45)',
        }}
      >
        <FaPlus className="w-5 h-5 text-white" />
      </Link>
    </>
  )
}
