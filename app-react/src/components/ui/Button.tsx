interface ButtonProps {
  variant: 'primary' | 'secondary'
  children: React.ReactNode
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export function Button({
  variant,
  children,
  loading,
  disabled,
  onClick,
  type = 'button',
  className = '',
}: ButtonProps) {
  const cls = variant === 'primary' ? 'btn btn-primary' : 'btn btn-outline'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${cls} ${className}`}
    >
      {loading && <span className="loading loading-spinner loading-sm" />}
      {children}
    </button>
  )
}
