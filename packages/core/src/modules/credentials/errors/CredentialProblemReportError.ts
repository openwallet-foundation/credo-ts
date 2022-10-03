import type { ProblemReportErrorOptions } from '../../problem-reports'
import type { CredentialProblemReportReason } from './CredentialProblemReportReason'

import { V1CredentialProblemReportMessage } from '../protocol/v1/messages'

import { ProblemReportError } from './../../problem-reports/errors/ProblemReportError'

interface CredentialProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: CredentialProblemReportReason
}
export class CredentialProblemReportError extends ProblemReportError {
  public problemReport: V1CredentialProblemReportMessage

  public constructor(message: string, { problemCode }: CredentialProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new V1CredentialProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
