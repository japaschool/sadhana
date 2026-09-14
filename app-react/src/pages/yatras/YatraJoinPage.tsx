import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FaUsers } from 'react-icons/fa'
import { LuX } from 'react-icons/lu'
import { yatrasApi } from '../../api/yatras'
import { Spinner } from '../../components/ui/Spinner'
import { ACCENT, ACCENT_GRADIENT } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

export function YatraJoinPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['yatra', id],
    queryFn: () => yatrasApi.getYatra(id!),
  })

  const join = useMutation({
    mutationFn: () => yatrasApi.joinYatra(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yatras'] })
      navigate(`/yatra/${id}/settings`, { replace: true })
    },
  })

  if (isLoading) return <Spinner />

  if (isError || !data) {
    return (
      <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto">
        <div className="rounded-2xl px-5 py-12 flex flex-col items-center gap-4 text-center" style={glass}>
          <p className="text-sm font-semibold text-base-content/70">{t('yatras.notFound')}</p>
          <button
            onClick={() => navigate('/yatras')}
            className="text-sm font-medium"
            style={{ color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {t('yatras.goToYatras')}
          </button>
        </div>
      </div>
    )
  }

  const initial = data.name.charAt(0).toUpperCase()

  return (
    <div className="px-4 py-6 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4 pb-24 sm:pb-8">
      {/* Header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 4px 16px rgba(245,158,11,0.28)',
          }}
        >
          <FaUsers className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content">{t('yatras.join')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">{t('yatras.invited')}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)', border: 'none', cursor: 'pointer' }}
        >
          <LuX className="w-4 h-4" />
        </button>
      </div>

      {/* Yatra info */}
      <div className="rounded-2xl px-5 py-8 flex flex-col items-center gap-4 text-center" style={glass}>
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-3xl font-bold"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 8px 32px rgba(245,158,11,0.30)',
          }}
        >
          {initial}
        </div>
        <div>
          <h2 className="text-xl font-bold text-base-content">{data.name}</h2>
          {data.member_count != null && (
            <p className="text-sm text-base-content/70 mt-1">
              {data.member_count} member{data.member_count === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <p className="text-sm text-base-content/70 leading-relaxed max-w-xs">
          {t('yatras.joinCircle')}
        </p>
      </div>

      {/* Actions */}
      <button
        onClick={() => join.mutate()}
        disabled={join.isPending}
        className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
        style={{
          background: ACCENT_GRADIENT,
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
          opacity: join.isPending ? 0.7 : 1,
          cursor: join.isPending ? 'default' : 'pointer',
        }}
      >
        {join.isPending && <span className="loading loading-spinner loading-xs" />}
        {t('yatras.join')}
      </button>

      <button
        onClick={() => navigate(-1)}
        className="w-full h-12 rounded-full text-sm font-semibold"
        style={{
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          color: 'rgba(242,244,246,0.65)',
          border: '1.5px solid rgba(255,255,255,0.10)',
          cursor: 'pointer',
        }}
      >
        {t('common.cancel')}
      </button>

      {join.isError && (
        <p className="text-sm text-red-600 text-center">{t('yatras.joinFailed')}</p>
      )}
    </div>
  )
}
