import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FaHashtag, FaCheckCircle, FaStopwatch, FaClock, FaList } from 'react-icons/fa'
import { practicesApi } from '../api/practices'
import { yatrasApi } from '../api/yatras'
import { ErrorBanner } from './ui/ErrorBanner'
import type { PracticeDataType } from '../types/api'
import {
  ACCENT,
  ACCENT_SOFT,
  ACCENT_RING,
  ACCENT_GRADIENT,
  SURFACE_2,
  TEXT,
  TEXT_MUTED,
  BORDER,
} from '../theme/tokens'

type PracticeFormMode = { type: 'user' } | { type: 'yatra'; yatraId: string }

interface PracticeFormProps {
  mode: PracticeFormMode
  initialValues?: { name: string; dataType: PracticeDataType; isRequired?: boolean; dropdownVariants?: string; id?: string; isActive?: boolean }
  onSuccess: () => void
}

const TYPE_ICONS: { value: PracticeDataType; icon: React.ElementType; key: string }[] = [
  { value: 'Bool',     icon: FaCheckCircle, key: 'typeBool'     },
  { value: 'Int',      icon: FaHashtag,     key: 'typeInt'      },
  { value: 'Duration', icon: FaStopwatch,   key: 'typeDuration' },
  { value: 'Time',     icon: FaClock,       key: 'typeTime'     },
  { value: 'Text',     icon: FaList,        key: 'typeText'     },
]

const inputBase: React.CSSProperties = {
  background: SURFACE_2,
  border: `1px solid ${BORDER}`,
  borderRadius: '0.75rem',
  outline: 'none',
  width: '100%',
  fontSize: '0.95rem',
  color: TEXT,
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = ACCENT
  e.target.style.boxShadow = `0 0 0 3px ${ACCENT_RING}`
}
function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
  e.target.style.borderColor = BORDER
  e.target.style.boxShadow = 'none'
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  border: `1px solid ${BORDER}`,
  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
}

export function PracticeForm({ mode, initialValues, onSuccess }: PracticeFormProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [name, setName] = useState(initialValues?.name ?? '')
  const [dataType, setDataType] = useState<PracticeDataType>(initialValues?.dataType ?? 'Bool')
  const [isRequired, setIsRequired] = useState(initialValues?.isRequired ?? false)
  const [dropdownVariants, setDropdownVariants] = useState(initialValues?.dropdownVariants ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async () => {
      const data = {
        practice: name,
        data_type: dataType,
        is_active: initialValues?.isActive ?? true,
        is_required: isRequired || undefined,
        dropdown_variants: dataType === 'Text' ? dropdownVariants || undefined : undefined,
      }
      if (mode.type === 'user') {
        if (initialValues?.id) await practicesApi.updateUserPractice(initialValues.id, data)
        else await practicesApi.createUserPractice(data)
        await qc.invalidateQueries({ queryKey: ['practices'] })
      } else {
        if (initialValues?.id) {
          await yatrasApi.updateYatraPractice(mode.yatraId, {
            id: initialValues.id,
            practice: name,
            data_type: dataType,
          })
        } else {
          await yatrasApi.createYatraPractice(mode.yatraId, { practice: name, data_type: dataType })
        }
        await qc.invalidateQueries({ queryKey: ['yatra-practices', mode.yatraId] })
      }
    },
    onSuccess,
    onError: () => setError(t('common.error')),
  })

  return (
    <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate() }}
        className="flex flex-col gap-4 w-full"
      >
        {/* Name */}
        <div className="rounded-2xl p-5 flex flex-col gap-2" style={cardStyle}>
          <label className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">
            {t('practice.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning run"
            style={{ ...inputBase, padding: '0.625rem 0.875rem' }}
            onFocus={onFocus}
            onBlur={onBlur}
            autoFocus
          />
        </div>

        {/* Data type */}
        <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardStyle}>
          <label className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">
            {t('practice.type')}
          </label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {TYPE_ICONS.map(({ value, icon: Icon, key }) => {
              const label = t(`practice.${key}`)
              const active = dataType === value
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDataType(value)}
                  className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 transition-all"
                  style={
                    active
                      ? { background: ACCENT_SOFT, border: `1.5px solid ${ACCENT}`, boxShadow: `0 0 0 3px ${ACCENT_RING}` }
                      : { background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${BORDER}` }
                  }
                >
                  <Icon className="w-5 h-5" style={{ color: active ? ACCENT : TEXT_MUTED }} />
                  <span className="text-[10px] font-semibold leading-tight text-center break-words" style={{ color: active ? ACCENT : TEXT_MUTED }}>
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Dropdown variants — Text type only */}
        {dataType === 'Text' && (
          <div className="rounded-2xl p-5 flex flex-col gap-2" style={cardStyle}>
            <label className="text-xs font-semibold text-base-content/70 uppercase tracking-widest">
              {t('practice.dropdownVariants')}
            </label>
            <textarea
              rows={4}
              placeholder={t('practice.dropdownVariantsHint')}
              value={dropdownVariants}
              onChange={(e) => setDropdownVariants(e.target.value)}
              style={{ ...inputBase, padding: '0.625rem 0.875rem', resize: 'vertical' }}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </div>
        )}

        {/* Is required — user practices only */}
        {mode.type === 'user' && (
          <div className="rounded-2xl p-5 flex flex-col gap-3" style={cardStyle}>
            <button
              type="button"
              role="switch"
              aria-checked={isRequired}
              onClick={() => setIsRequired((v) => !v)}
              className="flex items-center justify-between w-full select-none"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
            >
              <span className="text-sm font-medium text-base-content">{t('practice.isRequired')}</span>
              <div
                className="relative flex-shrink-0"
                style={{
                  width: '3rem',
                  height: '1.75rem',
                  borderRadius: '999px',
                  backgroundColor: isRequired ? ACCENT : 'rgba(255,255,255,0.15)',
                  transition: 'background-color 0.2s',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    top: '0.25rem',
                    left: '0.25rem',
                    width: '1.25rem',
                    height: '1.25rem',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    transform: isRequired ? 'translateX(1.25rem)' : 'translateX(0)',
                    transition: 'transform 0.2s',
                    display: 'block',
                  }}
                />
              </div>
            </button>
            <p className="text-xs text-base-content/70 leading-relaxed">{t('practice.isRequiredHint')}</p>
          </div>
        )}

        <ErrorBanner message={error} />

        <button
          type="submit"
          disabled={mutation.isPending || !name.trim()}
          className="w-full h-12 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
          style={{
            background: ACCENT_GRADIENT,
            color: '#101a30',
            border: 'none',
            appearance: 'none' as React.CSSProperties['appearance'],
            boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
            opacity: name.trim() && !mutation.isPending ? 1 : 0.55,
            transition: 'opacity 0.2s',
            cursor: name.trim() && !mutation.isPending ? 'pointer' : 'not-allowed',
          }}
        >
          {mutation.isPending && <span className="loading loading-spinner loading-sm" />}
          {t('common.save')}
        </button>
    </form>
  )
}
