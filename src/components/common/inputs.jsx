import { forwardRef } from 'react'
import clsx from 'clsx'
import { AlertCircle } from 'lucide-react'

const base =
  'block w-full rounded-lg border border-surface-200 bg-surface-50 px-3 text-sm text-surface-800 placeholder:text-surface-400 ' +
  'transition focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 disabled:bg-surface-50'

export function Label({ children, hint, required }) {
  return (
    <label className="block text-sm font-medium text-surface-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      {hint && <span className="ml-2 text-xs font-normal text-surface-400">{hint}</span>}
    </label>
  )
}

export function FieldError({ message }) {
  if (!message) return null
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle size={13} /> {message}
    </p>
  )
}

export const Input = forwardRef(function Input({ className, error, ...rest }, ref) {
  return (
    <>
      <input ref={ref} className={clsx(base, 'h-10', error && 'border-red-400 focus:ring-red-500/30', className)} {...rest} />
      <FieldError message={typeof error === 'string' ? error : undefined} />
    </>
  )
})

export const Textarea = forwardRef(function Textarea({ className, error, rows = 3, ...rest }, ref) {
  return (
    <>
      <textarea ref={ref} rows={rows} className={clsx(base, 'py-2', error && 'border-red-400 focus:ring-red-500/30', className)} {...rest} />
      <FieldError message={typeof error === 'string' ? error : undefined} />
    </>
  )
})

export const Select = forwardRef(function Select({ className, error, children, ...rest }, ref) {
  return (
    <>
      <select ref={ref} className={clsx(base, 'h-10 appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2364748b%27 stroke-width=%272%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-9', error && 'border-red-400', className)} {...rest}>
        {children}
      </select>
      <FieldError message={typeof error === 'string' ? error : undefined} />
    </>
  )
})

/** Text input with a fixed ৳ prefix for taka amounts. */
export const AmountInput = forwardRef(function AmountInput({ className, error, prefix = '৳', ...rest }, ref) {
  return (
    <>
      <div
        className={clsx(
          'flex items-stretch rounded-lg border bg-surface-50 transition focus-within:ring-2 focus-within:ring-primary-500/40',
          error ? 'border-red-400' : 'border-surface-200 focus-within:border-primary-500',
          className,
        )}
      >
        <span className="flex items-center pl-3 pr-1 text-sm font-medium text-surface-400 select-none">{prefix}</span>
        <input
          ref={ref}
          inputMode="decimal"
          className="h-10 w-full bg-transparent pr-3 text-sm text-surface-800 placeholder:text-surface-400 focus:outline-none"
          {...rest}
        />
      </div>
      <FieldError message={typeof error === 'string' ? error : undefined} />
    </>
  )
})
