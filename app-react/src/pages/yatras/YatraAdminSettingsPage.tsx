import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  FaEdit, FaTrash, FaPlus, FaShieldAlt, FaChevronDown, FaChevronRight, FaGripVertical,
} from 'react-icons/fa'
import {
  LuCheck, LuCopy, LuLink, LuHash, LuTimer, LuClock, LuType, LuToggleRight, LuX,
  LuChartBar,
} from 'react-icons/lu'
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
import { yatrasApi } from '../../api/yatras'
import { Spinner } from '../../components/ui/Spinner'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import type { YatraStatisticConfig, Aggregation, TimeRange, YatraPractice } from '../../types/api'
import { ACCENT, ACCENT_GRADIENT } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '0.75rem',
  outline: 'none',
  fontSize: '0.9rem',
  color: '#f2f4f6',
  padding: '0.5rem 0.875rem',
  width: '100%',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none' as const,
}

const TYPE_META: Record<string, {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  bg: string
  tKey: string
}> = {
  Bool:     { icon: LuToggleRight, color: ACCENT,    bg: 'rgba(245,158,11,0.10)',   tKey: 'practice.typeBool'     },
  Int:      { icon: LuHash,        color: '#818cf8', bg: 'rgba(129,140,248,0.16)',  tKey: 'practice.typeInt'      },
  Duration: { icon: LuTimer,       color: '#fbbf24', bg: 'rgba(251,191,36,0.16)',  tKey: 'practice.typeDuration' },
  Time:     { icon: LuClock,       color: '#60a5fa', bg: 'rgba(96,165,250,0.16)',  tKey: 'practice.typeTime'     },
  Text:     { icon: LuType,        color: '#fb7185', bg: 'rgba(251,113,133,0.16)', tKey: 'practice.typeText'     },
}

const AGGREGATIONS: { value: Aggregation; label: string }[] = [
  { value: 'Sum',   label: 'Sum'     },
  { value: 'Avg',   label: 'Average' },
  { value: 'Min',   label: 'Minimum' },
  { value: 'Max',   label: 'Maximum' },
  { value: 'Count', label: 'Count'   },
]

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'Last7Days',   label: 'Last 7 days'   },
  { value: 'Last30Days',  label: 'Last 30 days'  },
  { value: 'Last90Days',  label: 'Last 90 days'  },
  { value: 'Last365Days', label: 'Last 365 days' },
  { value: 'ThisWeek',    label: 'This week'     },
  { value: 'ThisMonth',   label: 'This month'    },
  { value: 'ThisQuarter', label: 'This quarter'  },
  { value: 'ThisYear',    label: 'This year'     },
]

function isGoodForPractice(agg: Aggregation, dt: string): boolean {
  switch (dt) {
    case 'Int':
    case 'Duration':
      return true
    case 'Time':
      return agg !== 'Sum'
    default:
      return agg === 'Count'
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold uppercase tracking-widest px-1" style={{ color: 'rgba(242,244,246,0.65)' }}>
      {children}
    </span>
  )
}

function SectionToggle({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-2 w-full"
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
    >
      <SectionLabel>{label}</SectionLabel>
      <span className="flex-1" />
      {open
        ? <FaChevronDown className="w-3 h-3" style={{ color: 'rgba(242,244,246,0.65)' }} />
        : <FaChevronRight className="w-3 h-3" style={{ color: 'rgba(242,244,246,0.65)' }} />
      }
    </button>
  )
}

