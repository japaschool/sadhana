import { memo } from 'react'

interface CardProps {
  children: React.ReactNode
  className?: string
}

export const Card = memo(function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`card bg-base-100 shadow-sm ${className}`}>
      {children}
    </div>
  )
})
