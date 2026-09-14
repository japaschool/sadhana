interface InputProps {
  label: string
  name: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  error?: string
  type?: string
  placeholder?: string
  autoComplete?: string
  readOnly?: boolean
}

export function Input({
  label,
  name,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  autoComplete,
  readOnly,
}: InputProps) {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label htmlFor={name} className="label text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        readOnly={readOnly}
        className={`input input-bordered w-full ${error ? 'input-error' : ''}`}
      />
      {error && <span className="text-error text-xs">{error}</span>}
    </div>
  )
}