export function YatraAdminSettingsPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  // Collapsible sections
  const [showPractices, setShowPractices] = useState(true)
  const [showMembers, setShowMembers] = useState(true)
  const [showStats, setShowStats] = useState(false)

  // Form state (loaded from yatra on mount)
  const [yatraName, setYatraName] = useState('')
  const [showStability, setShowStability] = useState(false)
  const [statsVisibleToAll, setStatsVisibleToAll] = useState(false)
  const [statistics, setStatistics] = useState<YatraStatisticConfig[]>([])

  // ── Queries ──────────────────────────────────────────────────────────────────

  const yatraQuery = useQuery({
    queryKey: ['yatra', id],
    queryFn: () => yatrasApi.getYatra(id!),
    refetchOnWindowFocus: true,
  })

  const usersQuery = useQuery({
    queryKey: ['yatra-users', id],
    queryFn: () => yatrasApi.getYatraUsers(id!),
    refetchOnWindowFocus: true,
  })

  const practicesQuery = useQuery({
    queryKey: ['yatra-practices', id],
    queryFn: () => yatrasApi.getYatraPractices(id!),
    refetchOnWindowFocus: true,
  })

  // Populate form state when yatra loads
  useEffect(() => {
    const y = yatraQuery.data
    if (!y) return
    setYatraName(y.name)
    setShowStability(y.show_stability_metrics)
    if (y.statistics) {
      setStatsVisibleToAll(y.statistics.visible_to_all)
      setStatistics(y.statistics.statistics)
    }
  }, [yatraQuery.data])

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () => yatrasApi.updateYatra(id!, {
      name: yatraName,
      show_stability_metrics: showStability,
      statistics: statistics.length > 0
        ? { visible_to_all: statsVisibleToAll, statistics }
        : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yatra', id] })
      navigate(`/yatra/${id}/settings`)
    },
  })

  const removeMember = useMutation({
    mutationFn: (userId: string) => yatrasApi.removeMember(id!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yatra-users', id] }),
  })

  const toggleAdmin = useMutation({
    mutationFn: (userId: string) => yatrasApi.toggleAdmin(id!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yatra-users', id] }),
  })

  const deletePractice = useMutation({
    mutationFn: (pId: string) => yatrasApi.deleteYatraPractice(id!, pId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yatra-practices', id] }),
  })

  const reorderPractices = useMutation({
    mutationFn: (ids: string[]) => yatrasApi.reorderPractices(id!, ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['yatra-practices', id] }),
  })

  const deleteYatra = useMutation({
    mutationFn: () => yatrasApi.deleteYatra(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yatras'] })
      navigate('/yatras', { replace: true })
    },
  })

  // ── Stat helpers ──────────────────────────────────────────────────────────────

  function addStat() {
    setStatistics(prev => [...prev, { label: '', practice_id: '', aggregation: 'Count', time_range: 'ThisMonth' }])
    setShowStats(true)
  }

  function updateStat(idx: number, patch: Partial<YatraStatisticConfig>) {
    setStatistics(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function deleteStat(idx: number) {
    setStatistics(prev => prev.filter((_, i) => i !== idx))
  }

  // ── Other helpers ─────────────────────────────────────────────────────────────

  function copyInvite() {
    navigator.clipboard.writeText(`${window.location.origin}/yatra/${id}/join`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getPracticeType(practiceId: string): string {
    return practicesQuery.data?.find(p => p.id === practiceId)?.data_type ?? ''
  }

  const isLoading = yatraQuery.isLoading || usersQuery.isLoading || practicesQuery.isLoading
  const members = usersQuery.data ?? []
  const practices = practicesQuery.data ?? []

  const [orderedPractices, setOrderedPractices] = useState<typeof practices>([])
  const practicesInitialized = useRef(false)

  // Sync order from server on first load
  if (!practicesInitialized.current && practices.length > 0) {
    setOrderedPractices(practices)
    practicesInitialized.current = true
  }

  // Reset when server data refreshes after a mutation
  useEffect(() => {
    if (practicesQuery.isSuccess) {
      practicesInitialized.current = false
    }
  }, [practicesQuery.dataUpdatedAt])

  if (isLoading) return <Spinner />
  if (!yatraQuery.data) return null

  function handlePracticeDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = orderedPractices.findIndex((p) => p.id === active.id)
    const newIdx = orderedPractices.findIndex((p) => p.id === over.id)
    const next = arrayMove(orderedPractices, oldIdx, newIdx)
    setOrderedPractices(next)
    reorderPractices.mutate(next.map((p) => p.id))
  }

  function SortablePracticeRow({ p }: { p: YatraPractice }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id })
    const meta = TYPE_META[p.data_type] ?? TYPE_META.Text
    const TypeIcon = meta.icon
    return (
      <div
        ref={setNodeRef}
        style={{
          ...glass,
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.4 : 1,
        }}
        className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="w-6 h-6 flex items-center justify-center flex-shrink-0 touch-none"
          style={{ color: '#d1d5db', cursor: 'grab', border: 'none', background: 'none' }}
          aria-label="Drag to reorder"
        >
          <FaGripVertical className="w-3.5 h-3.5" />
        </button>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: meta.bg }}
        >
          <TypeIcon className="w-3.5 h-3.5" style={{ color: meta.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-base-content block truncate">{p.practice}</span>
          <span className="text-xs font-medium" style={{ color: meta.color }}>{t(meta.tKey)}</span>
        </div>
        <Link
          to={`/yatra/${id}/practice/${p.id}/edit`}
          className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
        >
          <FaEdit className="w-3 h-3" />
        </Link>
        <button
          type="button"
          onClick={() => (document.getElementById(`del-practice-${p.id}`) as HTMLDialogElement)?.showModal()}
          className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: 'rgba(225,29,72,0.07)', color: 'rgba(225,29,72,0.55)', border: 'none' }}
        >
          <FaTrash className="w-3 h-3" />
        </button>
        <ConfirmModal
          id={`del-practice-${p.id}`}
          title={t('yatras.deletePracticeTitle')}
          message={t('yatras.deletePracticeMsg', { name: p.practice })}
          confirmLabel={t('common.delete')}
          onConfirm={() => deletePractice.mutate(p.id)}
        />
      </div>
    )
  }

  return (
    <form
      onSubmit={e => { e.preventDefault(); saveMutation.mutate() }}
      className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 pb-24 sm:pb-8"
    >
      {/* Header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)',
            boxShadow: '0 4px 16px rgba(245,158,11,0.28)',
          }}
        >
          <FaShieldAlt className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content leading-tight truncate">
            {yatraQuery.data.name}
          </h1>
          <p className="text-xs text-base-content/70 mt-0.5">{t('yatras.adminSettings')}</p>
        </div>
        <Link
          to={`/yatra/${id}/settings`}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)' }}
        >
          <LuX className="w-4 h-4" />
        </Link>
      </div>

      {/* General */}
      <SectionLabel>{t('yatras.sectionGeneral')}</SectionLabel>
      <div className="rounded-2xl px-4 py-4 flex flex-col gap-3" style={glass}>
        {/* Name */}
        <div className="flex flex-col gap-1">
          <label htmlFor="yatra-name" className="text-xs font-medium text-base-content/70">{t('yatras.yatraName')}</label>
          <input
            id="yatra-name"
            style={inputStyle}
            value={yatraName}
            required
            onChange={e => setYatraName(e.target.value)}
            onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.12)` }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.10)'; e.target.style.boxShadow = 'none' }}
          />
        </div>

        {/* Show stability metrics */}
        <label className="flex items-center gap-3 cursor-pointer select-none py-1">
          <span className="flex-1 text-sm font-medium text-base-content">{t('yatras.showStability')}</span>
          <div
            onClick={() => setShowStability(v => !v)}
            className="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
            style={{
              background: showStability ? ACCENT : 'rgba(0,0,0,0.15)',
              cursor: 'pointer',
            }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{
                transform: showStability ? 'translateX(1.125rem)' : 'translateX(0.125rem)',
                boxShadow: '0 1px 4px rgba(0,0,0,0.20)',
              }}
            />
          </div>
        </label>
        <p className="text-xs text-base-content/70 -mt-1">
          {t('yatras.stabilityDesc')}
        </p>
      </div>

      {/* Invite link */}
      <SectionLabel>{t('yatras.sectionInvite')}</SectionLabel>
      <button
        type="button"
        onClick={copyInvite}
        className="rounded-2xl px-4 py-3.5 flex items-center gap-3 w-full text-left transition-all"
        style={glass}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: copied ? 'rgba(245,158,11,0.10)' : 'rgba(255,255,255,0.06)' }}
        >
          <LuLink className="w-4 h-4" style={{ color: copied ? ACCENT : 'rgba(242,244,246,0.65)' }} />
        </div>
        <span className="flex-1 text-sm font-semibold text-base-content">
          {copied ? t('yatras.inviteCopied') : t('yatras.copyInvite')}
        </span>
        {copied
          ? <LuCheck className="w-4 h-4 flex-shrink-0" style={{ color: ACCENT }} />
          : <LuCopy className="w-4 h-4 flex-shrink-0" style={{ color: '#d1d5db' }} />
        }
      </button>

      {/* Practices */}
      <SectionToggle label={`${t('yatras.sectionPractices')} (${practices.length})`} open={showPractices} onToggle={() => setShowPractices(v => !v)} />
      {showPractices && (
        <div className="flex flex-col gap-2">
          <DndContext collisionDetection={closestCenter} onDragEnd={handlePracticeDragEnd}>
            <SortableContext
              items={orderedPractices.map((p) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {orderedPractices.map((p) => (
                  <SortablePracticeRow key={p.id} p={p} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <Link
            to={`/yatra/${id}/practice/new`}
            className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2 no-underline"
            style={{
              background: ACCENT_GRADIENT,
              color: 'white',
              boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            }}
          >
            <FaPlus className="w-3.5 h-3.5" />
            {t('yatras.addNewPractice')}
          </Link>
        </div>
      )}

      {/* Members */}
      <SectionToggle label={`${t('yatras.sectionMembers')} (${members.length})`} open={showMembers} onToggle={() => setShowMembers(v => !v)} />
      {showMembers && (
        <div className="flex flex-col gap-2">
          {members.map(m => (
            <div key={m.user_id} className="rounded-2xl px-4 py-3.5 flex items-center gap-3" style={glass}>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)' }}
              >
                {m.user_name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 text-sm font-semibold text-base-content">{m.user_name}</span>
              <button
                type="button"
                onClick={() => toggleAdmin.mutate(m.user_id)}
                disabled={toggleAdmin.isPending}
                className="text-xs font-semibold px-2 py-0.5 rounded-full transition-colors"
                style={{
                  background: m.is_admin ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.06)',
                  color: m.is_admin ? '#f59e0b' : 'rgba(242,244,246,0.7)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('yatras.admin')}
              </button>
              <button
                type="button"
                onClick={() => (document.getElementById(`del-member-${m.user_id}`) as HTMLDialogElement)?.showModal()}
                className="w-8 h-8 flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: 'rgba(225,29,72,0.07)', color: 'rgba(225,29,72,0.55)', border: 'none' }}
              >
                <FaTrash className="w-3 h-3" />
              </button>
              <ConfirmModal
                id={`del-member-${m.user_id}`}
                title={t('yatras.removeMemberTitle')}
                message={t('yatras.removeMemberMsg', { name: m.user_name })}
                confirmLabel={t('yatras.removeMember')}
                onConfirm={() => removeMember.mutate(m.user_id)}
              />
            </div>
          ))}
          {members.length === 0 && (
            <p className="text-center text-sm text-base-content/70 py-4">{t('yatras.noMembers')}</p>
          )}
        </div>
      )}

      {/* Statistics */}
      <SectionToggle label={t('yatras.statistics')} open={showStats} onToggle={() => setShowStats(v => !v)} />
      {showStats && (
        <div className="flex flex-col gap-3">
          {/* Visibility */}
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={glass}>
            <LuChartBar className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} />
            <span className="flex-1 text-sm font-medium text-base-content">{t('yatras.visibleTo')}</span>
            <select
              value={statsVisibleToAll ? 'Everyone' : 'Admins'}
              onChange={e => setStatsVisibleToAll(e.target.value === 'Everyone')}
              style={{ ...selectStyle, width: 'auto', flex: 'none', paddingRight: '1.5rem' }}
            >
              <option value="Admins">{t('yatras.adminsOnly')}</option>
              <option value="Everyone">{t('yatras.everyone')}</option>
            </select>
          </div>

          {/* Stat rows */}
          {statistics.map((stat, idx) => {
            const dt = getPracticeType(stat.practice_id)
            return (
              <div key={idx} className="rounded-2xl px-4 py-4 flex flex-col gap-3" style={glass}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">
                    {stat.label || `Stat ${idx + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteStat(idx)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ background: 'rgba(225,29,72,0.07)', color: 'rgba(225,29,72,0.55)', border: 'none' }}
                  >
                    <LuX className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-base-content/70">{t('yatras.statLabel')}</label>
                  <input
                    style={inputStyle}
                    placeholder={t('yatras.statLabelPlaceholder')}
                    value={stat.label}
                    required
                    onChange={e => updateStat(idx, { label: e.target.value })}
                    onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px rgba(245,158,11,0.12)` }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.10)'; e.target.style.boxShadow = 'none' }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-base-content/70">{t('yatras.statPractice')}</label>
                  <select
                    style={selectStyle}
                    value={stat.practice_id}
                    required
                    onChange={e => updateStat(idx, { practice_id: e.target.value, aggregation: 'Count' })}
                  >
                    <option value="" disabled>{t('yatras.selectPractice')}</option>
                    {practices.map(p => (
                      <option key={p.id} value={p.id}>{p.practice}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-base-content/70">{t('yatras.statAggregation')}</label>
                    <select
                      style={selectStyle}
                      value={stat.aggregation}
                      onChange={e => updateStat(idx, { aggregation: e.target.value as Aggregation })}
                    >
                      {AGGREGATIONS.filter(a => !stat.practice_id || isGoodForPractice(a.value, dt)).map(a => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-base-content/70">{t('yatras.statTimeRange')}</label>
                    <select
                      style={selectStyle}
                      value={stat.time_range}
                      onChange={e => updateStat(idx, { time_range: e.target.value as TimeRange })}
                    >
                      {TIME_RANGES.map(tr => (
                        <option key={tr.value} value={tr.value}>{tr.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={addStat}
            className="rounded-2xl px-4 py-3.5 flex items-center gap-3 w-full"
            style={{ ...glass, borderStyle: 'dashed', borderColor: 'rgba(245,158,11,0.30)', background: 'rgba(245,158,11,0.03)', cursor: 'pointer', border: '1px dashed rgba(245,158,11,0.30)' }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.10)' }}>
              <FaPlus className="w-3 h-3" style={{ color: '#f59e0b' }} />
            </div>
            <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>{t('yatras.addStatistic')}</span>
          </button>
        </div>
      )}

      {/* Save button */}
      <button
        type="submit"
        disabled={saveMutation.isPending}
        className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
        style={{
          background: ACCENT_GRADIENT,
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
          opacity: saveMutation.isPending ? 0.7 : 1,
        }}
      >
        {saveMutation.isPending && <span className="loading loading-spinner loading-xs" />}
        <LuCheck className="w-4 h-4" />
        {t('common.save')}
      </button>

      {/* Delete yatra */}
      <button
        type="button"
        onClick={() => (document.getElementById('del-yatra') as HTMLDialogElement)?.showModal()}
        className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
        style={{
          background: 'rgba(255,255,255,0.06)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: '#dc2626',
          border: '1.5px solid rgba(220,38,38,0.35)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <FaTrash className="w-3.5 h-3.5" />
        {t('yatras.deleteYatra')}
      </button>
      <ConfirmModal
        id="del-yatra"
        title={t('yatras.deleteYatraTitle')}
        message={t('yatras.deleteYatraMsg')}
        confirmLabel={t('common.delete')}
        onConfirm={() => deleteYatra.mutate()}
      />

      {/* Error */}
      {saveMutation.isError && (
        <p className="text-sm text-red-600 text-center">
          {(saveMutation.error as Error)?.message ?? t('common.failedSave')}
        </p>
      )}
    </form>
  )
}
