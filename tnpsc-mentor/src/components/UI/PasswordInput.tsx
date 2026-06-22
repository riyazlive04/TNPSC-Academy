import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useT } from '../../lib/i18n'

interface PasswordInputProps {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  /** Marks the field aria-invalid and adds a shake when set true on submit. */
  invalid?: boolean
  onEnter?: () => void
}

/**
 * Password field with an accessible show/hide toggle. The reveal button has a
 * tactile press + focus ring and announces its state to screen readers.
 */
export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
  invalid = false,
  onEnter,
}: PasswordInputProps) {
  const [shown, setShown] = useState(false)
  const { t } = useT()
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        autoComplete={autoComplete}
        className={`input-soft pr-11 transition-colors ${
          invalid ? 'animate-shake border-coral/60 focus:ring-coral/20' : ''
        }`}
        placeholder={placeholder}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) onEnter()
        }}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? t('hidePassword') : t('showPassword')}
        aria-pressed={shown}
        className="icon-btn absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2"
        tabIndex={0}
      >
        {shown ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}
