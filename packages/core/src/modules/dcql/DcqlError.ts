import { CredoError } from '../../error'

export class DcqlError extends CredoError {
  public additionalMessages?: Array<string>

  public constructor(
    message: string,
    { cause, additionalMessages }: { cause?: Error; additionalMessages?: Array<string> } = {}
  ) {
    let fullMessage = message

    if (additionalMessages?.length) {
      fullMessage += `\n - ${additionalMessages.join('\n - ')}`
    }

    super(fullMessage, { cause })
    this.additionalMessages = additionalMessages
  }
}
