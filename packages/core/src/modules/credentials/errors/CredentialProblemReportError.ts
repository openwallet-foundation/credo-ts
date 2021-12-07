import type { ProblemReportErrorOptions } from '../../problem-reports'
import type { CredentialProblemReportReason } from './CredentialProblemReportReason'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { CredentialProblemReportMessage } from '../messages'

interface CredentialProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: CredentialProblemReportReason
}
export class CredentialProblemReportError extends AriesFrameworkError {
  public problemReport: CredentialProblemReportMessage

  public constructor(message: string, { problemCode }: CredentialProblemReportErrorOptions) {
    super(message)
    this.problemReport = new CredentialProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
