import { ua10Digits, formatUaGroups, toE164 } from '../../utils/phone'
import './PhoneInput.css'

// A phone field with a locked "+38" prefix — the guest types their number the
// way they're used to, as the local 10-digit form starting with 0 (e.g.
// "0501234567"), instead of having to drop that leading 0 themselves.
export default function PhoneInput({ value, onChange, required, className = '' }) {
  const digits = ua10Digits(value)

  return (
    <div className={`phone-input ${className}`}>
      <span className="phone-input__prefix">+38</span>
      <input
        className="phone-input__field"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required={required}
        placeholder="0XX XXX XX XX"
        value={formatUaGroups(digits)}
        onChange={e => onChange(toE164(ua10Digits(e.target.value)))}
      />
    </div>
  )
}
