import type { InputHTMLAttributes } from 'react';
import { CURRENCY_CODE, moneyLabel, resolveCurrencyCode } from '../utils/currency';

type MoneyFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  withCurrencyLabel?: boolean;
  currencyCode?: string;
  type?: 'number' | 'text';
};

export function MoneyField({
  label,
  withCurrencyLabel = true,
  currencyCode = CURRENCY_CODE,
  type = 'number',
  className,
  ...props
}: MoneyFieldProps) {
  const code = resolveCurrencyCode(currencyCode);
  return (
    <label className="money-field">
      {withCurrencyLabel ? moneyLabel(label, code) : label}
      <span className="money-field-wrap">
        <input type={type} className={className} {...props} />
        <span className="money-field-suffix" aria-hidden="true">
          {code}
        </span>
      </span>
    </label>
  );
}