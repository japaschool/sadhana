import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { yatrasApi } from '../../api/yatras'
import { useLayout } from '../../layouts/useLayout'
import { initials } from '../../ui/initials'
import { AuthFrame } from './AuthFrame'
import { Banner, BTN, PrimaryButton, PrimaryLink, Title } from './kit'
import { failure } from './Login'
import { Spinner } from './Register'

const AVATARS = ['bg-ui-ink text-ui-bg', 'bg-ui-accent-fill text-ui-ink', 'bg-[var(--ui-chart-3)] text-ui-ink', 'bg-[var(--ui-chart-4)] text-ui-ink']
const AVATAR = 'flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-ui-surface text-xs font-extrabold'

/** 12b: /yatra/:id/join. Signed out, ProtectedRoute sends it through Sign in and back here. */
export function YatraJoin() {
  const { t } = useTranslation()
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const layout = useLayout()
  const yatra = useQuery({ queryKey: ['yatra', id], queryFn: () => yatrasApi.getYatra(id), retry: false })
  const users = useQuery({ queryKey: ['yatra-users', id], queryFn: () => yatrasApi.getYatraUsers(id), enabled: yatra.isSuccess })
  const mine = useQuery({ queryKey: ['yatras'], queryFn: yatrasApi.getYatras })
  const join = useMutation({
    mutationFn: () => yatrasApi.joinYatra(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['yatras'] })
      navigate(`/yatra/${id}/links?joined=1`, { replace: true })
    },
  })

  if (yatra.isLoading || mine.isLoading) return <AuthFrame lang={false}><Spinner /></AuthFrame>
  // Already in it (an old invite opened again): straight to the yatra.
  if (mine.data?.some((y) => y.id === id)) return <Navigate to="/yatras" replace />

  if (yatra.isError || !yatra.data) return (
    <AuthFrame lang={false}>
      <div className="flex flex-col gap-7">
        <Title medallion="danger">{t('yatras.notFound')}</Title>
        <PrimaryLink to="/">{t('notFound.goHome')}</PrimaryLink>
      </div>
    </AuthFrame>
  )

  const members = users.data ?? []
  const buttons = (
    <div className="grid grid-cols-[1fr_2fr] gap-2.5">
      <Link to="/" className={`${BTN} text-[15px] text-ui-ink2`}>{t('common.cancel')}</Link>
      <PrimaryButton type="button" busy={join.isPending} busyLabel={t('yatras.join')} onClick={() => join.mutate()}>{t('yatras.join')}</PrimaryButton>
    </div>
  )
  // The tablet frame is already a card; mobile and desktop draw their own.
  const card = layout === 'tablet' ? 'flex flex-col gap-[18px]' : 'flex flex-col gap-[18px] rounded-3xl border border-ui-hairline bg-ui-surface p-6'

  return (
    <AuthFrame lang={false} actions={layout === 'mobile' ? <div className="px-4 pt-4 pb-[calc(40px+env(safe-area-inset-bottom))]">{buttons}</div> : undefined}>
      <div className="-mx-2 flex flex-1 flex-col justify-center gap-3.5 sm:mx-0">
        <span className="pl-2 text-[11px] font-bold tracking-[.1em] text-ui-muted uppercase">{t('yatraJoin.eyebrow')}</span>
        <section className={card}>
          {members.length > 0 && (
            <div aria-hidden className="flex">
              {members.slice(0, 4).map((m, i) => <span key={m.user_id} className={`${AVATAR} ${AVATARS[i]} ${i ? '-ml-3' : ''}`}>{initials(m.user_name)}</span>)}
              {members.length > 4 && <span className={`${AVATAR} -ml-3 bg-ui-hairline font-ui-mono font-semibold text-ui-ink2`}>+{members.length - 4}</span>}
            </div>
          )}
          <h1 className="text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] break-words">{yatra.data.name}</h1>
          <div className="flex min-h-12 items-center justify-between border-y border-ui-hairline text-sm">
            <span className="font-semibold text-ui-muted">{t('yatraJoin.members')}</span>
            <span className="font-ui-mono font-medium">{users.data ? members.length : '…'}</span>
          </div>
          <p className="rounded-[14px] bg-ui-chip px-3.5 py-3 text-[13px] leading-normal text-ui-ink2">{t('yatraJoin.note')}</p>
          {join.isError && <Banner>{t(failure(join.error).key === 'auth.offline' ? 'auth.offline' : 'yatras.joinFailed')}</Banner>}
          {layout !== 'mobile' && buttons}
        </section>
      </div>
    </AuthFrame>
  )
}
