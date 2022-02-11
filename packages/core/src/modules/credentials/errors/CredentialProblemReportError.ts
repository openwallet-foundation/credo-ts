import type { ProblemReportErrorOptions } from '../../problem-reports'
import type { CredentialProblemReportReason } from './CredentialProblemReportReason'

import { CredentialProblemReportMessage } from '../v1/messages'

import { ProblemReportError } from './../../problem-reports/errors/ProblemReportError'

interface CredentialProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: CredentialProblemReportReason
}
export class CredentialProblemReportError extends ProblemReportError {
  public problemReport: CredentialProblemReportMessage

  public constructor(message: string, { problemCode }: CredentialProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new CredentialProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
