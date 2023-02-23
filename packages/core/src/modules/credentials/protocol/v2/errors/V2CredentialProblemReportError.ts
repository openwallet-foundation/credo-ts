import type { ProblemReportErrorOptions } from '../../../../problem-reports'
import type { CredentialProblemReportReason } from '../../../models/CredentialProblemReportReason'

import { ProblemReportError } from '../../../../problem-reports/errors/ProblemReportError'
import { V2CredentialProblemReportMessage } from '../messages/V2CredentialProblemReportMessage'

export interface V2CredentialProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: CredentialProblemReportReason
}

export class V2CredentialProblemReportError extends ProblemReportError {
  public problemReport: V2CredentialProblemReportMessage

  public constructor(message: string, { problemCode }: V2CredentialProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new V2CredentialProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
