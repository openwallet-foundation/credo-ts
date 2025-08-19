import type { DidCommCredentialProblemReportReason, ProblemReportErrorOptions } from '@credo-ts/didcomm'

import { ProblemReportError } from '@credo-ts/didcomm'

import { V1CredentialProblemReportMessage } from '../messages'

export interface V1DidCommCredentialProblemReportErrorOptions extends ProblemReportErrorOptions {
  problemCode: DidCommCredentialProblemReportReason
}

export class V1CredentialProblemReportError extends ProblemReportError {
  public problemReport: V1CredentialProblemReportMessage

  public constructor(message: string, { problemCode }: V1DidCommCredentialProblemReportErrorOptions) {
    super(message, { problemCode })
    this.problemReport = new V1CredentialProblemReportMessage({
      description: {
        en: message,
        code: problemCode,
      },
    })
  }
}
