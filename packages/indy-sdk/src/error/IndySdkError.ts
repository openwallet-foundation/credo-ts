import type { IndyError } from './indyError'

import { CredoError } from '@credo-ts/core'

export class IndySdkError extends CredoError {
  public constructor(indyError: IndyError, message?: string) {
    const base = `${indyError.name}(${indyError.indyName}): ${indyError.message}`

    super(message ? `${message}: ${base}` : base, { cause: indyError })
  }
}
