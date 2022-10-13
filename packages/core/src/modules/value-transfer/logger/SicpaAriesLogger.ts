import type { Logger } from '@aries-framework/core'

export interface SicpaAriesLogger extends Logger {
  createChildLogger(context: string[]): SicpaAriesLogger
}

export function tryCreateSicpaContextLogger(parentLogger: Logger, context: string[]): Logger {
  if ('createChildLogger' in parentLogger) {
    return (parentLogger as SicpaAriesLogger).createChildLogger(context)
  }

  return parentLogger
}
