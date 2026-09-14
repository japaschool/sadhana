import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { LuHash, LuTimer, LuClock, LuType, LuToggleRight, LuX, LuCheck } from 'react-icons/lu'
import { FaCog, FaPlus, FaUsers } from 'react-icons/fa'
import { yatrasApi } from '../../api/yatras'
import { practicesApi } from '../../api/practices'
import { Spinner } from '../../components/ui/Spinner'
import type { PracticeDataType } from '../../types/api'
import { ACCENT, ACCENT_GRADIENT } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

const TYPE_META: Record<PracticeDataType, {
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

export function YatraSettingsPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // ── Queries ──────────────────────────────────────────────────────────────

  const yatraQuery = useQuery({
    queryKey: ['yatra', id],
    queryFn: () => yatrasApi.getYatra(id!),
  })

  const mappingsQuery = useQuery({
    queryKey: ['yatra-user-practices', id],
    queryFn: () => yatrasApi.getYatraUserPractices(id!),
  })

  const userPracticesQuery = useQuery({
    queryKey: ['practices'],
    queryFn: practicesApi.getUserPractices,
  })

  const isAdminQuery = useQuery({
    queryKey: ['yatra-is-admin', id],
    queryFn: () => yatrasApi.isAdmin(id!),
  })

  // ── Local mapping state ──────────────────────────────────────────────────
  // keyed by yatra practice name → user practice name (or null)
  const [mappings, setMappings] = useState<Record<string, string | null>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [saved, setSaved] = useState(false)
  const [newName, setNewName] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (mappingsQuery.data) {
      const m: Record<string, string | null> = {}
      for (const p of mappingsQuery.data) {
        m[p.yatra_practice.practice] = p.user_practice ?? null
      }
      setMappings(m)
    }
  }, [mappingsQuery.data])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () => {
      const practices = (mappingsQuery.data ?? []).map(p => ({
        yatra_practice: p.yatra_practice,
        user_practice: mappings[p.yatra_practice.practice] ?? null,
      }))
      return yatrasApi.updateYatraUserPractices(id!, practices)
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    },
  })

  const leaveMutation = useMutation({
    mutationFn: () => yatrasApi.leaveYatra(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yatras'] })
      navigate('/yatras', { replace: true })
    },
  })

  const createMutation = useMutation({
    mutationFn: (name: string) => yatrasApi.createYatra(name),
    onSuccess: (newYatra) => {
      qc.invalidateQueries({ queryKey: ['yatras'] })
      setShowCreate(false)
      setNewName('')
      navigate(`/yatra/${newYatra.id}/settings`)
    },
  })

  function submitCreate() {
    const trimmed = newName.trim()
    if (trimmed) createMutation.mutate(trimmed)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const activePractices = (userPracticesQuery.data ?? []).filter(p => p.is_active)
  const usedPractices = new Set(Object.values(mappings).filter(Boolean) as string[])

  const isLoading =
    yatraQuery.isLoading ||
    mappingsQuery.isLoading ||
    userPracticesQuery.isLoading ||
    isAdminQuery.isLoading

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 pb-28 sm:pb-8 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-3">
        {/* Page header */}
        <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: ACCENT_GRADIENT, boxShadow: '0 4px 16px rgba(245,158,11,0.30)' }}
          >
            <FaCog className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-base-content leading-tight truncate">
              {yatraQuery.data?.name ?? '…'}
            </h1>
            <p className="text-xs text-base-content/70 mt-0.5">{t('nav.settings')}</p>
          </div>
          <Link
            to="/yatras"
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.60)' }}
          >
            <LuX className="w-4 h-4" />
          </Link>
        </div>

        {isLoading && <Spinner />}

        {/* Info text */}
        {!isLoading && (
          <div className="rounded-2xl px-4 py-3" style={glass}>
            <p className="text-xs text-base-content/70">
              {t('yatras.mapHint')}
            </p>
          </div>
        )}

        {/* Practice mapping rows */}
        {!isLoading && (mappingsQuery.data ?? []).map(item => {
          const meta = TYPE_META[item.yatra_practice.data_type] ?? TYPE_META.Text
          const Icon = meta.icon
          const currentValue = mappings[item.yatra_practice.practice] ?? ''

          // Options: active user practices with same type, not already used elsewhere, + currently selected
          const options = activePractices.filter(up =>
            up.data_type === item.yatra_practice.data_type &&
            (!usedPractices.has(up.practice) || up.practice === currentValue)
          )

          return (
            <div
              key={item.yatra_practice.id}
              className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
              style={glass}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: meta.bg }}
              >
                <Icon className="w-4 h-4" style={{ color: meta.color }} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-base-content/70 leading-none mb-0.5">{t('yatras.groupPractice')}</p>
                <p className="text-sm font-semibold text-base-content truncate">
                  {item.yatra_practice.practice}
                </p>
              </div>

              <select
                value={currentValue}
                onChange={e => {
                  const next = e.target.value
                  setMappings(prev => ({ ...prev, [item.yatra_practice.practice]: next || null }))
                }}
                className="text-sm rounded-xl px-2 h-9 flex-shrink-0 outline-none cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.10)',
                  color: currentValue ? ACCENT : 'rgba(242,244,246,0.7)',
                  maxWidth: '10rem',
                  fontWeight: currentValue ? 600 : 400,
                }}
              >
                <option value="">{t('yatras.notMapped')}</option>
                {options.map(up => (
                  <option key={up.id} value={up.practice}>{up.practice}</option>
                ))}
              </select>
            </div>
          )
        })}

        {!isLoading && mappingsQuery.data?.length === 0 && (
          <div className="rounded-2xl px-4 py-8 text-center" style={glass}>
            <p className="text-sm text-base-content/70">{t('yatras.noPracticesYatra')}</p>
            {isAdminQuery.data && (
              <Link
                to={`/yatra/${id}/admin/settings`}
                className="mt-3 inline-block text-sm font-medium"
                style={{ color: ACCENT }}
              >
                {t('yatras.addPracticesLink')}
              </Link>
            )}
          </div>
        )}

        {/* Save button */}
        {!isLoading && (mappingsQuery.data?.length ?? 0) > 0 && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || saved}
            className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
            style={{
              background: saved
                ? 'rgba(245,158,11,0.12)'
                : ACCENT_GRADIENT,
              color: saved ? ACCENT : 'white',
              border: saved ? `1.5px solid rgba(245,158,11,0.30)` : 'none',
              boxShadow: saved ? 'none' : '0 4px 20px rgba(245,158,11,0.35)',
              opacity: saveMutation.isPending ? 0.7 : 1,
              transition: 'all 0.25s',
            }}
          >
            {saveMutation.isPending && <span className="loading loading-spinner loading-xs" />}
            {saved ? <LuCheck className="w-4 h-4" /> : null}
            {saved ? t('common.saved') : t('common.save')}
          </button>
        )}

        {/* Admin settings */}
        {!isLoading && isAdminQuery.data && (
          <Link
            to={`/yatra/${id}/admin/settings`}
            className="rounded-2xl px-4 py-4 flex items-center gap-3 no-underline"
            style={glass}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.10)' }}
            >
              <FaCog className="w-4 h-4" style={{ color: '#f59e0b' }} />
            </div>
            <span className="flex-1 text-sm font-semibold text-base-content">{t('yatras.adminSettings')}</span>
            <span className="text-xs" style={{ color: '#d1d5db' }}>›</span>
          </Link>
        )}

        {/* Create new yatra */}
        {!isLoading && (
          <button
            onClick={() => { setShowCreate(true); setTimeout(() => nameInputRef.current?.focus(), 50) }}
            className="rounded-2xl px-4 py-3.5 flex items-center gap-3 w-full text-left"
            style={glass}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.10)' }}
            >
              <FaPlus className="w-3.5 h-3.5" style={{ color: ACCENT }} />
            </div>
            <span className="flex-1 text-sm font-medium text-base-content">{t('yatras.createNewYatra')}</span>
          </button>
        )}

        {/* Leave */}
        {!isLoading && (
          <button
            onClick={() => {
              if (window.confirm(t('yatras.leaveConfirm'))) {
                leaveMutation.mutate()
              }
            }}
            disabled={leaveMutation.isPending}
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
            {leaveMutation.isPending && <span className="loading loading-spinner loading-xs" />}
            {t('yatras.leaveYatra')}
          </button>
        )}

        {/* Errors */}
        {saveMutation.isError && (
          <p className="text-sm text-red-600 text-center">
            {(saveMutation.error as Error)?.message ?? t('common.failedSave')}
          </p>
        )}
        {leaveMutation.isError && (
          <p className="text-sm text-red-600 text-center">
            {(leaveMutation.error as Error)?.message ?? t('common.failedLeave')}
          </p>
        )}

      {/* Create yatra modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setNewName('') } }}
        >
          <div
            className="w-full max-w-sm rounded-3xl px-6 py-6 flex flex-col gap-4"
            style={glass}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: ACCENT_GRADIENT, boxShadow: '0 4px 12px rgba(245,158,11,0.28)' }}
              >
                <FaUsers className="w-4.5 h-4.5 text-white" />
              </div>
              <h2 className="text-base font-bold text-base-content">{t('yatras.newTitle')}</h2>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewName('') }}
                aria-label="Close"
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-full"
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.60)' }}
              >
                <LuX className="w-4 h-4" />
              </button>
            </div>
            <input
              ref={nameInputRef}
              type="text"
              placeholder={t('yatras.namePlaceholder')}
              aria-label="Yatra name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') { setShowCreate(false); setNewName('') } }}
              className="w-full px-4 py-3 rounded-2xl text-sm font-medium outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1.5px solid rgba(255,255,255,0.10)',
                color: '#f2f4f6',
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewName('') }}
                className="flex-1 h-11 rounded-full text-sm font-semibold"
                style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.60)', cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={submitCreate}
                disabled={!newName.trim() || createMutation.isPending}
                className="flex-1 h-11 rounded-full text-sm font-semibold text-white"
                style={{
                  background: ACCENT_GRADIENT,
                  border: 'none',
                  cursor: 'pointer',
                  opacity: !newName.trim() || createMutation.isPending ? 0.6 : 1,
                }}
              >
                {createMutation.isPending ? '…' : t('yatras.createButton')}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
  )
}
