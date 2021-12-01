import type { CredentialProblemReportReason } from './CredentialProblemReportReason'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'

export class CredentialProblemReportError extends AriesFrameworkError {
  public constructor(public message: string, public problemCode: CredentialProblemReportReason) {
    super(message)
  }
}
