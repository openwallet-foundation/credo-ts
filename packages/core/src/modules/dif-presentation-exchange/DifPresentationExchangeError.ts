import { CredoError } from '../../error'

export class DifPresentationExchangeError extends CredoError {
  public additionalMessages?: Array<string>

  public constructor(
    message: string,
    { cause, additionalMessages }: { cause?: Error; additionalMessages?: Array<string> } = {}
  ) {
    super(message, { cause })
    this.additionalMessages = additionalMessages
  }
}
