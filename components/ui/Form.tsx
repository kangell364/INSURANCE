import type { ComponentPropsWithoutRef, ReactNode } from 'react'

type FieldProps = {
  label: string
  htmlFor: string
  error?: string | null
  hint?: ReactNode
  children: ReactNode
  required?: boolean
}

/**
 * Label + control + error message, wired together with aria-describedby so the
 * error is announced by screen readers rather than only shown visually.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  required,
}: FieldProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${htmlFor}-error`}
          className="mt-1.5 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}

const INPUT_BASE =
  'block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 ' +
  'placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500'

type InputProps = ComponentPropsWithoutRef<'input'> & {
  invalid?: boolean
}

export function Input({ invalid, className = '', ...props }: InputProps) {
  return (
    <input
      className={`${INPUT_BASE} ${
        invalid
          ? 'border-red-400 focus-visible:outline-red-500'
          : 'border-slate-300'
      } ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  )
}

/** A read-only value rendered in the shape of an input, for fields the user
 * may see but not edit (email, role). Using a disabled input instead would
 * imply the field is merely temporarily unavailable. */
export function ReadOnlyValue({
  children,
  note,
}: {
  children: ReactNode
  note?: string
}) {
  return (
    <>
      <p className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
        {children}
      </p>
      {note && <p className="mt-1.5 text-xs text-slate-500">{note}</p>}
    </>
  )
}

export function FormActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
