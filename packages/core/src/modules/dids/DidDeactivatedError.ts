import { CredoError } from '../../error'

export class DidDeactivatedError extends CredoError {
  public constructor(public readonly did: string) {
    super(`Did '${did}' is deactivated`)
  }
}
