/**
 * The shape a form action hands back to its form, and the idle value.
 *
 * This lives outside app/admin/content/actions.ts because that file is marked
 * `'use server'`, and such a module may export ONLY async functions — every
 * export becomes a callable server endpoint, so a plain object cannot be one.
 * Exporting `idleState` from there built fine and failed at page-data
 * collection with "a 'use server' file can only export async functions",
 * which names the rule but not the offending export.
 *
 * Types are erased before that check, so they could have stayed. Keeping them
 * next to the value they describe is worth more than splitting hairs about
 * which half the compiler would have tolerated.
 */

export type FormFieldErrors<T extends string> = Partial<Record<T, string>>

export type ActionState<T extends string = string> = {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors: FormFieldErrors<T>
}

export const idleState: ActionState = {
  status: 'idle',
  message: null,
  fieldErrors: {},
}
