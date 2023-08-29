import type { ProblemReportErrorOptions } from '../../../../problem-reports'
import type { CredentialProblemReportReason } from '../../../models/CredentialProblemReportReason'

import { V2ProblemReportError } from '../../../../problem-reports/errors/V2ProblemReportError'
import { V3CredentialProblemReportMessage } from '../messages/V3CredentialProblemReportMessage'

export interface V3CredentialProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: CredentialProblemReportReason
  parentThreadId: string
}

export class V3CredentialProblemReportError extends V2ProblemReportError {
  public problemReport: V3CredentialProblemReportMessage

  public constructor(message: string, { problemCode, parentThreadId }: V3CredentialProblemReportErrorOptions) {
    super(message, { problemCode, parentThreadId })
    this.problemReport = new V3CredentialProblemReportMessage({
      parentThreadId,
      body: {
        code: problemCode,
        comment: message,
      },
    })
  }
}
