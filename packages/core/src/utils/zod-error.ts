import z from 'zod'

export function formatZodError(error?: z.ZodError): string {
  if (!error) return ''

  return z.prettifyError(error)
}
