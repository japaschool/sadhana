import { memo } from 'react'

export const Spinner = memo(function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  )
})
