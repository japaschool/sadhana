import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FaPlus } from 'react-icons/fa'
import { LuX } from 'react-icons/lu'
import { PracticeForm } from '../../components/PracticeForm'
import { ACCENT_GRADIENT, BORDER } from '../../theme/tokens'

const glass: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

export function YatraPracticeNewPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const back = () => navigate(`/yatra/${id}/admin/settings`)

  return (
    <div className="px-4 py-6 pb-24 sm:pb-8 max-w-lg sm:max-w-2xl mx-auto flex flex-col gap-4">
      {/* Header */}
      <div className="rounded-2xl px-5 py-5 flex items-center gap-4" style={glass}>
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{
            background: ACCENT_GRADIENT,
            boxShadow: '0 4px 16px rgba(245,158,11,0.28)',
          }}
        >
          <FaPlus className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-base-content leading-tight">{t('practice.new')}</h1>
          <p className="text-xs text-base-content/70 mt-0.5">{t('yatras.addToGroup')}</p>
        </div>
        <button
          onClick={back}
          aria-label="Close"
          className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.40)', border: 'none', cursor: 'pointer' }}
        >
          <LuX className="w-4 h-4" />
        </button>
      </div>

      <PracticeForm
        mode={{ type: 'yatra', yatraId: id! }}
        onSuccess={back}
      />
    </div>
  )
}
