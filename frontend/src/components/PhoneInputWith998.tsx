/**
 * Telefon input: +998 doim ko'rinadi, foydalanuvchi faqat 9 ta raqam kiritadi.
 * value/onChange вЂ” to'liq raqam: +998XXXXXXXXX (konfliktlarsiz barcha joyda bir xil).
 */
import React from 'react';

const PREFIX = '+998';

export function toFullPhone(digitsOnly: string): string {
  const digits = digitsOnly.replace(/\D/g, '').slice(0, 9);
  return digits.length >= 9 ? `${PREFIX}${digits}` : '';
}

export function fromFullPhone(fullPhone: string): string {
  if (!fullPhone) return '';
  const digits = fullPhone.replace(/\D/g, '');
  return digits.startsWith('998') ? digits.slice(3) : digits;
}

interface PhoneInputWith998Props {
  value: string;
  onChange: (fullPhone: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  required?: boolean;
  showHint?: boolean;
  disabled?: boolean;
}

export const PhoneInputWith998: React.FC<PhoneInputWith998Props> = ({
  value,
  onChange,
  id,
  name = 'phone',
  placeholder = '90 123 45 67',
  className = '',
  inputClassName = '',
  required,
  showHint = true,
  disabled = false,
}) => {
  const digitsOnly = fromFullPhone(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 9);
    onChange(digits.length ? `${PREFIX}${digits}` : '');
  };

  return (
    <div className={className}>
      <div className="flex rounded-xl overflow-hidden bg-white/10 border border-white/10 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
        <span className="flex items-center px-4 py-2.5 text-white font-medium bg-white/5 text-sm shrink-0">
          +998
        </span>
        <input
          id={id}
          name={name}
          type="tel"
          inputMode="numeric"
          maxLength={9}
          value={digitsOnly}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          placeholder={placeholder}
          autoComplete="tel-national"
          className={`flex-1 min-w-0 px-3 py-2.5 bg-transparent text-white placeholder-slate-400 outline-none font-medium text-sm ${inputClassName}`}
        />
      </div>
      {showHint && (
        <p className="text-[10px] text-slate-500 mt-1 ml-1">Faqat raqam kiriting</p>
      )}
    </div>
  );
};