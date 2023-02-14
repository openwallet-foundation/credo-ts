import type { ProblemReportErrorOptions, CredentialProblemReportReason } from '@aries-framework/core'

import { ProblemReportError } from '@aries-framework/core'

import { V1CredentialProblemReportMessage } from '../messages'

export interface V1CredentialProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: CredentialProblemReportReason
}

export class V1CredentialProblemReportError extends ProblemReportError {
  public problemReport: V1CredentialProblemReportMessage

  public constructor(message: string, { problemCode }: V1CredentialProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new V1CredentialProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
