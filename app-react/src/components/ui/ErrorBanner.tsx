import { memo } from 'react'

interface ErrorBannerProps {
  message?: string | null
}

export const ErrorBanner = memo(function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) return null
  return (
    <div role="alert" className="alert alert-error text-sm">
      {message}
    </div>
  )
})
